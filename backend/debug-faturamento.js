const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const year = 2025;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    console.log('### Debug Faturamento 2025 ###');
    console.log('Local Start:', start.toString());
    console.log('Local End:', end.toString());
    console.log('ISO Start:', start.toISOString());
    console.log('ISO End:', end.toISOString());

    const allCount = await prisma.invoice.count();
    console.log('Total invoices in DB:', allCount);

    const count2025 = await prisma.invoice.count({
        where: {
            issueDate: { gte: start, lte: end }
        }
    });
    console.log('Count for 2025 with filter:', count2025);

    const firstAny = await prisma.invoice.findFirst({
        orderBy: { issueDate: 'asc' }
    });
    console.log('First invoice in DB (date):', firstAny ? firstAny.issueDate.toISOString() : 'NONE');

    const lastAny = await prisma.invoice.findFirst({
        orderBy: { issueDate: 'desc' }
    });
    console.log('Last invoice in DB (date):', lastAny ? lastAny.issueDate.toISOString() : 'NONE');
}
debug().catch(console.error).finally(() => prisma.$disconnect());
