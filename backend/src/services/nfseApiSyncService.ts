import { PrismaClient } from '@prisma/client';
import { comTravaDeSync, getAPI, persistTokens } from './contaAzulSyncService';

const prisma = new PrismaClient();

/**
 * Le as NFS-e emitidas pela API do Conta Azul e grava em NotaFiscalServicoApi.
 *
 * O CSV da prefeitura so chega no fechamento do mes, entao o CRM ficava ate um
 * mes sem enxergar nota nova — uma OS sem nota so aparecia como pendencia no
 * mes seguinte, e muitas vezes nem ai. Rodando varias vezes ao dia, a nota
 * emitida hoje ja tira a pendencia amanha. Rodar com frequencia tambem mantem
 * o token vivo: parado por dias, o refresh token expira (aconteceu em out/2026).
 *
 * Limites da API: competencia em janelas de no maximo 15 dias, 100 notas por
 * pagina. Relemos sempre os ultimos DIAS_RELIDOS dias — nota emitida com
 * competencia retroativa (ex.: 14/10 com competencia 30/09) e cancelamentos
 * tardios sao pegos na proxima rodada.
 */

const DIAS_RELIDOS = 75;
const JANELA_DIAS = 15;
const CHAVE_ULTIMO_OK = 'nfse_api_ultimo_ok';
const CHAVE_ULTIMO_ERRO = 'nfse_api_ultimo_erro';

const dia = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Janelas [de, ate] de ate 15 dias cobrindo o intervalo, inclusive. */
export function janelasDeCompetencia(inicio: Date, fim: Date): [string, string][] {
    const janelas: [string, string][] = [];
    for (let de = new Date(inicio); de <= fim; de = new Date(de.getTime() + JANELA_DIAS * dia)) {
        const ate = new Date(Math.min(de.getTime() + (JANELA_DIAS - 1) * dia, fim.getTime()));
        janelas.push([ymd(de), ymd(ate)]);
    }
    return janelas;
}

// A data de competencia vem como YYYY-MM-DD; meio-dia UTC evita virar o dia
// (e o mes) em qualquer fuso, como no resto das datas fiscais do BI.
const dataDeCompetencia = (v: string) => new Date(`${String(v).slice(0, 10)}T12:00:00Z`);

export async function sincronizarNfseApi(): Promise<{ notas: number; janela: string } | null> {
    return comTravaDeSync('notas fiscais (API)', async () => {
        const api = await getAPI();
        const tokenAntes = api.getRefreshTokenValue();
        const hoje = new Date();
        const inicio = new Date(hoje.getTime() - DIAS_RELIDOS * dia);
        const janela = `${ymd(inicio)} → ${ymd(hoje)}`;
        try {
            const itens: any[] = [];
            for (const [de, ate] of janelasDeCompetencia(inicio, hoje)) {
                for (let pagina = 1; ; pagina++) {
                    const r = await api.getNotasFiscaisServico({ de, ate, pagina });
                    const lote = r?.itens || [];
                    itens.push(...lote);
                    if (!lote.length || pagina >= (r?.paginacao?.total_paginas ?? 1)) break;
                    await sleep(300);
                }
            }

            await prisma.$transaction(itens.map((n) => {
                const data = {
                    numero: String(n.numero_nfse ?? ''),
                    status: String(n.status ?? ''),
                    valorLiquido: Number(n.valor_total_nfse) || 0,
                    dataCompetencia: dataDeCompetencia(n.data_competencia),
                    dataEmissao: n.informacao_transmissao?.data_inicio_emissao ? new Date(`${n.informacao_transmissao.data_inicio_emissao}-03:00`) : null,
                    clienteNome: String(n.nome_cliente ?? ''),
                    clienteDocumento: digits(n.documento_cliente),
                    numeroVenda: n.numero_venda != null ? String(n.numero_venda) : null,
                    cidadeEmissao: n.cidade_emissao?.nome ?? null,
                    ufEmissao: n.cidade_emissao?.estado ?? null,
                };
                return prisma.notaFiscalServicoApi.upsert({ where: { id: String(n.id) }, update: data, create: { id: String(n.id), ...data } });
            }));

            await prisma.appConfig.upsert({
                where: { key: CHAVE_ULTIMO_OK },
                update: { value: JSON.stringify({ em: new Date().toISOString(), notas: itens.length, janela }) },
                create: { key: CHAVE_ULTIMO_OK, value: JSON.stringify({ em: new Date().toISOString(), notas: itens.length, janela }) },
            });
            await prisma.appConfig.deleteMany({ where: { key: CHAVE_ULTIMO_ERRO } });
            console.log(`[NFS-e API] ✅ ${itens.length} notas (${janela})`);
            return { notas: itens.length, janela };
        } catch (error: any) {
            const mensagem = error.response?.data?.descricao || error.message || 'Erro desconhecido';
            await prisma.appConfig.upsert({
                where: { key: CHAVE_ULTIMO_ERRO },
                update: { value: JSON.stringify({ em: new Date().toISOString(), mensagem }) },
                create: { key: CHAVE_ULTIMO_ERRO, value: JSON.stringify({ em: new Date().toISOString(), mensagem }) },
            });
            console.error('[NFS-e API] ❌ Falha:', mensagem);
            throw error;
        } finally {
            // Grava ja o token renovado, mesmo se a leitura falhar depois: o
            // refresh token antigo deixou de valer no momento da renovacao.
            if (api.getRefreshTokenValue() !== tokenAntes) await persistTokens(api);
        }
    });
}

export async function estadoNfseApi() {
    const [ok, erro] = await Promise.all([
        prisma.appConfig.findUnique({ where: { key: CHAVE_ULTIMO_OK } }),
        prisma.appConfig.findUnique({ where: { key: CHAVE_ULTIMO_ERRO } }),
    ]);
    const ler = (v?: string) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
    return { ultimoOk: ler(ok?.value), ultimoErro: ler(erro?.value) };
}

/** Agenda a leitura a cada `horas`, comecando alguns minutos depois do boot. */
export function agendarSincronizacaoNfseApi(horas: number) {
    const rodar = () => sincronizarNfseApi()
        .then((r) => { if (r === null) console.log('[NFS-e API] Outra sincronização em andamento; fica para a próxima rodada.'); })
        .catch(() => { /* ja registrado em nfse_api_ultimo_erro */ });
    setTimeout(rodar, 2 * 60 * 1000);
    setInterval(rodar, horas * 60 * 60 * 1000);
}
