import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';
import importacaoRoutes from './routes/importacaoRoutes';
import csvDashboardRoutes from './routes/csvDashboardRoutes';
import syncRoutes from './routes/syncRoutes';
import oauthRoutes from './routes/oauthRoutes';
import auditRoutes from './routes/auditRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// CSP desativado: o frontend usa muitos estilos inline. Cloudflare/HTTPS cuida do transporte.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Rotas de Autenticação
app.use('/api/auth', authRoutes);

// Rotas de Importação CSV (ETL)
app.use('/api/etl', importacaoRoutes);

// Rotas de Dashboard (dados processados do CSV)
app.use('/api/dashboard', csvDashboardRoutes);

// Rotas de Sincronização via API Conta Azul
app.use('/api/etl', syncRoutes);

// Rotas OAuth (re-autorização via UI)
app.use('/api/oauth', oauthRoutes);

// Rotas de Auditoria de Dados
app.use('/api/audit', auditRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Conta Azul Dashboard API is running.' });
});

// ── Produção: serve o frontend buildado (SPA) ──
// Se existir a pasta public/ (dist do frontend copiado no build Docker), serve estático
// e faz fallback para index.html em qualquer rota não-/api (React Router).
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(publicDir, 'index.html'));
    });
    console.log('[Server]: 📦 Servindo frontend estático de /public');
}

// Cria um usuário admin no primeiro start se o banco estiver vazio (deploy novo).
async function ensureAdmin() {
    try {
        const prisma = new PrismaClient();
        const total = await prisma.user.count();
        if (total === 0) {
            const email = process.env.ADMIN_EMAIL || 'admin@admin.com';
            const senha = process.env.ADMIN_PASSWORD || '123';
            await prisma.user.create({
                data: { email, password: await bcrypt.hash(senha, 10), name: 'Administrador' },
            });
            console.log(`[Server]: 👤 Admin inicial criado: ${email}`);
        }
        await prisma.$disconnect();
    } catch (e) {
        console.warn('[Server]: não foi possível verificar/criar admin:', e);
    }
}

app.listen(Number(PORT), '0.0.0.0', async () => {
    await ensureAdmin();
    console.log(`[Server]: 🚀 API rodando na porta ${PORT}`);
});
