import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';
import etlRoutes from './routes/etlRoutes';
import gruposRoutes from './routes/gruposRoutes';

import faturamentoRoutes from './routes/faturamentoRoutes';
import inadimplenciaRoutes from './routes/inadimplenciaRoutes';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/etl', etlRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/faturamento', faturamentoRoutes);
app.use('/api/inadimplencia', inadimplenciaRoutes);

// Main Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Conta Azul Dashboard API is running.' });
});

// Example route wrapper for DB Check
app.get('/api/db-test', async (req, res) => {
    try {
        const contas = await prisma.gestaoContas.findMany();
        res.json({ success: true, contas });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`[Server]: 🚀 API is running on http://localhost:${PORT}`);
});
