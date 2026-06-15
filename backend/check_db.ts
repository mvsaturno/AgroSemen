import * as dotenv from 'dotenv';
dotenv.config();
import prisma from './src/database';

async function check() {
  try {
    const contas = await prisma.conta.count();
    const usuarios = await prisma.usuario.count();
    const touros = await prisma.touro.count();
    const lotes = await prisma.loteSemen.count();
    const clientes = await prisma.cliente.count();
    const inseminacoes = await prisma.inseminacao.count();

    console.log('--- DATABASE COUNT ---');
    console.log('Contas:', contas);
    console.log('Usuarios:', usuarios);
    console.log('Touros:', touros);
    console.log('Lotes Semen:', lotes);
    console.log('Clientes:', clientes);
    console.log('Inseminacoes:', inseminacoes);

    // Listar as contas
    const listContas = await prisma.conta.findMany({ select: { id: true, nome: true, slug: true } });
    console.log('Contas cadastradas:', listContas);
  } catch (e) {
    console.error('Error querying PostgreSQL:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
