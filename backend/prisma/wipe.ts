import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Iniciando limpeza do DB...');
    await prisma.invoice.deleteMany({});
    console.log('Faturas deletadas...');

    await prisma.snapshotsRecebiveis.deleteMany({});
    await prisma.accountsReceivable.deleteMany({});
    await prisma.accountsPayable.deleteMany({});
    await prisma.deParaClientes.deleteMany({});
    console.log('Dados financeiros deletados...');

    console.log('DB limpo! Pronto para novo carregamento ETL.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
