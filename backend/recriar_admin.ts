import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  const password = await bcrypt.hash('123', 10);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password
    },
    create: {
      email,
      password,
      name: 'Administrador'
    }
  });

  console.log(`Usuário garantido no banco!`);
  console.log(`Email: ${user.email}`);
  console.log(`Senha: 123`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
