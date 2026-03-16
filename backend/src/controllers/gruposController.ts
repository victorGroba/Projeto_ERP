import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getGroups = async (req: Request, res: Response) => {
    try {
        const groups = await prisma.gruposEconomicos.findMany({
            include: { clientes: true }
        });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar grupos econômicos' });
    }
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const { nome } = req.body;
        const group = await prisma.gruposEconomicos.create({
            data: { nome }
        });
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar grupo econômico' });
    }
};

export const updateClientGroupMapping = async (req: Request, res: Response) => {
    try {
        const { clienteIdContaAzul, grupoEconomicoId, segmentoTipo } = req.body;
        const mappedClient = await prisma.deParaClientes.update({
            where: { clienteIdContaAzul },
            data: {
                grupoEconomicoId: grupoEconomicoId || null,
                segmentoTipo: segmentoTipo
            }
        });
        res.json(mappedClient);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar De-Para do cliente' });
    }
};
