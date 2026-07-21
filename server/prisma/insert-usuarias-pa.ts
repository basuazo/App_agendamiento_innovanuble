/**
 * Script de inserción única — Usuarias Puente Alto
 * Ejecutar desde /server/: npx ts-node --project tsconfig.seed.json prisma/insert-usuarias-pa.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SPACE_ID = 'space_puente_alto';

const ACTIVA    = 'activa';
const JUNTAS    = 'haciendojuntas';

const usuarias = [
  // ── Costura Activa ──────────────────────────────────────────────────────────
  { name: 'Nelida Adriana Tomasa Hernandez Rodriguez', username: '120000001', phone: '+56977785886', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Oriana Paulina Martin Cascelly',            username: '120000028',        phone: '+56978526067', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Lidia Rosa Herrera Sazo',                  username: '120000036',       phone: '+56920516297', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Ana del Pilar Castro Navarro',             username: '120000044',            phone: '994793329',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Sandra Ramirez Mejias',                    username: '120000052',  phone: '978837421',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Mirsa Teresa Labarca Astudillo',           username: '120000060',           phone: '982472650',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Laura Noemi Suarez',                       username: '120000079',         phone: '959995683',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Celina Angelica Ferrada Nilo',             username: '120000087',          phone: '998280371',    organization: 'Costura Activa',    pass: ACTIVA },
  // ── Viva La Esperanza ───────────────────────────────────────────────────────
  { name: 'Sandra del Carmen Cabrera Solis',          username: '130000002',       phone: '955673728',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Rosalia del Carmen Nela Garabito',         username: '130000010',    phone: '955673728',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Gregoria Gladys Moraga Escobar',           username: '130000029',      phone: '982750983',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Laura Perez Ñuñez',                       username: '130000037',       phone: '991447766',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  // ── Creando con Reciclaje ───────────────────────────────────────────────────
  { name: 'Jeanette Liliana Ríos Llantén',           username: '140000003',             phone: '974427946',    organization: 'Creando con Reciclaje', pass: JUNTAS },
  { name: 'Paola Jeannette Álvarez Torres',          username: '140000011',    phone: '945911003',    organization: 'Creando con Reciclaje', pass: JUNTAS },
  // ── Cerrito Arriba ──────────────────────────────────────────────────────────
  { name: 'Elizabeth del Carmen Almonacid Stewart',  username: '150000004',        phone: '968180240',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Nancy Victoria Aparicio Riquelme',        username: '150000012',            phone: '996953624',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Emily del Carmén Ossandon Neira',         username: '150000020',              phone: '927595066',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Patricia Elizabeth Pino Quesada',         username: '150000039',          phone: '995363712',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Ruth Sanida Cordero Gonzalez',            username: '150000047',         phone: '950912829',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Marianella Antonia Tilleria Leiva',       username: '150000055',    phone: '944764814',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Ana Graciela Navarro Salas',              username: '150000063',      phone: '999172014',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  // ── Puente Alto ─────────────────────────────────────────────────────────────
  { name: 'Belen Hurtado',                           username: '160000005',     phone: '974888983',    organization: 'Puente Alto',          pass: JUNTAS },
];

async function main() {
  console.log(`\n👥 Insertando ${usuarias.length} usuarias en Puente Alto...\n`);

  let creadas = 0;
  let omitidas = 0;

  for (const u of usuarias) {
    const existe = await prisma.user.findUnique({ where: { username: u.username } });
    if (existe) {
      console.log(`  ⏭  Omitida (ya existe): ${u.username}`);
      omitidas++;
      continue;
    }
    const hashed = await bcrypt.hash(u.pass, 10);
    await prisma.user.create({
      data: {
        name:         u.name,
        username:        u.username,
        phone:        u.phone,
        organization: u.organization,
        password:     hashed,
        role:         'USER',
        isVerified:   true,
        spaceId:      SPACE_ID,
      },
    });
    console.log(`  ✅ Creada: ${u.name}`);
    creadas++;
  }

  console.log(`\n🎉 Listo. ${creadas} creadas, ${omitidas} omitidas (ya existían).`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
