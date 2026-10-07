import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { STATUS_RECEITA } from '../utils/statusReceita';
import { sincronizarClientes } from '../services/clientesService';

const prisma = new PrismaClient();

const normalize = (value: string | null | undefined) =>
    (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const digits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

// Sucessoes/alteracoes cadastrais em que o CNPJ antigo precisa permanecer nas
// notas fiscais, mas os valores devem acompanhar o grupo economico atual.
const ALIASES_CLIENTES = [
    {
        documentosOrigem: new Set(['29435005005279']),
        nomesOrigem: [/(^|\s)esho(\s|$)/],
        codigoDestino: 'AMICO SAUDE',
    },
];

function codigoDestinoAlias(documento: string | null | undefined, nome: string | null | undefined): string | null {
    const documentoNormalizado = digits(documento);
    const nomeNormalizado = normalize(nome);
    const alias = ALIASES_CLIENTES.find(regra =>
        regra.documentosOrigem.has(documentoNormalizado)
        || regra.nomesOrigem.some(padrao => padrao.test(nomeNormalizado)));
    return alias?.codigoDestino || null;
}

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
function monthKeysBetween(startBR: Date, endBR: Date): string[] {
    // Os limites vem de parseDate (horario de Brasilia); 30/06 23:59 -03 ja e julho em UTC.
    const start = new Date(startBR.getTime() - 3 * 60 * 60 * 1000);
    const end = new Date(endBR.getTime() - 3 * 60 * 60 * 1000);
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));
    const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 12));
    while (cursor <= limit) {
        keys.push(monthKey(cursor));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
}

function parseDate(value: unknown, endOfDay = false): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}-03:00`);
}

// Mesmo dia, um ano antes; 29/02 vira 28/02 para nao saltar para marco.
function shiftYearISO(value: string): string {
    const [ano, mes, dia] = value.split('-').map(Number);
    const ultimoDia = new Date(Date.UTC(ano - 1, mes, 0)).getUTCDate();
    return `${ano - 1}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

// Competencias sao gravadas a meia-noite de Brasilia; o mes e lido nesse fuso.
const monthKeyBR = (date: Date) => monthKey(new Date(date.getTime() - 3 * 60 * 60 * 1000));

interface ClientesSyncStatus {
    emAndamento: boolean;
    iniciadoEm?: string;
    finalizadoEm?: string;
    processados: number;
    total: number;
    message?: string;
    error?: string;
}

let clientesSyncStatus: ClientesSyncStatus = { emAndamento: false, processados: 0, total: 0 };

export function getClientesSyncStatus(_req: Request, res: Response): void {
    res.json(clientesSyncStatus);
}

export async function syncClientes(_req: Request, res: Response): Promise<void> {
    if (clientesSyncStatus.emAndamento) {
        res.status(202).json({ success: true, message: 'A sincronização de clientes já está em andamento.', ...clientesSyncStatus });
        return;
    }

    clientesSyncStatus = {
        emAndamento: true,
        iniciadoEm: new Date().toISOString(),
        processados: 0,
        total: 0,
    };

    // Responde imediatamente para não estourar o timeout do proxy enquanto os
    // detalhes de cada cliente são consultados em segundo plano.
    res.status(202).json({ success: true, message: 'Sincronização de clientes iniciada.', ...clientesSyncStatus });

    void sincronizarClientes((processados, total) => {
        clientesSyncStatus = { ...clientesSyncStatus, processados, total };
    }).then(result => {
        const message = `${result.quantidade} cadastros sincronizados; ${result.comCodigo} com código.`;
        clientesSyncStatus = {
            ...clientesSyncStatus,
            emAndamento: false,
            finalizadoEm: new Date().toISOString(),
            processados: result.quantidade,
            total: result.quantidade,
            message,
        };
        console.log(`[Clientes] ✅ ${message}`);
    }).catch((error: any) => {
        const message = error.response?.data?.message || error.message || 'Falha ao sincronizar clientes.';
        console.error('[Clientes] Falha ao sincronizar:', message);
        clientesSyncStatus = {
            ...clientesSyncStatus,
            emAndamento: false,
            finalizadoEm: new Date().toISOString(),
            error: message,
        };
    });
}

export async function getVisaoClientes(req: Request, res: Response): Promise<void> {
    const de = parseDate(req.query.de);
    const ate = parseDate(req.query.ate, true);
    if (!de || !ate || de > ate) {
        res.status(400).json({ message: 'Informe um período válido em de e ate (YYYY-MM-DD).' });
        return;
    }

    // Periodo de comparacao: por padrao, o mesmo intervalo um ano antes.
    const de2Str = typeof req.query.de2 === 'string' && req.query.de2 ? req.query.de2 : shiftYearISO(String(req.query.de));
    const ate2Str = typeof req.query.ate2 === 'string' && req.query.ate2 ? req.query.ate2 : shiftYearISO(String(req.query.ate));
    const de2 = parseDate(de2Str);
    const ate2 = parseDate(ate2Str, true);
    if (!de2 || !ate2 || de2 > ate2) {
        res.status(400).json({ message: 'Informe um período de comparação válido em de2 e ate2 (YYYY-MM-DD).' });
        return;
    }

    try {
        const selectNota = {
            numero: true,
            clienteDocumento: true,
            clienteNome: true,
            valorBruto: true,
            dataCompetencia: true,
        } as const;
        const [clientes, titulos, notasFiscais, notasAnteriores, importacoesFiscais] = await Promise.all([
            prisma.clienteContaAzul.findMany({ orderBy: [{ codigo: 'asc' }, { nome: 'asc' }] }),
            prisma.contaReceber.findMany({
                where: {
                    OR: [
                        // Faturamento bruto pertence ao periodo de emissao/competencia,
                        // independentemente de quando venceu ou foi recebido.
                        { dataCompetencia: { gte: de, lte: ate } },
                        // Compatibilidade temporaria com cargas antigas/CSV que nao
                        // possuam competencia; desaparece apos nova sincronizacao.
                        { dataCompetencia: null, dataVencimento: { gte: de, lte: ate } },
                    ],
                },
                select: {
                    clienteId: true,
                    cliente: true,
                    valor: true,
                    valorTotal: true,
                    valorPago: true,
                    valorAberto: true,
                    status: true,
                },
            }),
            prisma.notaFiscalServico.findMany({ where: { dataCompetencia: { gte: de, lte: ate } }, select: selectNota }),
            prisma.notaFiscalServico.findMany({ where: { dataCompetencia: { gte: de2, lte: ate2 } }, select: selectNota }),
            prisma.importacaoFiscal.findMany({ orderBy: { competencia: 'desc' } }),
        ]);

        const porId = new Map(clientes.map(c => [c.id, c]));
        const porDocumento = new Map<string, typeof clientes[number]>();
        const porNome = new Map<string, typeof clientes[number]>();
        const porCodigo = new Map<string, typeof clientes[number]>();
        clientes.forEach(c => {
            const documento = digits(c.documento);
            if (documento) porDocumento.set(documento, c);
            [c.nome, c.nomeEmpresa].filter(Boolean).forEach(nome => porNome.set(normalize(nome), c));
            if (c.codigo) porCodigo.set(normalize(c.codigo), c);
        });

        const cadastroPorAlias = (documento: string | null | undefined, nome: string | null | undefined) => {
            const codigoDestino = codigoDestinoAlias(documento, nome);
            return codigoDestino ? porCodigo.get(normalize(codigoDestino)) : undefined;
        };

        const cadastroNotaFiscal = (documento: string, nome: string) =>
            cadastroPorAlias(documento, nome)
            || porDocumento.get(documento)
            || porNome.get(normalize(nome));

        type LinhaCliente = {
            id: string; codigo: string | null; nome: string; nomeEmpresa: string | null;
            documento: string | null; email: string | null; cidade: string | null; uf: string | null;
            ativo: boolean; faturamento: number; recebido: number; aberto: number; titulos: number;
            faturamentoAnterior: number; titulosAnterior: number;
        };
        const linhas = new Map<string, LinhaCliente>();
        clientes.forEach(c => linhas.set(c.id, {
            id: c.id, codigo: c.codigo, nome: c.nome, nomeEmpresa: c.nomeEmpresa,
            documento: c.documento, email: c.email, cidade: c.cidade, uf: c.uf, ativo: c.ativo,
            faturamento: 0, recebido: 0, aberto: 0, titulos: 0, faturamentoAnterior: 0, titulosAnterior: 0,
        }));

        const mesesImportados = new Set(importacoesFiscais.map(item => monthKey(item.competencia)));

        titulos.forEach(titulo => {
            const cadastroOriginal = (titulo.clienteId && porId.get(titulo.clienteId)) || porNome.get(normalize(titulo.cliente));
            const cadastro = cadastroPorAlias(cadastroOriginal?.documento, cadastroOriginal?.nome || titulo.cliente)
                || cadastroOriginal;
            const key = cadastro?.id || `nao-vinculado:${normalize(titulo.cliente)}`;
            if (!linhas.has(key)) linhas.set(key, {
                id: key, codigo: null, nome: titulo.cliente, nomeEmpresa: null,
                documento: null, email: null, cidade: null, uf: null, ativo: true,
                faturamento: 0, recebido: 0, aberto: 0, titulos: 0, faturamentoAnterior: 0, titulosAnterior: 0,
            });
            const linha = linhas.get(key)!;
            const recebido = titulo.valorPago ?? (titulo.status === STATUS_RECEITA.PAGO ? titulo.valor : 0);
            const aberto = titulo.valorAberto ?? (titulo.status === STATUS_RECEITA.PAGO ? 0 : titulo.valor);
            linha.recebido += recebido;
            linha.aberto += aberto;

        });

        const linhaDaNota = (nota: typeof notasFiscais[number]) => {
            const cadastro = cadastroNotaFiscal(nota.clienteDocumento, nota.clienteNome);
            const key = cadastro?.id || `nao-vinculado-fiscal:${nota.clienteDocumento || normalize(nota.clienteNome)}`;
            if (!linhas.has(key)) linhas.set(key, {
                id: key, codigo: null, nome: nota.clienteNome, nomeEmpresa: null,
                documento: nota.clienteDocumento || null, email: null, cidade: null, uf: null, ativo: true,
                faturamento: 0, recebido: 0, aberto: 0, titulos: 0, faturamentoAnterior: 0, titulosAnterior: 0,
            });
            return linhas.get(key)!;
        };

        notasFiscais.forEach(nota => {
            const linha = linhaDaNota(nota);
            linha.faturamento += nota.valorBruto;
            linha.titulos++;
        });
        notasAnteriores.forEach(nota => {
            const linha = linhaDaNota(nota);
            linha.faturamentoAnterior += nota.valorBruto;
            linha.titulosAnterior++;
        });

        type Grupo = {
            codigo: string | null; clientes: LinhaCliente[]; faturamento: number; recebido: number; aberto: number; titulos: number;
            faturamentoAnterior: number; titulosAnterior: number;
        };
        const gruposMap = new Map<string, Grupo>();
        linhas.forEach(cliente => {
            const codigo = cliente.codigo?.trim() || null;
            const key = codigo ? `codigo:${normalize(codigo)}` : `cliente:${cliente.id}`;
            if (!gruposMap.has(key)) gruposMap.set(key, {
                codigo, clientes: [], faturamento: 0, recebido: 0, aberto: 0, titulos: 0, faturamentoAnterior: 0, titulosAnterior: 0,
            });
            const grupo = gruposMap.get(key)!;
            grupo.clientes.push(cliente);
            grupo.faturamento += cliente.faturamento;
            grupo.recebido += cliente.recebido;
            grupo.aberto += cliente.aberto;
            grupo.titulos += cliente.titulos;
            grupo.faturamentoAnterior += cliente.faturamentoAnterior;
            grupo.titulosAnterior += cliente.titulosAnterior;
        });

        const busca = normalize(typeof req.query.busca === 'string' ? req.query.busca : '');
        const grupos = [...gruposMap.values()]
            .filter(g => !busca || normalize(g.codigo).includes(busca) || g.clientes.some(c =>
                [c.nome, c.nomeEmpresa, c.documento, c.email].some(v => normalize(v).includes(busca))))
            .sort((a, b) => b.faturamento - a.faturamento || b.faturamentoAnterior - a.faturamentoAnterior)
            .map(g => ({ ...g, clientes: g.clientes.sort((a, b) => b.faturamento - a.faturamento || b.faturamentoAnterior - a.faturamentoAnterior) }));

        const mesesEsperados = monthKeysBetween(de, ate);
        const mesesImportadosNoPeriodo = mesesEsperados.filter(mes => mesesImportados.has(mes));
        const mesesAusentes = mesesEsperados.filter(mes => !mesesImportados.has(mes));
        const mesesComparacao = monthKeysBetween(de2, ate2);

        // Serie mes a mes alinhada pela posicao: 1o mes do periodo com o 1o mes da comparacao.
        const somaPorMes = (notas: typeof notasFiscais) => notas.reduce((acc, nota) => {
            const mes = monthKeyBR(nota.dataCompetencia);
            acc.set(mes, (acc.get(mes) || 0) + nota.valorBruto);
            return acc;
        }, new Map<string, number>());
        const porMesAtual = somaPorMes(notasFiscais);
        const porMesAnterior = somaPorMes(notasAnteriores);
        const serieMensal = Array.from({ length: Math.max(mesesEsperados.length, mesesComparacao.length) }, (_, i) => ({
            mes: mesesEsperados[i] || null,
            mesAnterior: mesesComparacao[i] || null,
            atual: mesesEsperados[i] ? porMesAtual.get(mesesEsperados[i]) || 0 : null,
            anterior: mesesComparacao[i] ? porMesAnterior.get(mesesComparacao[i]) || 0 : null,
        }));

        res.json({
            periodo: { de: req.query.de, ate: req.query.ate },
            atualizadoEm: [
                clientes.reduce<Date | null>((latest, c) => !latest || c.sincronizadoEm > latest ? c.sincronizadoEm : latest, null),
                importacoesFiscais[0]?.createdAt || null,
            ].reduce<Date | null>((latest, date) => date && (!latest || date > latest) ? date : latest, null),
            fiscal: {
                mesesImportados: mesesImportadosNoPeriodo,
                mesesEsperados,
                mesesAusentes,
                notasNoPeriodo: notasFiscais.length,
                naoConciliadasNoPeriodo: notasFiscais.filter(nota =>
                    !cadastroNotaFiscal(nota.clienteDocumento, nota.clienteNome)).length,
                ultimaImportacao: importacoesFiscais[0]?.createdAt || null,
            },
            comparacao: {
                de: de2Str,
                ate: ate2Str,
                mesesEsperados: mesesComparacao,
                mesesImportados: mesesComparacao.filter(mes => mesesImportados.has(mes)),
                mesesAusentes: mesesComparacao.filter(mes => !mesesImportados.has(mes)),
                notasNoPeriodo: notasAnteriores.length,
                faturamento: grupos.reduce((sum, g) => sum + g.faturamentoAnterior, 0),
            },
            serieMensal,
            resumo: {
                cadastros: clientes.length,
                grupos: grupos.filter(g => g.codigo).length,
                semCodigo: grupos.filter(g => !g.codigo && g.faturamento > 0).length,
                faturamentoSemCodigo: grupos.filter(g => !g.codigo).reduce((sum, g) => sum + g.faturamento, 0),
                faturamento: grupos.reduce((sum, g) => sum + g.faturamento, 0),
                recebido: grupos.reduce((sum, g) => sum + g.recebido, 0),
                aberto: grupos.reduce((sum, g) => sum + g.aberto, 0),
                titulos: grupos.reduce((sum, g) => sum + g.titulos, 0),
            },
            grupos,
        });
    } catch (error: any) {
        console.error('[Clientes] Falha ao montar visão:', error.message);
        res.status(500).json({ message: 'Não foi possível carregar a visão de clientes.' });
    }
}
