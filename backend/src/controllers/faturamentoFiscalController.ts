import { Request, Response } from 'express';
import { importarFaturamentoFiscal, listarImportacoesFiscais } from '../services/faturamentoFiscalService';

export async function uploadFaturamentoFiscal(req: Request, res: Response): Promise<void> {
    if (!req.file) {
        res.status(400).json({ message: 'Selecione o arquivo CSV mensal da prefeitura.' });
        return;
    }

    try {
        const result = await importarFaturamentoFiscal(req.file.buffer, req.file.originalname);
        const periodo = result.competenciaInicio === result.competenciaFim
            ? result.competenciaInicio
            : `${result.competenciaInicio} a ${result.competenciaFim}`;
        const substituicao = result.mesesSubstituidos > 0 ? `; ${result.mesesSubstituidos} mês(es) substituído(s)` : '';
        res.json({
            success: true,
            message: `Faturamento de ${periodo} importado: ${result.qtdMeses} mês(es), ${result.qtdNotas} notas, total de R$ ${result.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${substituicao}.`,
            ...result,
        });
    } catch (error: any) {
        const message = error.message || 'Não foi possível importar o faturamento fiscal.';
        console.error('[Faturamento fiscal] Falha na importação:', message);
        res.status(String(message).startsWith('Arquivo rejeitado') ? 422 : 500).json({ message });
    }
}

export async function getImportacoesFiscais(_req: Request, res: Response): Promise<void> {
    try {
        res.json({ success: true, importacoes: await listarImportacoesFiscais() });
    } catch (error: any) {
        console.error('[Faturamento fiscal] Falha ao listar importações:', error.message);
        res.status(500).json({ message: 'Não foi possível carregar os fechamentos fiscais.' });
    }
}
