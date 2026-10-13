import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
    CustosValidationError,
    atualizarEquipamento, atualizarInsumo, criarEquipamento, criarInsumo,
    excluirEquipamento, excluirInsumo, excluirPrecoInsumo,
    listarEquipamentos, listarInsumos, obterInsumo, registrarPrecoInsumo,
} from '../services/custosService';
import { importarPlanilhaCustos } from '../services/custosImportacaoService';
import {
    atualizarEnsaio, criarEnsaio, duplicarEnsaio, excluirEnsaio,
    listarEnsaios, listarParametros, obterEnsaio, salvarParametros, simularFicha,
} from '../services/ensaiosService';
import {
    atualizarServico, criarServico, excluirServico, listarServicos, obterServico,
} from '../services/servicosService';

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
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                res.status(409).json({ message: 'Este cadastro é usado em fichas técnicas de ensaios. Marque como inativo em vez de excluir.' });
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

// Data opcional (?data=AAAA-MM-DD) para calcular com os preços vigentes naquele dia.
function dataConsulta(req: Request): Date | undefined {
    // As vigências são gravadas como datas em UTC; o dia consultado vale inteiro.
    const data = typeof req.query.data === 'string' ? new Date(`${req.query.data}T23:59:59.999Z`) : undefined;
    return data && !Number.isNaN(data.getTime()) ? data : undefined;
}

export const getEnsaios = tratar('listar os ensaios', async req => listarEnsaios(dataConsulta(req)));

export const getEnsaio = tratar('carregar o ensaio', async (req, res) => {
    const ensaio = await obterEnsaio(req.params.id, dataConsulta(req));
    if (!ensaio) res.status(404).json({ message: 'Ensaio não encontrado.' });
    return ensaio;
});

export const postEnsaio = tratar('cadastrar o ensaio', async (req, res) => {
    res.status(201);
    return criarEnsaio(req.body ?? {});
});

export const putEnsaio = tratar('salvar o ensaio', async req => atualizarEnsaio(req.params.id, req.body ?? {}));

export const deleteEnsaio = tratar('excluir o ensaio', async req => excluirEnsaio(req.params.id));

export const postDuplicarEnsaio = tratar('duplicar o ensaio', async (req, res) => {
    res.status(201);
    return duplicarEnsaio(req.params.id);
});

export const postSimularFicha = tratar('calcular a ficha', async req => simularFicha(req.body ?? {}));

export const getServicos = tratar('listar os serviços', async req => listarServicos(dataConsulta(req)));

export const getServico = tratar('carregar o serviço', async (req, res) => {
    const servico = await obterServico(req.params.id, dataConsulta(req));
    if (!servico) res.status(404).json({ message: 'Serviço não encontrado.' });
    return servico;
});

export const postServico = tratar('cadastrar o serviço', async (req, res) => {
    res.status(201);
    return criarServico(req.body ?? {});
});

export const putServico = tratar('salvar o serviço', async req => atualizarServico(req.params.id, req.body ?? {}));

export const deleteServico = tratar('excluir o serviço', async req => excluirServico(req.params.id));

export const getParametros = tratar('carregar os parâmetros', async () => listarParametros());

export const putParametros = tratar('salvar os parâmetros', async req => salvarParametros(req.body ?? {}));

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
                + `${r.equipamentosCriados} equipamento(s)/calibração(ões) novo(s), ${r.ensaiosCriados} ensaio(s) com ficha técnica`
                + `${r.ensaiosExistentes ? ` (${r.ensaiosExistentes} já existiam e não foram alterados)` : ''}. `
                + `${r.comPendencia} cadastro(s) ficaram com pendência para conferir.`,
            ...r,
        });
    } catch (error: any) {
        const message = error.message || 'Não foi possível importar a planilha.';
        console.error('[Custos] Falha na importação:', message);
        res.status(String(message).startsWith('Arquivo rejeitado') ? 422 : 500).json({ message });
    }
}
