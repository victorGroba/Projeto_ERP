import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('admin', 10);
    await prisma.user.create({
        data: {
            name: 'Administrador',
            email: 'admin@admin.com',
            password: hash,
            role: 'ADMIN'
        }
    });
    console.log('Seed completo.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
