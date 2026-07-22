import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const historicos = await prisma.historicoImportacao.findMany();
    console.log(`Total de historicos no banco: ${historicos.length}`);
    console.log(historicos);
}

main().catch(console.error).finally(() => prisma.$disconnect());
