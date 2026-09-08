// Seed: platform super admin + demo org/school + role permissions reference.
import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  const hash = await argon2.hash('Admin#12345', { type: argon2.argon2id })

  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      email: 'superadmin@ssos.local',
      passwordHash: hash,
      fullName: 'Platform Super Admin',
      isPlatformAdmin: true,
    },
  })

  const org = await prisma.organization.upsert({
    where: { code: 'DEMO-ORG' },
    update: {},
    create: { name: 'Yayasan Pendidikan Demo', code: 'DEMO-ORG' },
  })

  const school = await prisma.school.upsert({
    where: { code: 'SMA-DEMO' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'SMA Demo Nusantara',
      code: 'SMA-DEMO',
      npsn: '20100001',
      address: 'Jl. Pendidikan No. 1, Jakarta',
      principalName: 'Drs. Bambang Sutrisno, M.Pd.',
    },
  })

  await prisma.membership.upsert({
    where: { userId_schoolId_role: { userId: superAdmin.id, schoolId: school.id, role: 'SUPER_ADMIN' } },
    update: {},
    create: { userId: superAdmin.id, schoolId: school.id, role: 'SUPER_ADMIN', isPrimary: true },
  })

  // Academic year 2025/2026 with 2 semesters
  const ay = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: '2025/2026' } },
    update: {},
    create: {
      schoolId: school.id,
      name: '2025/2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isCurrent: true,
    },
  })
  await prisma.semester.upsert({
    where: { academicYearId_sequence: { academicYearId: ay.id, sequence: 1 } },
    update: {},
    create: { academicYearId: ay.id, name: 'Ganjil', sequence: 1, isCurrent: true },
  })
  await prisma.semester.upsert({
    where: { academicYearId_sequence: { academicYearId: ay.id, sequence: 2 } },
    update: {},
    create: { academicYearId: ay.id, name: 'Genap', sequence: 2 },
  })

  console.log('Seed OK: superadmin / Admin#12345, org DEMO-ORG, school SMA-DEMO, AY 2025/2026')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
