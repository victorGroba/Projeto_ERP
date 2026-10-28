import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { construirIndiceClientes } from './clientesController';

const prisma = new PrismaClient();

const digits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

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
            notas: notas.map(n => {
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
                    descricao: n.descricaoServico,
                };
            }),
        });
    } catch (error) {
        console.error('[integracao/crm/faturamento] Erro:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};
