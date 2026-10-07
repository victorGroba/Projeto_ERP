import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
    CustosValidationError,
    atualizarEquipamento, atualizarInsumo, criarEquipamento, criarInsumo,
    excluirEquipamento, excluirInsumo, excluirPrecoInsumo,
    listarEquipamentos, listarInsumos, obterInsumo, registrarPrecoInsumo,
} from '../services/custosService';
import { importarPlanilhaCustos } from '../services/custosImportacaoService';

type Handler = (req: Request, res: Response) => Promise<unknown>;

// Converte erros de validação em 400 e registro inexistente em 404.
function tratar(contexto: string, handler: Handler) {
    return async (req: Request, res: Response): Promise<void> => {
        try {
            const resultado = await handler(req, res);
            if (!res.headersSent) res.json(resultado ?? { success: true });
        } catch (error: any) {
            if (error instanceof CustosValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                res.status(404).json({ message: 'Cadastro não encontrado.' });
                return;
            }
            console.error(`[Custos] ${contexto}:`, error.message);
            res.status(500).json({ message: `Não foi possível ${contexto}.` });
        }
    };
}

export const getInsumos = tratar('listar os insumos', async () => listarInsumos());

export const getInsumo = tratar('carregar o insumo', async (req, res) => {
    const insumo = await obterInsumo(req.params.id);
    if (!insumo) res.status(404).json({ message: 'Insumo não encontrado.' });
    return insumo;
});

export const postInsumo = tratar('cadastrar o insumo', async (req, res) => {
    res.status(201);
    return criarInsumo(req.body ?? {});
});

export const putInsumo = tratar('atualizar o insumo', async req => atualizarInsumo(req.params.id, req.body ?? {}));

export const deleteInsumo = tratar('excluir o insumo', async req => excluirInsumo(req.params.id));

export const postPrecoInsumo = tratar('registrar o preço', async (req, res) => {
    res.status(201);
    return registrarPrecoInsumo(req.params.id, req.body ?? {});
});

export const deletePrecoInsumo = tratar('excluir o preço', async req => excluirPrecoInsumo(req.params.id, req.params.precoId));

export const getEquipamentos = tratar('listar os equipamentos', async () => listarEquipamentos());

export const postEquipamento = tratar('cadastrar o equipamento', async (req, res) => {
    res.status(201);
    return criarEquipamento(req.body ?? {});
});

export const putEquipamento = tratar('atualizar o equipamento', async req => atualizarEquipamento(req.params.id, req.body ?? {}));

export const deleteEquipamento = tratar('excluir o equipamento', async req => excluirEquipamento(req.params.id));

export async function uploadPlanilhaCustos(req: Request, res: Response): Promise<void> {
    if (!req.file) {
        res.status(400).json({ message: 'Selecione a planilha de custos (.xlsx ou .xls).' });
        return;
    }
    try {
        // O multer entrega o nome do arquivo em latin1; os nomes das planilhas têm acentos.
        const nomeArquivo = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        const r = await importarPlanilhaCustos(req.file.buffer, nomeArquivo);
        res.json({
            success: true,
            message: `Planilha importada: ${r.insumosCriados} insumo(s) novo(s), ${r.precosAdicionados} preço(s) atualizado(s), `
                + `${r.equipamentosCriados} equipamento(s)/calibração(ões) novo(s). ${r.comPendencia} cadastro(s) ficaram com pendência para conferir.`,
            ...r,
        });
    } catch (error: any) {
        const message = error.message || 'Não foi possível importar a planilha.';
        console.error('[Custos] Falha na importação:', message);
        res.status(String(message).startsWith('Arquivo rejeitado') ? 422 : 500).json({ message });
    }
}
