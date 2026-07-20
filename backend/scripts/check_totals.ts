import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    const results = await prisma.lancamento.groupBy({
        by: ['centroDeCusto'],
        where: {
            tipo: 'DESPESA',
            dataPagamento: {
                gte: new Date('2026-01-01T00:00:00.000Z'),
                lte: new Date('2026-06-30T23:59:59.000Z')
            }
        },
        _sum: {
            valor: true
        }
    });

    const formatted = results.map(r => ({
        centroDeCusto: r.centroDeCusto,
        total: r._sum.valor
    })).sort((a, b) => (b.total || 0) - (a.total || 0));

    let sumAll = 0;
    for (const f of formatted) {
        console.log(`${f.centroDeCusto}: R$ ${f.total?.toFixed(2)}`);
        sumAll += f.total || 0;
    }
    console.log(`TOTAL: R$ ${sumAll.toFixed(2)}`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
