import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Autenticacao maquina-a-maquina do CRM do Laboratorio Mattos & Mattos.
 * Token proprio (`CRM_INTEGRACAO_TOKEN`), separado do JWT dos usuarios do BI:
 * o CRM so le, e revogar o acesso dele nao derruba ninguem do BI. Sem a
 * variavel configurada a integracao fica desligada.
 */
export const integracaoCrmMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const esperado = process.env.CRM_INTEGRACAO_TOKEN || '';
    if (!esperado) {
        return res.status(503).json({ error: 'Integração com o CRM não configurada' });
    }

    const authHeader = req.headers.authorization || '';
    const recebido = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const a = Buffer.from(recebido);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Token inválido' });
    }
    next();
};
