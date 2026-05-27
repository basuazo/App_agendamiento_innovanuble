import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: No ejecutar seed en producción. Abortando.');
  process.exit(1);
}

import { PrismaClient, Role, BookingPurpose, BookingStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SPACE_IDS = {
  puenteAlto: 'space_puente_alto',
  chillan: 'space_chillan',
  valparaiso: 'space_valparaiso',
};

const DEFAULT_CATEGORIES = [
  { name: 'Recta Casera',          slug: 'RECTA_CASERA',          color: '#3b82f6', order: 0  },
  { name: 'Overlock Casera',       slug: 'OVERLOCK_CASERA',       color: '#8b5cf6', order: 1  },
  { name: 'Collaretera',           slug: 'COLLERETERA',           color: '#ec4899', order: 2  },
  { name: 'Bordadora',             slug: 'BORDADORA',             color: '#f59e0b', order: 3  },
  { name: 'Impresora Sublimación', slug: 'IMPRESORA_SUBLIMACION', color: '#10b981', order: 4  },
  { name: 'Plotter de Corte',      slug: 'PLOTTER_CORTE',         color: '#ef4444', order: 5  },
  { name: 'Plancha Sublimación',   slug: 'PLANCHA_SUBLIMACION',   color: '#f97316', order: 6  },
  { name: 'Industrial',            slug: 'INDUSTRIAL',            color: '#6b7280', order: 7  },
  { name: 'Plancha de Vapor',      slug: 'PLANCHA_VAPOR',         color: '#06b6d4', order: 8  },
  { name: 'Mesón de Corte',        slug: 'MESON_CORTE',           color: '#84cc16', order: 9  },
  { name: 'Espacio de Reuniones',  slug: 'ESPACIO_REUNION',       color: '#0ea5e9', order: 10 },
];

async function createCategoriesForSpace(spaceId: string): Promise<Record<string, string>> {
  const categoryIds: Record<string, string> = {};
  for (const cat of DEFAULT_CATEGORIES) {
    const created = await prisma.category.create({ data: { ...cat, spaceId } });
    categoryIds[cat.slug] = created.id;
  }
  return categoryIds;
}

async function createResourcesForSpace(spaceId: string, catIds: Record<string, string>) {
  const xb2500_1 = await prisma.resource.create({
    data: { name: 'XB2500 1', description: 'Máquina de coser recta casera Brother XB2500', categoryId: catIds['RECTA_CASERA'], spaceId },
  });
  const xb2500_2 = await prisma.resource.create({
    data: { name: 'XB2500 2', description: 'Máquina de coser recta casera Brother XB2500', categoryId: catIds['RECTA_CASERA'], spaceId },
  });
  const st371_1 = await prisma.resource.create({
    data: { name: 'ST371 1', description: 'Máquina de coser recta casera Brother ST371', categoryId: catIds['RECTA_CASERA'], spaceId },
  });
  const st371_2 = await prisma.resource.create({
    data: { name: 'ST371 2', description: 'Máquina de coser recta casera Brother ST371', categoryId: catIds['RECTA_CASERA'], spaceId },
  });
  const bm3850_1 = await prisma.resource.create({
    data: { name: 'BM3850 1', description: 'Máquina de coser recta casera Brother BM3850', categoryId: catIds['RECTA_CASERA'], spaceId },
  });
  const bm3850_2 = await prisma.resource.create({
    data: { name: 'BM3850 2', description: 'Máquina de coser recta casera Brother BM3850', categoryId: catIds['RECTA_CASERA'], spaceId },
  });

  await prisma.resource.create({
    data: { name: 'Brother 3534DT', description: 'Máquina overlock casera Brother 3534DT', categoryId: catIds['OVERLOCK_CASERA'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Brother CV3550', description: 'Collaretera Brother CV3550', categoryId: catIds['COLLERETERA'], spaceId },
  });

  const pe910l = await prisma.resource.create({
    data: { name: 'Brother PE 910 L', description: 'Máquina bordadora Brother PE 910 L', categoryId: catIds['BORDADORA'], spaceId },
  });

  await prisma.resource.create({
    data: { name: 'Brother SP1', description: 'Impresora de sublimación Brother SP1', categoryId: catIds['IMPRESORA_SUBLIMACION'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Brother SDX225', description: 'Plotter de corte Brother SDX225', categoryId: catIds['PLOTTER_CORTE'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Plana 60×40', description: 'Plancha de sublimación plana 60×40 cm', categoryId: catIds['PLANCHA_SUBLIMACION'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Recta Brother S 7180A', description: 'Máquina recta industrial Brother S 7180A', categoryId: catIds['INDUSTRIAL'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Overlock Brother FB-N31-5030', description: 'Máquina overlock industrial Brother FB-N31-5030', categoryId: catIds['INDUSTRIAL'], spaceId },
  });
  await prisma.resource.create({
    data: { name: 'Plancha Silverstar', description: 'Plancha de vapor Silverstar profesional', categoryId: catIds['PLANCHA_VAPOR'], spaceId },
  });
  await prisma.resource.create({
    data: {
      name: 'Mesones de Corte', description: '4 mesones de corte compartidos — indicar cuántos ocuparás (1-4)',
      categoryId: catIds['MESON_CORTE'], capacity: 4, requiresCertification: false, spaceId,
    },
  });
  await prisma.resource.create({
    data: {
      name: 'Espacio de Reuniones', description: 'Sala de reuniones — bloquea todos los mesones de corte al reservar',
      categoryId: catIds['ESPACIO_REUNION'], capacity: 1, requiresCertification: true, spaceId,
    },
  });

  return { xb2500_1, xb2500_2, st371_1, st371_2, bm3850_1, bm3850_2, pe910l };
}

async function createBusinessHoursForSpace(spaceId: string) {
  const days = [0, 1, 2, 3, 4, 5, 6];
  await prisma.businessHours.createMany({
    data: days.map((dayOfWeek) => ({
      spaceId,
      dayOfWeek,
      openTime: '09:00',
      closeTime: '17:00',
      isOpen: dayOfWeek !== 0 && dayOfWeek !== 6, // lun-vie abierto, sab-dom cerrado
    })),
    skipDuplicates: true,
  });
}

async function main() {
  console.log('🌱 Seeding database...');

  // Limpiar tablas en orden FK correcto
  await prisma.certification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trainingExemption.deleteMany();
  await prisma.training.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.businessHours.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.space.deleteMany();

  // ── Espacios ────────────────────────────────────────────────────────────────
  await prisma.space.createMany({
    data: [
      { id: SPACE_IDS.puenteAlto, name: 'Puente Alto' },
      { id: SPACE_IDS.chillan, name: 'Chillán' },
      { id: SPACE_IDS.valparaiso, name: 'Valparaíso' },
    ],
  });
  console.log('✅ Espacios creados');

  // ── Business hours y categorías para cada espacio ───────────────────────────
  await createBusinessHoursForSpace(SPACE_IDS.puenteAlto);
  await createBusinessHoursForSpace(SPACE_IDS.chillan);
  await createBusinessHoursForSpace(SPACE_IDS.valparaiso);
  console.log('✅ Horarios de atención creados');

  const paCatIds = await createCategoriesForSpace(SPACE_IDS.puenteAlto);
  const chCatIds = await createCategoriesForSpace(SPACE_IDS.chillan);
  const vaCatIds = await createCategoriesForSpace(SPACE_IDS.valparaiso);
  console.log('✅ Categorías creadas (11 por espacio × 3 espacios)');

  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const superAdminPassword = await bcrypt.hash('super123', 10);

  // ── Super Admin (sin spaceId) ────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      name: 'Super Administrador',
      email: 'super@cowork.cl',
      password: superAdminPassword,
      role: 'SUPER_ADMIN' as Role,
      isVerified: true,
    },
  });

  // ── Admin y usuarios de Puente Alto ─────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador Puente Alto',
      email: 'admin@cowork.cl',
      password: adminPassword,
      role: Role.ADMIN,
      isVerified: true,
      spaceId: SPACE_IDS.puenteAlto,
    },
  });

  const maria = await prisma.user.create({
    data: { name: 'María González', email: 'maria@test.cl', password: hashedPassword, isVerified: true, spaceId: SPACE_IDS.puenteAlto },
  });
  const juan = await prisma.user.create({
    data: { name: 'Juan Pérez', email: 'juan@test.cl', password: hashedPassword, isVerified: true, spaceId: SPACE_IDS.puenteAlto },
  });
  await prisma.user.create({
    data: { name: 'Sofía Ramírez', email: 'sofia@test.cl', password: hashedPassword, isVerified: true, spaceId: SPACE_IDS.puenteAlto },
  });

  console.log('✅ Usuarios creados');

  // ── Recursos para los 3 espacios ────────────────────────────────────────────
  const paResources = await createResourcesForSpace(SPACE_IDS.puenteAlto, paCatIds);
  await createResourcesForSpace(SPACE_IDS.chillan, chCatIds);
  await createResourcesForSpace(SPACE_IDS.valparaiso, vaCatIds);

  console.log('✅ Recursos creados (17 por espacio × 3 espacios)');

  // ── Certificaciones de ejemplo (solo Puente Alto) ────────────────────────────
  await prisma.certification.create({
    data: {
      userId: maria.id,
      categoryId: paCatIds['RECTA_CASERA'],
      certifiedById: admin.id,
      notes: 'Certificada en inducción inicial',
    },
  });
  await prisma.certification.create({
    data: {
      userId: maria.id,
      categoryId: paCatIds['OVERLOCK_CASERA'],
      certifiedById: admin.id,
    },
  });
  console.log('✅ Certificaciones de ejemplo creadas');

  // ── Reservas de prueba (Puente Alto) ────────────────────────────────────────
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const makeDateTime = (daysFromMonday: number, hour: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + daysFromMonday);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  await prisma.booking.createMany({
    data: [
      {
        userId: maria.id, resourceId: paResources.xb2500_1.id,
        startTime: makeDateTime(0, 9), endTime: makeDateTime(0, 10),
        purpose: BookingPurpose.PRODUCE, produceItem: 'Camisas', produceQty: 10,
        notes: 'Producción semanal', status: BookingStatus.CONFIRMED,
      },
      {
        userId: maria.id, resourceId: paResources.bm3850_1.id,
        startTime: makeDateTime(1, 10), endTime: makeDateTime(1, 11),
        purpose: BookingPurpose.LEARN, notes: 'Práctica de puntadas',
        status: BookingStatus.CONFIRMED,
      },
      {
        userId: juan.id, resourceId: paResources.xb2500_2.id,
        startTime: makeDateTime(2, 9), endTime: makeDateTime(2, 10),
        purpose: BookingPurpose.PRODUCE, produceItem: 'Pantalones', produceQty: 5,
        status: BookingStatus.CONFIRMED,
      },
      {
        userId: maria.id, resourceId: paResources.pe910l.id,
        startTime: makeDateTime(2, 14), endTime: makeDateTime(2, 15),
        purpose: BookingPurpose.DESIGN, notes: 'Bordado de logo',
        status: BookingStatus.PENDING,
      },
      {
        userId: juan.id, resourceId: paResources.st371_1.id,
        startTime: makeDateTime(3, 11), endTime: makeDateTime(3, 12),
        purpose: BookingPurpose.PRODUCE, produceItem: 'Delantales', produceQty: 8,
        status: BookingStatus.CONFIRMED,
      },
    ],
  });

  console.log('✅ Reservas de prueba creadas');

  await prisma.comment.createMany({
    data: [
      {
        userId: admin.id,
        content: '¡Bienvenidas al espacio textil! Recuerden respetar los horarios y dejar las máquinas en buen estado.',
        tag: 'GENERAL',
        spaceId: SPACE_IDS.puenteAlto,
      },
      {
        userId: maria.id,
        content: 'Las rectas Brother XB2500 están funcionando excelente para puntada recta y zigzag.',
        tag: 'GENERAL',
        spaceId: SPACE_IDS.puenteAlto,
      },
    ],
  });

  console.log('✅ Comentarios creados');
  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('Credenciales:');
  console.log('  Super Admin: super@cowork.cl  / super123');
  console.log('  Admin PA:    admin@cowork.cl  / admin123');
  console.log('  User 1:      maria@test.cl          / password123');
  console.log('  User 2:      juan@test.cl           / password123');
  console.log('  User 3:      sofia@test.cl          / password123');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
