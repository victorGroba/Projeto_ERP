import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { STATUS_RECEITA } from '../utils/statusReceita';
import { sincronizarClientes } from '../services/clientesService';

const prisma = new PrismaClient();

const normalize = (value: string | null | undefined) =>
    (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function parseDate(value: unknown, endOfDay = false): Date | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}-03:00`);
}

export async function syncClientes(_req: Request, res: Response): Promise<void> {
    try {
        const result = await sincronizarClientes();
        res.json({
            success: true,
            message: `${result.quantidade} cadastros sincronizados; ${result.comCodigo} com código.`,
            ...result,
        });
    } catch (error: any) {
        console.error('[Clientes] Falha ao sincronizar:', error.message);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message || 'Falha ao sincronizar clientes.' });
    }
}

export async function getVisaoClientes(req: Request, res: Response): Promise<void> {
    const de = parseDate(req.query.de);
    const ate = parseDate(req.query.ate, true);
    if (!de || !ate || de > ate) {
        res.status(400).json({ message: 'Informe um período válido em de e ate (YYYY-MM-DD).' });
        return;
    }

    try {
        const [clientes, titulos] = await Promise.all([
            prisma.clienteContaAzul.findMany({ orderBy: [{ codigo: 'asc' }, { nome: 'asc' }] }),
            prisma.contaReceber.findMany({
                where: { dataVencimento: { gte: de, lte: ate } },
                select: { clienteId: true, cliente: true, valor: true, status: true },
            }),
        ]);

        const porId = new Map(clientes.map(c => [c.id, c]));
        const porNome = new Map<string, typeof clientes[number]>();
        clientes.forEach(c => {
            [c.nome, c.nomeEmpresa].filter(Boolean).forEach(nome => porNome.set(normalize(nome), c));
        });

        type LinhaCliente = {
            id: string; codigo: string | null; nome: string; nomeEmpresa: string | null;
            documento: string | null; email: string | null; cidade: string | null; uf: string | null;
            ativo: boolean; faturamento: number; recebido: number; aberto: number; titulos: number;
        };
        const linhas = new Map<string, LinhaCliente>();
        clientes.forEach(c => linhas.set(c.id, {
            id: c.id, codigo: c.codigo, nome: c.nome, nomeEmpresa: c.nomeEmpresa,
            documento: c.documento, email: c.email, cidade: c.cidade, uf: c.uf, ativo: c.ativo,
            faturamento: 0, recebido: 0, aberto: 0, titulos: 0,
        }));

        titulos.forEach(titulo => {
            const cadastro = (titulo.clienteId && porId.get(titulo.clienteId)) || porNome.get(normalize(titulo.cliente));
            const key = cadastro?.id || `nao-vinculado:${normalize(titulo.cliente)}`;
            if (!linhas.has(key)) linhas.set(key, {
                id: key, codigo: null, nome: titulo.cliente, nomeEmpresa: null,
                documento: null, email: null, cidade: null, uf: null, ativo: true,
                faturamento: 0, recebido: 0, aberto: 0, titulos: 0,
            });
            const linha = linhas.get(key)!;
            linha.faturamento += titulo.valor;
            linha.titulos++;
            if (titulo.status === STATUS_RECEITA.PAGO) linha.recebido += titulo.valor;
            else linha.aberto += titulo.valor;
        });

        const gruposMap = new Map<string, { codigo: string | null; clientes: LinhaCliente[]; faturamento: number; recebido: number; aberto: number; titulos: number }>();
        linhas.forEach(cliente => {
            const codigo = cliente.codigo?.trim() || null;
            const key = codigo ? `codigo:${normalize(codigo)}` : `cliente:${cliente.id}`;
            if (!gruposMap.has(key)) gruposMap.set(key, { codigo, clientes: [], faturamento: 0, recebido: 0, aberto: 0, titulos: 0 });
            const grupo = gruposMap.get(key)!;
            grupo.clientes.push(cliente);
            grupo.faturamento += cliente.faturamento;
            grupo.recebido += cliente.recebido;
            grupo.aberto += cliente.aberto;
            grupo.titulos += cliente.titulos;
        });

        const busca = normalize(typeof req.query.busca === 'string' ? req.query.busca : '');
        const grupos = [...gruposMap.values()]
            .filter(g => !busca || normalize(g.codigo).includes(busca) || g.clientes.some(c =>
                [c.nome, c.nomeEmpresa, c.documento, c.email].some(v => normalize(v).includes(busca))))
            .sort((a, b) => b.faturamento - a.faturamento)
            .map(g => ({ ...g, clientes: g.clientes.sort((a, b) => b.faturamento - a.faturamento) }));

        res.json({
            periodo: { de: req.query.de, ate: req.query.ate },
            atualizadoEm: clientes.reduce<Date | null>((latest, c) => !latest || c.sincronizadoEm > latest ? c.sincronizadoEm : latest, null),
            resumo: {
                cadastros: clientes.length,
                grupos: grupos.filter(g => g.codigo).length,
                faturamento: grupos.reduce((sum, g) => sum + g.faturamento, 0),
                recebido: grupos.reduce((sum, g) => sum + g.recebido, 0),
                aberto: grupos.reduce((sum, g) => sum + g.aberto, 0),
            },
            grupos,
        });
    } catch (error: any) {
        console.error('[Clientes] Falha ao montar visão:', error.message);
        res.status(500).json({ message: 'Não foi possível carregar a visão de clientes.' });
    }
}
