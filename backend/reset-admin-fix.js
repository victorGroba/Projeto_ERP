const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        const user = await prisma.user.upsert({
            where: { email: 'admin@grobatech.com' },
            update: { password: hash },
            create: {
                email: 'admin@grobatech.com',
                name: 'Admin Groba',
                password: hash,
                role: 'ADMIN'
            }
        });
        console.log('✅ Admin redefinido:', user.email);
    } catch (e) {
        console.error('❌ Erro:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
