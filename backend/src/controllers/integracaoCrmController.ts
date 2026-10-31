import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { construirIndiceClientes } from './clientesController';
import { estadoNfseApi } from '../services/nfseApiSyncService';

const prisma = new PrismaClient();

const digits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');
const STATUS_EMITIDA = new Set(['EMITIDA', 'CORRIGIDA_SUCESSO']);

/**
 * Cadastro do Conta Azul (com o `codigo` de grupo) e NFS-e emitidas, para a
 * conferencia "executado x faturado" do CRM. So leitura.
 *
 * O grupo de cada nota sai daqui, pela mesma regra da tela Clientes & Grupos
 * (alias -> documento -> nome do tomador), para o CRM e o BI nunca
 * discordarem sobre a que grupo uma nota pertence.
 *
 * `desde` (YYYY-MM-DD) filtra as notas pela competencia; o cadastro vem
 * sempre inteiro (~1.600 linhas).
 *
 * Duas fontes de nota: o CSV da prefeitura (fechamento do mes, valor bruto) e
 * a API do Conta Azul (lida a cada poucas horas, valor liquido das retencoes).
 * O CSV manda no que ja trouxe; da API entram so as notas emitidas que o CSV
 * ainda nao tem (`fonte: 'API'`, `valorLiquido: true`), e uma nota do CSV
 * cancelada depois da exportacao sai da lista.
 */
export const getFaturamentoParaCrm = async (req: Request, res: Response) => {
    try {
        const desdeParam = typeof req.query.desde === 'string' ? req.query.desde : '';
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(desdeParam) ? new Date(`${desdeParam}T00:00:00-03:00`) : new Date('2025-01-01T00:00:00-03:00');

        const indice = await construirIndiceClientes();
        const notas = await prisma.notaFiscalServico.findMany({
            where: { dataCompetencia: { gte: desde } },
            orderBy: { dataCompetencia: 'asc' },
        });
        const ultimaImportacao = await prisma.importacaoFiscal.findFirst({ orderBy: { competencia: 'desc' }, select: { competencia: true, createdAt: true } });
        const [notasApi, estadoApi] = await Promise.all([
            prisma.notaFiscalServicoApi.findMany({ where: { dataCompetencia: { gte: desde } } }),
            estadoNfseApi(),
        ]);
        const semZeros = (numero: string) => numero.replace(/^0+/, '');
        const statusApi = new Map(notasApi.map(n => [semZeros(n.numero), n.status]));
        const numerosCsv = new Set(notas.map(n => semZeros(n.numero)));
        // Todas as notas do CSV sao do mesmo prestador (Conta Azul RJ); a nota que
        // so existe na API herda esse documento para casar com a chave do CRM.
        const prestadorCsv = notas.length ? digits(notas[notas.length - 1].prestadorDocumento) : '';
        const soNaApi = notasApi.filter(n => STATUS_EMITIDA.has(n.status) && !numerosCsv.has(semZeros(n.numero)));

        res.json({
            origem: 'CONTA_AZUL_RJ',
            geradoEm: new Date().toISOString(),
            ultimaCompetenciaImportada: ultimaImportacao?.competencia.toISOString() ?? null,
            clientes: indice.clientes.map(c => ({
                id: c.id,
                documento: digits(c.documento) || null,
                nome: c.nome,
                nomeEmpresa: c.nomeEmpresa,
                grupo: c.codigo?.trim() || null,
                ativo: c.ativo,
            })),
            ultimaLeituraApi: estadoApi.ultimoOk?.em ?? null,
            erroApi: estadoApi.ultimoErro ?? null,
            notas: [
                ...notas.filter(n => statusApi.get(semZeros(n.numero)) !== 'CANCELADA').map(n => {
                const cadastro = indice.cadastroNotaFiscal(digits(n.clienteDocumento), n.clienteNome);
                return {
                    numero: n.numero,
                    prestadorDocumento: digits(n.prestadorDocumento),
                    tomadorDocumento: digits(n.clienteDocumento),
                    tomadorNome: n.clienteNome,
                    grupo: cadastro?.codigo?.trim() || null,
                    dataEmissao: n.dataEmissao.toISOString(),
                    competencia: n.dataCompetencia.toISOString(),
                    valorBruto: n.valorBruto,
                    valorLiquido: false,
                    fonte: 'CSV',
                    descricao: n.descricaoServico,
                };
                }),
                ...soNaApi.map(n => {
                    const cadastro = indice.cadastroNotaFiscal(n.clienteDocumento, n.clienteNome);
                    return {
                        numero: n.numero,
                        prestadorDocumento: prestadorCsv,
                        tomadorDocumento: n.clienteDocumento,
                        tomadorNome: n.clienteNome,
                        grupo: cadastro?.codigo?.trim() || null,
                        dataEmissao: (n.dataEmissao ?? n.dataCompetencia).toISOString(),
                        competencia: n.dataCompetencia.toISOString(),
                        valorBruto: n.valorLiquido,
                        valorLiquido: true,
                        fonte: 'API',
                        descricao: null,
                    };
                }),
            ],
        });
    } catch (error) {
        console.error('[integracao/crm/faturamento] Erro:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};
