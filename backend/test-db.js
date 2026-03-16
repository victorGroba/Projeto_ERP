const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const invoices2024 = await prisma.invoice.count({
        where: {
            issueDate: {
                gte: new Date(2024, 0, 1),
                lte: new Date(2024, 11, 31, 23, 59, 59)
            }
        }
    });

    const all = await prisma.invoice.findMany({
        select: { issueDate: true }
    });

    console.log('Total em 2024:', invoices2024);
    const years = new Set(all.map(i => i.issueDate.getFullYear()));
    console.log('Anos presentes:', Array.from(years));
}

main().catch(console.error).finally(() => prisma.$disconnect());
