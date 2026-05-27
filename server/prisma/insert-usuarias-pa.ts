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
  { name: 'Nelida Adriana Tomasa Hernandez Rodriguez', email: 'nelida.a.hernandez.r@gmail.com', phone: '+56977785886', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Oriana Paulina Martin Cascelly',            email: 'orianitamartin@gmail.com',        phone: '+56978526067', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Lidia Rosa Herrera Sazo',                  email: 'lidiaherrerasazo@gmail.com',       phone: '+56920516297', organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Ana del Pilar Castro Navarro',             email: 'richato1620@gmail.com',            phone: '994793329',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Sandra Ramirez Mejias',                    email: 'sandraramirezmejias25@gmail.com',  phone: '978837421',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Mirsa Teresa Labarca Astudillo',           email: 'mirsalabarca@gmail.com',           phone: '982472650',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Laura Noemi Suarez',                       email: 'lauranoemi2261@gmail.com',         phone: '959995683',    organization: 'Costura Activa',    pass: ACTIVA },
  { name: 'Celina Angelica Ferrada Nilo',             email: 'aferrada605@hotmail.com',          phone: '998280371',    organization: 'Costura Activa',    pass: ACTIVA },
  // ── Viva La Esperanza ───────────────────────────────────────────────────────
  { name: 'Sandra del Carmen Cabrera Solis',          email: 'mil.confecciones@gmail.com',       phone: '955673728',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Rosalia del Carmen Nela Garabito',         email: 'familiaaguileranela@gmail.com',    phone: '955673728',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Gregoria Gladys Moraga Escobar',           email: 'gregoria.moraga.e@gmail.com',      phone: '982750983',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  { name: 'Laura Perez Ñuñez',                       email: 'lauracperezñunez@gmail.com',       phone: '991447766',    organization: 'Viva La Esperanza',    pass: JUNTAS },
  // ── Creando con Reciclaje ───────────────────────────────────────────────────
  { name: 'Jeanette Liliana Ríos Llantén',           email: 'llantenjli@gmail.com',             phone: '974427946',    organization: 'Creando con Reciclaje', pass: JUNTAS },
  { name: 'Paola Jeannette Álvarez Torres',          email: 'pola.alvarez.torres@gmail.com',    phone: '945911003',    organization: 'Creando con Reciclaje', pass: JUNTAS },
  // ── Cerrito Arriba ──────────────────────────────────────────────────────────
  { name: 'Elizabeth del Carmen Almonacid Stewart',  email: 'elizabethdcas53@gmail.com',        phone: '968180240',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Nancy Victoria Aparicio Riquelme',        email: 'nancyvar1@hotmail.com',            phone: '996953624',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Emily del Carmén Ossandon Neira',         email: 'mili.1959@gmail.com',              phone: '927595066',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Patricia Elizabeth Pino Quesada',         email: 'patita.pinito@gmail.com',          phone: '995363712',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Ruth Sanida Cordero Gonzalez',            email: 'ruthcordero.rc@gmail.com',         phone: '950912829',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Marianella Antonia Tilleria Leiva',       email: 'marianellatilleria2@gmail.com',    phone: '944764814',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  { name: 'Ana Graciela Navarro Salas',              email: 'anita.15.navarros@gmail.com',      phone: '999172014',    organization: 'Cerrito Arriba',       pass: JUNTAS },
  // ── Puente Alto ─────────────────────────────────────────────────────────────
  { name: 'Belen Hurtado',                           email: 'belen.hurtado@mpuentealto.cl',     phone: '974888983',    organization: 'Puente Alto',          pass: JUNTAS },
];

async function main() {
  console.log(`\n👥 Insertando ${usuarias.length} usuarias en Puente Alto...\n`);

  let creadas = 0;
  let omitidas = 0;

  for (const u of usuarias) {
    const existe = await prisma.user.findUnique({ where: { email: u.email } });
    if (existe) {
      console.log(`  ⏭  Omitida (ya existe): ${u.email}`);
      omitidas++;
      continue;
    }
    const hashed = await bcrypt.hash(u.pass, 10);
    await prisma.user.create({
      data: {
        name:         u.name,
        email:        u.email,
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
