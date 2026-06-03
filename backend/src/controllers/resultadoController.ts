import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Categorias especiais para o bloco "Outras Saídas" (DRE)
const matchDepJud   = (c: string) => /dep[óo]sito judicial/i.test(c);
const matchImobiliz = (c: string) => /imobiliz|m[áa]quinas, equipamentos e instala/i.test(c);
const matchDistLuc  = (c: string) => /antecipa[çc][ãa]o de lucros|distrib\. l\.|distribui[çc][ãa]o de lucro/i.test(c);

// É despesa "operacional"? (exclui os itens que vão pro bloco Outras Saídas)
const isOperacional = (c: string) => !matchDepJud(c) && !matchImobiliz(c) && !matchDistLuc(c);

/**
 * 1) Resultado Financeiro Mensal — Receitas − Despesas OPERACIONAIS, mês a mês.
 *    (distribuição de lucros, imobilizações e depósito judicial ficam em "Outras Saídas")
 */
export const getResultadoMensal = async (req: Request, res: Response): Promise<void> => {
    try {
        const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
        const inicio = new Date(year, 0, 1);
        const fim = new Date(year + 1, 0, 1);

        const [despesas, receitas] = await Promise.all([
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicio, lt: fim } },
                select: { dataPagamento: true, valor: true, categoria: true },
            }),
            prisma.contaReceber.findMany({
                where: { dataVencimento: { gte: inicio, lt: fim } },
                select: { dataVencimento: true, valor: true },
            }),
        ]);

        const despMes = new Array(12).fill(0);
        const recMes = new Array(12).fill(0);
        despesas.forEach(d => {
            if (isOperacional(d.categoria || '')) despMes[d.dataPagamento.getMonth()] += d.valor;
        });
        receitas.forEach(r => { recMes[r.dataVencimento.getMonth()] += r.valor; });

        const data = MESES.map((mes, i) => ({
            mes,
            receitas: Math.round(recMes[i] * 100) / 100,
            despesas: Math.round(despMes[i] * 100) / 100,
            resultado: Math.round((recMes[i] - despMes[i]) * 100) / 100,
        }));

        const totalRec = recMes.reduce((a, b) => a + b, 0);
        const totalDesp = despMes.reduce((a, b) => a + b, 0);

        res.json({
            success: true,
            data,
            totalReceitas: Math.round(totalRec * 100) / 100,
            totalDespesas: Math.round(totalDesp * 100) / 100,
            resultadoAno: Math.round((totalRec - totalDesp) * 100) / 100,
            year,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 2) Receitas por Tipo — agrupa receitas pela categoria.
 */
export const getReceitasPorTipo = async (req: Request, res: Response): Promise<void> => {
    try {
        const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
        const inicio = new Date(year, 0, 1);
        const fim = new Date(year + 1, 0, 1);

        const receitas = await prisma.contaReceber.findMany({
            where: { dataVencimento: { gte: inicio, lt: fim } },
            select: { categoria: true, valor: true },
        });

        const porTipo: Record<string, number> = {};
        receitas.forEach(r => {
            const cat = r.categoria || 'Outras Receitas';
            porTipo[cat] = (porTipo[cat] || 0) + r.valor;
        });

        const total = Object.values(porTipo).reduce((a, b) => a + b, 0);
        const data = Object.entries(porTipo)
            .map(([nome, valor]) => ({
                nome,
                valor: Math.round(valor * 100) / 100,
                pct: total > 0 ? Math.round((valor / total) * 10000) / 100 : 0,
            }))
            .sort((a, b) => b.valor - a.valor);

        res.json({ success: true, data, total: Math.round(total * 100) / 100, year });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * 3) Outras Saídas — DRE em cascata:
 *    Receitas − Despesas Operacionais = Lucro Financ. Operacional
 *    − Depósito Judicial − Imobilizações − Distribuição de Lucros = Resultado do Exercício
 */
export const getOutrasSaidas = async (req: Request, res: Response): Promise<void> => {
    try {
        const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
        const inicio = new Date(year, 0, 1);
        const fim = new Date(year + 1, 0, 1);

        const [despesas, receitasAgg] = await Promise.all([
            prisma.lancamento.findMany({
                where: { tipo: 'DESPESA', dataPagamento: { gte: inicio, lt: fim } },
                select: { categoria: true, valor: true },
            }),
            prisma.contaReceber.aggregate({
                where: { dataVencimento: { gte: inicio, lt: fim } },
                _sum: { valor: true },
            }),
        ]);

        let depJud = 0, imobiliz = 0, distLuc = 0, despOperacional = 0;
        despesas.forEach(d => {
            const c = d.categoria || '';
            if (matchDepJud(c)) depJud += d.valor;
            else if (matchImobiliz(c)) imobiliz += d.valor;
            else if (matchDistLuc(c)) distLuc += d.valor;
            else despOperacional += d.valor;
        });

        const receitas = receitasAgg._sum.valor || 0;
        const lucroFinOper = receitas - despOperacional;
        const resultadoExercicio = lucroFinOper - depJud - imobiliz - distLuc;

        const r = (v: number) => Math.round(v * 100) / 100;

        res.json({
            success: true,
            year,
            data: {
                receitas: r(receitas),
                despesaOperacional: r(despOperacional),
                lucroFinOperacional: r(lucroFinOper),
                depositoJudicial: r(depJud),
                imobilizacoes: r(imobiliz),
                distribuicaoLucros: r(distLuc),
                resultadoExercicio: r(resultadoExercicio),
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
