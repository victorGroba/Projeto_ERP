const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        await prisma.user.upsert({
            where: { email: 'admin@admin.com' },
            update: { password: hash },
            create: { email: 'admin@admin.com', name: 'Admin', password: hash, role: 'ADMIN' }
        });
        console.log('Senha do admin redefinida com sucesso.');
    } catch (e) {
        console.error('Erro ao redefinir a senha:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
