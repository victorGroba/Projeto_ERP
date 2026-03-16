const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const inv = await prisma.invoice.findMany({
        orderBy: { issueDate: 'desc' }
    });
    console.log("=== Notas Fiscais ===");
    console.log(`Total encontrado: ${inv.length}`);
    if (inv.length > 0) {
        console.log("Mais recentes:");
        inv.slice(0, 5).forEach(i => console.log(i.issueDate.toISOString(), "- R$", i.grossValue));
        console.log("Mais antigas:");
        inv.slice(-5).forEach(i => console.log(i.issueDate.toISOString(), "- R$", i.grossValue));
    }

    const ar = await prisma.accountsReceivable.findMany({
        orderBy: { dueDate: 'desc' }
    });
    console.log("\n=== Contas a Receber ===");
    console.log(`Total encontrado: ${ar.length}`);
    if (ar.length > 0) {
        console.log("Mais recentes:");
        ar.slice(0, 5).forEach(i => console.log(i.dueDate.toISOString(), "- R$", i.value));
    }
}
check().catch(console.error).finally(() => prisma.$disconnect());
