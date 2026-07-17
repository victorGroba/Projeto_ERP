import { PrismaClient } from '@prisma/client';
import { ContaAzulAPI } from './contaAzulApi';

const prisma = new PrismaClient();

// Regra de negócio (confirmada pelo usuário em 2026-07-10, ver memória "regra_despesas_reais"):
// uma despesa só é "real" (conta pro caixa) se estiver Quitada/Paga.
//
// IMPORTANTE (2026-07-15, corrigido após dado real da API — não chutar de novo sem
// checar): o endpoint /financeiro/eventos-financeiros/contas-a-pagar/buscar usa o
// MESMO vocabulário de status de contas a receber — o rótulo de "pago" pra uma
// despesa é 'RECEBIDO' (status bruto "ACQUITTED" = quitado), não 'PAGO'/'QUITADO'.
// Confirmado inspecionando itens reais (ver [Sync][DIAG] nos logs). Mantemos
// PAGO/QUITADO/PAID como candidatos extras por segurança, caso apareçam variações.
//
// A parte de "whitelist de conta bancária" da regra original FOI REMOVIDA daqui:
// o campo `conta_financeira` simplesmente não vem nesse endpoint (confirmado: 0 de
// 8088 itens reais tinham esse campo) — o número de referência do usuário
// (R$ 6.246.089,02) veio do relatório "Extrato de Movimentação" do Conta Azul, que
// é uma fonte de dados diferente (movimentação bancária real, não a listagem de
// títulos a pagar). Precisa investigar de onde puxar conta bancária por título antes
// de reaplicar esse filtro — não reintroduzir sem validar contra dados reais de novo.
const STATUS_QUITADO = new Set(['RECEBIDO', 'PAGO', 'QUITADO', 'PAID']);
// Título parcialmente pago (ex.: fatura de cartão paga em parte) — a parte já paga
// (campo `pago`) é dinheiro que efetivamente saiu do caixa e deve contar, mesmo o
// título como um todo ainda não estar quitado. Confirmado com dado real 2026-07-15
// (ver [Sync][DIAG-VALOR]): excluir esses títulos por completo sub-contava despesas.
const STATUS_PARCIAL = new Set(['RECEBIDO_PARCIAL']);

function isDespesaReal(item: any): boolean {
    const status = (item.status_traduzido || '').toUpperCase();
    return STATUS_QUITADO.has(status) || STATUS_PARCIAL.has(status);
}

function valorPagoDoItem(item: any): number {
    const status = (item.status_traduzido || '').toUpperCase();
    if (STATUS_PARCIAL.has(status)) return Math.abs(item.pago || 0);
    return Math.abs(item.total || item.valor || 0);
}

export async function getAPI(): Promise<ContaAzulAPI> {
    const [accessCfg, refreshCfg] = await Promise.all([
        prisma.appConfig.findUnique({ where: { key: 'access_token_rj' } }),
        prisma.appConfig.findUnique({ where: { key: 'refresh_token_rj' } }),
    ]);

    return new ContaAzulAPI(
        accessCfg?.value || process.env.CONTA_AZUL_ACCESS_TOKEN_RJ || '',
        refreshCfg?.value || process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
        process.env.CONTA_AZUL_CLIENT_ID_RJ || '',
        process.env.CONTA_AZUL_CLIENT_SECRET_RJ || '',
    );
}

async function persistTokens(api: ContaAzulAPI): Promise<void> {
    await Promise.all([
        prisma.appConfig.upsert({
            where: { key: 'access_token_rj' },
            update: { value: api.getAccessToken() },
            create: { key: 'access_token_rj', value: api.getAccessToken() },
        }),
        prisma.appConfig.upsert({
            where: { key: 'refresh_token_rj' },
            update: { value: api.getRefreshTokenValue() },
            create: { key: 'refresh_token_rj', value: api.getRefreshTokenValue() },
        }),
    ]);
}

// A API retorna apenas 'RECEBIDO' (pago) e 'EM_ABERTO' (aberto).
// Para EM_ABERTO, usamos a data de vencimento para separar A Vencer / Vencido.
// Bug corrigido: a versão anterior não reconhecia 'RECEBIDO', classificando títulos
// pagos como Vencido por causa da data passada — inflando o total de inadimplência.
function mapStatus(statusTraduzido: string, dataVencimento: Date): string {
    const s = (statusTraduzido || '').toUpperCase();
    if (s === 'RECEBIDO' || s === 'PAGO' || s === 'PAID') return 'Pago';
    // EM_ABERTO: A Vencer se prazo futuro, Vencido se prazo já passou
    return dataVencimento < new Date() ? 'Vencido' : 'A Vencer';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function paginateAll(fetchFn: (page: number) => Promise<any>, onProgress?: (processados: number, total: number) => void): Promise<any[]> {
    const allItems: any[] = [];
    let page = 1;
    let totalRegistros = Infinity;

    while (allItems.length < totalRegistros) {
        // Delay entre páginas para respeitar o rate limit da API (máx ~5 req/burst)
        if (page > 1) await sleep(300);

        const data = await fetchFn(page);
        const items = data?.itens || [];
        if (items.length === 0) break;

        if (page === 1) totalRegistros = data?.itens_totais ?? items.length;

        allItems.push(...items);
        onProgress?.(allItems.length, totalRegistros);
        if (allItems.length >= totalRegistros) break;

        page++;
        if (page % 50 === 0) {
            console.log(`[Sync] Paginando... página ${page}, ${allItems.length}/${totalRegistros}`);
        }
    }
    return allItems;
}

// ── Progresso do sync em andamento (pra UI mostrar "X de Y — tempo estimado") ──
interface SyncProgress {
    modo: string;
    iniciadoEm: number;
    despesas: { processados: number; total: number };
    receitas: { processados: number; total: number };
}
let progressoAtual: SyncProgress | null = null;

export function getSyncStatus(): { emAndamento: boolean; modo?: string; processados?: number; total?: number; elapsedMs?: number; etaMs?: number | null } {
    if (!progressoAtual) return { emAndamento: false };

    const processados = progressoAtual.despesas.processados + progressoAtual.receitas.processados;
    // Enquanto a 1ª página de cada endpoint não voltou, o total ainda é "Infinity" — não estima nada ainda.
    const totalFinito = Number.isFinite(progressoAtual.despesas.total) && Number.isFinite(progressoAtual.receitas.total);
    const total = totalFinito ? progressoAtual.despesas.total + progressoAtual.receitas.total : undefined;
    const elapsedMs = Date.now() - progressoAtual.iniciadoEm;

    let etaMs: number | null = null;
    if (totalFinito && total! > 0 && processados > 0) {
        const taxaPorMs = processados / elapsedMs;
        etaMs = Math.max(0, Math.round((total! - processados) / taxaPorMs));
    }

    return { emAndamento: true, modo: progressoAtual.modo, processados, total, elapsedMs, etaMs };
}

function dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}

// Converte data da API ("2026-01-01" ou ISO completo) para MEIO-DIA UTC.
// Evita o bug de fuso: meia-noite UTC vira dia anterior no Brasil (UTC-3),
// jogando despesas do dia 1º para o mês/ano errado nos controllers que usam getMonth() local.
function parseApiDate(s?: string | null): Date {
    if (!s) return new Date();
    const datePart = s.split('T')[0]; // pega só YYYY-MM-DD
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return new Date(s);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// DIAGNÓSTICO TEMPORÁRIO (2026-07-15): dataPagamento hoje é vencimento/competência,
// não a data real de pagamento — suspeita de causar a diferença de ~R$31k que o
// usuário encontrou comparando um período igual no Conta Azul vs no sistema. Antes
// de mudar o campo de data usado (de novo: não chutar sem validar, ver memória
// "feedback_validar_antes_filtrar"), logamos o que a API realmente devolve pra
// título quitado. Remover depois de confirmado.
function logDiagnosticoDatas(quitados: any[], inicio: string, fim: string): void {
    const camposDataVistos = new Set<string>();
    let semCampoPagamento = 0;
    const candidatos = ['data_pagamento', 'data_baixa', 'data_liquidacao', 'data_quitacao', 'data_pagto'];

    quitados.forEach((item: any) => {
        const achou = candidatos.filter(k => item[k] !== undefined);
        if (achou.length === 0) semCampoPagamento++;
        achou.forEach(k => camposDataVistos.add(k));
    });

    console.log(`[Sync][DIAG-DATA] Período pedido (por data de pagamento): ${inicio} → ${fim}`);
    console.log('[Sync][DIAG-DATA] Campos de data-de-pagamento encontrados nos títulos quitados:', [...camposDataVistos]);
    console.log(`[Sync][DIAG-DATA] Títulos quitados sem nenhum desses campos: ${semCampoPagamento}/${quitados.length}`);
    if (quitados[0]) console.log('[Sync][DIAG-DATA] exemplo de título quitado (bruto):', JSON.stringify(quitados[0]));
}

// DIAGNÓSTICO TEMPORÁRIO (2026-07-15, 2ª rodada): mesmo com data de pagamento
// corrigida, o total da Diretoria continua batendo diferente do Conta Azul
// (sistema R$13.327,31 a menos, 01/01-30/06/2026). Duas hipóteses a testar antes
// de mexer em código de novo: (1) títulos RECEBIDO_PARCIAL têm uma parte já paga
// (`item.pago`) que hoje é 100% descartada por não serem "RECEBIDO"; (2) títulos
// com mais de um centro_de_custo têm o valor inteiro jogado só no primeiro CC do
// array, quando talvez devesse ser rateado. Remover depois de confirmado.
function logDiagnosticoValores(items: any[]): void {
    const parciais = items.filter((i: any) => (i.status_traduzido || '').toUpperCase() === 'RECEBIDO_PARCIAL');
    const somaPagoParciais = parciais.reduce((s: number, i: any) => s + Math.abs(i.pago || 0), 0);

    const multiCC = items.filter((i: any) => (i.centros_de_custo?.length || 0) > 1);

    console.log(`[Sync][DIAG-VALOR] Títulos RECEBIDO_PARCIAL no período: ${parciais.length}, soma do campo "pago": R$ ${somaPagoParciais.toFixed(2)}`);
    if (parciais[0]) console.log('[Sync][DIAG-VALOR] exemplo RECEBIDO_PARCIAL (bruto):', JSON.stringify(parciais[0]));

    console.log(`[Sync][DIAG-VALOR] Títulos com mais de 1 centro_de_custo: ${multiCC.length}/${items.length}`);
    if (multiCC[0]) console.log('[Sync][DIAG-VALOR] exemplo multi-CC (bruto):', JSON.stringify(multiCC[0]));
}

// A API ignora tamanhoPagina e sempre retorna 10 itens por página.
// Usamos itens_totais para controlar a paginação corretamente.
//
// Filtra por DATA DE PAGAMENTO (data_pagamento_de/ate) — é o que corresponde ao
// relatório "Análise de Pagamentos" do Conta Azul que o usuário usa como
// referência (buscar por vencimento inclui títulos cujo vencimento cai no período
// mas que foram pagos fora dele, e exclui o inverso). CONFIRMADO com a API real
// (2026-07-15): 'data_vencimento_de' é parâmetro obrigatório nesse endpoint —
// erro 400 "O parâmetro obrigatório 'data_vencimento_de' não foi informado" ao
// tentar mandar só data_pagamento. Por isso mandamos os dois: um vencimento bem
// largo (só pra satisfazer a obrigatoriedade) + o pagamento de verdade, que é
// quem decide o que entra no resultado.
const VENCIMENTO_ANCORA_INICIO = '2015-01-01'; // bem anterior a qualquer dado real do sistema
async function syncDespesas(api: ContaAzulAPI, inicio: string, fim: string, replace: boolean): Promise<number> {
    const vencimentoFimLargo = dateStr(new Date(new Date(`${fim}T00:00:00`).getFullYear() + 1, 11, 31));
    const items = await paginateAll(
        page => api.getContasAPagar({
            dataVencimentoInicio: VENCIMENTO_ANCORA_INICIO,
            dataVencimentoFim: vencimentoFimLargo,
            dataPagamentoInicio: inicio,
            dataPagamentoFim: fim,
            pagina: page,
            tamanhoPagina: 10,
        }),
        (processados, total) => { if (progressoAtual) progressoAtual.despesas = { processados, total }; }
    );

    if (items.length === 0) {
        console.log('[Sync] Nenhuma despesa retornada pela API.');
        return 0;
    }

    logDiagnosticoValores(items);

    const quitados = items.filter(isDespesaReal);
    logDiagnosticoDatas(quitados, inicio, fim);

    const records = quitados
        .map((item: any) => ({
            tipo: 'DESPESA',
            descricao: item.descricao || 'Sem descrição',
            categoria: item.categorias?.[0]?.nome || 'Sem Categoria',
            centroDeCusto: item.centros_de_custo?.[0]?.nome || 'Geral',
            contaBancaria: item.conta_financeira?.nome || 'N/A',
            // Prefere a data real de pagamento se a API devolver o campo; senão cai no
            // comportamento antigo (vencimento/competência) sem quebrar nada.
            dataPagamento: parseApiDate(item.data_pagamento || item.data_vencimento || item.data_competencia),
            valor: valorPagoDoItem(item),
            fornecedor: item.fornecedor?.nome || 'Diverso',
        }))
        .filter((r: any) => r.valor > 0);

    console.log(`[Sync] Despesas: ${records.length}/${items.length} títulos quitados (de um total de ${items.length} buscados no período).`);

    if (replace) {
        await prisma.lancamento.deleteMany({ where: { tipo: 'DESPESA' } });
    } else {
        // Incremental: remove só o período buscado antes de re-inserir
        await prisma.lancamento.deleteMany({
            where: { tipo: 'DESPESA', dataPagamento: { gte: new Date(inicio), lte: new Date(fim) } }
        });
    }
    if (records.length > 0) await prisma.lancamento.createMany({ data: records });
    return records.length;
}

async function syncReceitas(api: ContaAzulAPI, inicio: string, fim: string, replace: boolean): Promise<number> {
    const items = await paginateAll(
        page => api.getContasAReceber({ dataVencimentoInicio: inicio, dataVencimentoFim: fim, pagina: page, tamanhoPagina: 10 }),
        (processados, total) => { if (progressoAtual) progressoAtual.receitas = { processados, total }; }
    );

    if (items.length === 0) {
        console.log('[Sync] Nenhuma receita retornada pela API.');
        return 0;
    }

    const records = items
        .map((item: any) => {
            const dataVenc = parseApiDate(item.data_vencimento);
            return {
                cliente: item.cliente?.nome || 'Sem cliente',
                grupo: item.centros_de_custo?.[0]?.nome || 'Sem Grupo',
                categoria: item.categorias?.[0]?.nome || 'Outras Receitas',
                dataCompetencia: item.data_competencia ? parseApiDate(item.data_competencia) : null,
                dataVencimento: dataVenc,
                valor: Math.abs(
                    item.status_traduzido === 'RECEBIDO'
                        ? (item.total ?? 0)
                        : (item.nao_pago ?? item.total ?? 0)
                ),
                status: mapStatus(item.status_traduzido || '', dataVenc),
                descricao: item.descricao || '',
                numeroNotaFiscal: item.numero_nota_fiscal || '',
            };
        })
        .filter((r: any) => r.valor > 0);

    if (replace) {
        await prisma.contaReceber.deleteMany();
    } else {
        await prisma.contaReceber.deleteMany({
            where: { dataVencimento: { gte: new Date(inicio), lte: new Date(fim) } }
        });
    }
    if (records.length > 0) await prisma.contaReceber.createMany({ data: records });
    return records.length;
}

async function syncSaldosBancarios(api: ContaAzulAPI): Promise<number> {
    const data = await api.getContasFinanceiras();
    const items = data?.itens || [];

    if (items.length === 0) {
        console.log('[Sync] Nenhuma conta financeira retornada pela API.');
        return 0;
    }

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    await prisma.saldoBancario.deleteMany({ where: { data: { gte: inicioMes } } });

    const records = items.map((item: any) => ({
        instituicao: item.nome || item.descricao || 'Conta',
        saldo: item.saldo ?? 0,
        data: hoje,
    }));

    await prisma.saldoBancario.createMany({ data: records });
    return records.length;
}

// Trava simples: evita duas sincronizações rodando ao mesmo tempo (deleteMany +
// createMany de duas execuções concorrentes duplicaria/corromperia os dados).
// Um sync completo pode levar bem mais que o timeout do navegador/proxy — se o
// usuário achar que "falhou" e tentar de novo, a segunda tentativa cai aqui em
// vez de competir pelas mesmas tabelas.
let syncEmAndamento: string | null = null;

function iniciarSync(modo: string): { success: boolean; message: string } | null {
    if (syncEmAndamento) {
        return { success: false, message: `Já existe uma sincronização (${syncEmAndamento}) em andamento. Aguarde ela terminar antes de iniciar outra — pode levar vários minutos, não é necessário tentar de novo.` };
    }
    syncEmAndamento = modo;
    progressoAtual = {
        modo,
        iniciadoEm: Date.now(),
        despesas: { processados: 0, total: Infinity },
        receitas: { processados: 0, total: Infinity },
    };
    return null;
}

function finalizarSync(): void {
    syncEmAndamento = null;
    progressoAtual = null;
}

// Roda os 3 syncs com Promise.allSettled (não Promise.all) de propósito: se
// syncDespesas falhar rápido, Promise.all rejeitaria na hora e devolveria o
// controle pro caller — mas syncReceitas/syncSaldosBancarios continuariam
// rodando em segundo plano, órfãos, sem ninguém aguardando. Como a trava
// (syncEmAndamento) é liberada assim que a função retorna, uma nova tentativa
// do usuário destravaria na hora e colidiria com esses syncs órfãos ainda
// fazendo deleteMany/createMany nas mesmas tabelas. allSettled garante que só
// saímos daqui (e só liberamos a trava) depois que os 3 realmente terminaram.
async function executarTresSyncs(api: ContaAzulAPI, inicio: string, fim: string, replace: boolean): Promise<{ despesas: number; receitas: number; saldos: number }> {
    const resultados = await Promise.allSettled([
        syncDespesas(api, inicio, fim, replace),
        syncReceitas(api, inicio, fim, replace),
        syncSaldosBancarios(api),
    ]);

    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (falhas.length > 0) {
        throw new Error(falhas.map(f => f.reason?.message || String(f.reason)).join(' | '));
    }

    const [despesas, receitas, saldos] = resultados.map(r => (r as PromiseFulfilledResult<number>).value);
    return { despesas, receitas, saldos };
}

// Modo incremental: últimos 60 dias + próximos 90 (rápido, ~200-400 registros)
export async function runIncrementalSync(): Promise<{ success: boolean; message: string; details?: any }> {
    const bloqueado = iniciarSync('incremental');
    if (bloqueado) return bloqueado;
    try {
        console.log('[Sync] ⚡ Iniciando sincronização incremental...');
        const api = await getAPI();
        await api.tryRefreshToken();

        const hoje = new Date();
        const inicio = dateStr(new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000));  // 60 dias atrás
        const fim    = dateStr(new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000));  // 90 dias à frente

        const { despesas, receitas, saldos } = await executarTresSyncs(api, inicio, fim, false);

        await persistTokens(api);
        const details = { despesas, receitas, saldos, modo: 'incremental', janela: `${inicio} → ${fim}` };
        console.log('[Sync] ✅ Incremental concluído:', details);
        return { success: true, message: 'Sincronização incremental concluída!', details };
    } catch (error: any) {
        console.error('[Sync] ❌ Falha:', error.message);
        return { success: false, message: error.message || 'Erro desconhecido' };
    } finally {
        finalizarSync();
    }
}

// Modo período específico: janela escolhida pelo usuário (ex.: reprocessar um mês
// depois de corrigir um centro de custo no Conta Azul). Mesmo comportamento do
// incremental — deleta e reinsere só a janela pedida — mas com datas livres.
export async function runCustomSync(inicio: string, fim: string): Promise<{ success: boolean; message: string; details?: any }> {
    const bloqueado = iniciarSync('período específico');
    if (bloqueado) return bloqueado;
    try {
        console.log(`[Sync] 🗓️ Iniciando sincronização de período (${inicio} → ${fim})...`);
        const api = await getAPI();
        await api.tryRefreshToken();

        const { despesas, receitas, saldos } = await executarTresSyncs(api, inicio, fim, false);

        await persistTokens(api);
        const details = { despesas, receitas, saldos, modo: 'custom', janela: `${inicio} → ${fim}` };
        console.log('[Sync] ✅ Período concluído:', details);
        return { success: true, message: 'Sincronização do período concluída!', details };
    } catch (error: any) {
        console.error('[Sync] ❌ Falha:', error.message);
        return { success: false, message: error.message || 'Erro desconhecido' };
    } finally {
        finalizarSync();
    }
}

// Modo full: 2 anos completos (histórico para os relatórios comparativos — pode levar alguns minutos)
export async function runFullSync(): Promise<{ success: boolean; message: string; details?: any }> {
    const bloqueado = iniciarSync('completa (2 anos)');
    if (bloqueado) return bloqueado;
    try {
        console.log('[Sync] 🔄 Iniciando sincronização completa (2 anos)...');
        const api = await getAPI();
        await api.tryRefreshToken();

        const hoje = new Date();
        const inicio = `${hoje.getFullYear() - 1}-01-01`;   // início do ano anterior
        const fim    = `${hoje.getFullYear() + 1}-12-31`;   // fim do próximo ano

        const { despesas, receitas, saldos } = await executarTresSyncs(api, inicio, fim, true);

        await persistTokens(api);
        const details = { despesas, receitas, saldos, modo: 'full', janela: `${inicio} → ${fim}` };
        console.log('[Sync] ✅ Full concluído:', details);
        return { success: true, message: 'Sincronização completa concluída!', details };
    } catch (error: any) {
        console.error('[Sync] ❌ Falha:', error.message);
        return { success: false, message: error.message || 'Erro desconhecido' };
    } finally {
        finalizarSync();
    }
}
