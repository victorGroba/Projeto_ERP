import { Router, Request, Response } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

const CLIENT_ID     = process.env.CONTA_AZUL_CLIENT_ID_RJ!;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET_RJ!;
const REDIRECT_URI  = 'https://contaazul.com';
const AUTH_BASE     = 'https://auth.contaazul.com';

// GET /api/oauth/url — gera a URL de autorização
router.get('/url', authMiddleware, (req: Request, res: Response) => {
    const state = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        state,
        scope: 'openid profile aws.cognito.signin.user.admin',
    });
    const url = `${AUTH_BASE}/login?${params.toString()}`;
    res.json({ url, state });
});

// POST /api/oauth/exchange — troca o code por tokens e salva no banco
router.post('/exchange', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: 'code é obrigatório' }); return; }

    try {
        const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenRes = await axios.post(`${AUTH_BASE}/oauth2/token`, params.toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token } = tokenRes.data;

        // Salva no banco (AppConfig) — o sync service lê daqui primeiro
        await Promise.all([
            prisma.appConfig.upsert({
                where: { key: 'access_token_rj' },
                update: { value: access_token },
                create: { key: 'access_token_rj', value: access_token },
            }),
            prisma.appConfig.upsert({
                where: { key: 'refresh_token_rj' },
                update: { value: refresh_token },
                create: { key: 'refresh_token_rj', value: refresh_token },
            }),
        ]);

        res.json({ success: true, message: 'Conexão estabelecida com sucesso!' });
    } catch (err: any) {
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
        res.status(400).json({ error: `Falha ao trocar o código: ${msg}` });
    }
});

// GET /api/oauth/status — verifica se há tokens válidos no banco
router.get('/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const cfg = await prisma.appConfig.findUnique({ where: { key: 'access_token_rj' } });
        const hasToken = !!(cfg?.value);
        const updatedAt = cfg?.updatedAt ?? null;
        res.json({ connected: hasToken, updatedAt });
    } catch {
        res.json({ connected: false, updatedAt: null });
    }
});

export default router;
