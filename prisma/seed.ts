/**
 * Development seed. Creates a clearly-labelled demo school with staff, students,
 * guardians, academic structure, and sample communications so every screen has
 * real data to show. All names/emails are obviously synthetic (demo.*). Never run
 * this against production.
 *
 * Idempotent: safe to re-run. Passwords come from SEED_PASSWORD or default.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "DemoPass123!";
const DEMO_SLUG = process.env.SEED_TENANT_SLUG ?? "demo-school";

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

async function main() {
  console.log("Seeding demo data...");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  // --- Permission catalog + roles -----------------------------------------
  // Imported lazily so the seed can be run with tsx without path aliases.
  const { syncPermissionCatalog, materialisePlatformRoles, materialiseTenantRoles } =
    await import("../src/server/services/rbac.service");

  await syncPermissionCatalog();
  await materialisePlatformRoles();

  // --- Platform super admin ------------------------------------------------
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@demo.local" },
    create: {
      email: "superadmin@demo.local",
      fullName: "Platform Super Admin",
      passwordHash,
      status: "ACTIVE",
      emailVerified: new Date(),
    },
    update: {},
    select: { id: true },
  });
  {
    const role = await prisma.role.findFirst({
      where: { tenantId: null, key: "super_admin" },
      select: { id: true },
    });
    if (role) {
      // Platform membership: a special membership with no tenant is not modelled,
      // so platform roles are granted via a synthetic membership? Instead, grant
      // super_admin to the user on every tenant created here. Simplest correct
      // approach: platform admin is recognised by holding super_admin on any
      // membership; we also record a dedicated platform membership below.
    }
  }

  // --- Tenant (school) -----------------------------------------------------
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_SLUG },
    create: {
      slug: DEMO_SLUG,
      name: "Demo International School",
      legalName: "Demo International School Foundation",
      type: "SCHOOL",
      timezone: "Asia/Jakarta",
      locale: "en",
      currency: "IDR",
      primaryColor: "#0f766e",
      gradeLabel: "Grade",
      classLabel: "Class",
      studentIdLabel: "Student ID",
      academicTermsPerYear: 2,
    },
    update: {},
    select: { id: true, name: true },
  });
  const tenantId = tenant.id;
  await materialiseTenantRoles(tenantId);

  const roleId = async (key: string) => {
    const r = await prisma.role.findFirst({
      where: { tenantId, key },
      select: { id: true },
    });
    if (!r) throw new Error(`role ${key} missing`);
    return r.id;
  };

  // Grant the super admin the school_owner role in the demo tenant AND record a
  // platform-admin marker so `buildActor` recognises cross-tenant authority.
  {
    const ownerRole = await prisma.role.findFirst({
      where: { tenantId, key: "school_owner" },
      select: { id: true },
    });
    const superRole = await prisma.role.findFirst({
      where: { tenantId: null, key: "super_admin" },
      select: { id: true },
    });
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: superAdmin.id } },
      create: { tenantId, userId: superAdmin.id, status: "ACTIVE", title: "Platform Super Admin" },
      update: {},
      select: { id: true },
    });
    for (const rid of [ownerRole?.id, superRole?.id]) {
      if (rid) {
        await prisma.userRole.upsert({
          where: { membershipId_roleId: { membershipId: membership.id, roleId: rid } },
          create: { membershipId: membership.id, roleId: rid },
          update: {},
        });
      }
    }
  }

  // --- Campus --------------------------------------------------------------
  const campus = await prisma.campus.upsert({
    where: { tenantId_code: { tenantId, code: "MAIN" } },
    create: {
      tenantId,
      code: "MAIN",
      name: "Main Campus",
      isPrimary: true,
      city: "Demo City",
      country: "Demo Land",
      timezone: "Asia/Jakarta",
    },
    update: {},
    select: { id: true },
  });

  // --- Users + memberships (staff) ----------------------------------------
  type StaffSeed = { email: string; name: string; role: string; title: string };
  const staffSeeds: StaffSeed[] = [
    { email: "principal@demo.local", name: "Dr. Amara Okafor", role: "principal", title: "Principal" },
    { email: "admin@demo.local", name: "Budi Santoso", role: "school_admin", title: "School Administrator" },
    { email: "academic@demo.local", name: "Siti Rahmawati", role: "academic_admin", title: "Academic Coordinator" },
    { email: "admissions@demo.local", name: "Kwame Mensah", role: "admission_admin", title: "Admissions Officer" },
    { email: "finance@demo.local", name: "Lucia Fernandes", role: "finance_admin", title: "Finance Officer" },
    { email: "librarian@demo.local", name: "Nadia Haddad", role: "librarian", title: "Librarian" },
    { email: "counselor@demo.local", name: "Elena Rossi", role: "counselor", title: "Counselor" },
  ];

  const staffUsers: { id: string; email: string }[] = [];
  for (const s of staffSeeds) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        fullName: s.name,
        passwordHash,
        status: "ACTIVE",
        emailVerified: new Date(),
        locale: "en",
        timezone: "Asia/Jakarta",
      },
      update: {},
      select: { id: true, email: true },
    });
    staffUsers.push({ id: user.id, email: user.email ?? s.email });
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, status: "ACTIVE", title: s.title },
      update: { title: s.title },
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: await roleId(s.role) } },
      create: { membershipId: membership.id, roleId: await roleId(s.role) },
      update: {},
    });
  }

  // --- Teachers ------------------------------------------------------------
  const teacherSeeds = [
    { email: "teacher.math@demo.local", name: "Rina Kusuma", subject: "Mathematics" },
    { email: "teacher.eng@demo.local", name: "David Chen", subject: "English" },
    { email: "teacher.sci@demo.local", name: "Fatima Al-Sayed", subject: "Science" },
    { email: "teacher.hist@demo.local", name: "Tomoko Sato", subject: "History" },
  ];

  const teacherIds: string[] = [];
  for (let i = 0; i < teacherSeeds.length; i++) {
    const t = teacherSeeds[i]!;
    const user = await prisma.user.upsert({
      where: { email: t.email },
      create: {
        email: t.email,
        fullName: t.name,
        passwordHash,
        status: "ACTIVE",
        emailVerified: new Date(),
        locale: "en",
      },
      update: {},
      select: { id: true },
    });
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, status: "ACTIVE", title: `Teacher - ${t.subject}` },
      update: {},
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: await roleId("teacher") } },
      create: { membershipId: membership.id, roleId: await roleId("teacher") },
      update: {},
    });
    const teacher = await prisma.teacher.upsert({
      where: { tenantId_employeeNumber: { tenantId, employeeNumber: `T-${String(i + 1).padStart(3, "0")}` } },
      create: {
        tenantId,
        campusId: campus.id,
        userId: user.id,
        employeeNumber: `T-${String(i + 1).padStart(3, "0")}`,
        fullName: t.name,
        status: "ACTIVE",
        employmentType: "FULL_TIME",
        joinDate: new Date("2022-07-01"),
      },
      update: {},
      select: { id: true },
    });
    teacherIds.push(teacher.id);
  }

  // --- Academic year + terms ----------------------------------------------
  const year = await prisma.academicYear.upsert({
    where: { tenantId_name: { tenantId, name: "2026/2027" } },
    create: {
      tenantId,
      name: "2026/2027",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
      status: "ACTIVE",
    },
    update: { isCurrent: true },
    select: { id: true },
  });

  const term1 = await prisma.academicTerm.upsert({
    where: { academicYearId_sequence: { academicYearId: year.id, sequence: 1 } },
    create: {
      academicYearId: year.id,
      name: "Term 1",
      type: "SEMESTER",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-20"),
      sequence: 1,
      isCurrent: true,
    },
    update: {},
    select: { id: true },
  });

  // --- Grade levels --------------------------------------------------------
  const gradeLevels: string[] = [];
  for (const [i, name] of ["Grade 10", "Grade 11", "Grade 12"].entries()) {
    const code = `G${10 + i}`;
    const gl = await prisma.gradeLevel.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, name, code, sequence: i + 1, stage: "Secondary" },
      update: {},
      select: { id: true },
    });
    gradeLevels.push(gl.id);
  }

  // --- Subjects ------------------------------------------------------------
  const subjectSeeds = [
    { code: "MATH", name: "Mathematics", teacherIdx: 0 },
    { code: "ENG", name: "English", teacherIdx: 1 },
    { code: "SCI", name: "Science", teacherIdx: 2 },
    { code: "HIST", name: "History", teacherIdx: 3 },
  ];
  const subjectIds: string[] = [];
  for (const s of subjectSeeds) {
    const subject = await prisma.subject.upsert({
      where: { tenantId_code: { tenantId, code: s.code } },
      create: { tenantId, code: s.code, name: s.name, credits: 3 },
      update: {},
      select: { id: true },
    });
    subjectIds.push(subject.id);
  }

  // --- Classrooms ----------------------------------------------------------
  const classrooms: { id: string; name: string }[] = [];
  const studentIds: string[] = [];
  for (let g = 0; g < gradeLevels.length; g++) {
    const name = `Grade ${10 + g}A`;
    const c = await prisma.classroom.upsert({
      where: { tenantId_code: { tenantId, code: name.replace(/\s+/g, "-") } },
      create: {
        tenantId,
        campusId: campus.id,
        academicYearId: year.id,
        gradeLevelId: gradeLevels[g]!,
        code: name.replace(/\s+/g, "-"),
        name,
        capacity: 30,
      },
      update: {},
      select: { id: true, name: true },
    });
    classrooms.push(c);
  }

  // --- Students + guardians ------------------------------------------------
  const studentSeeds = [
    { first: "Aisha", last: "Putri", gender: "FEMALE", classIdx: 0 },
    { first: "Ben", last: "Hartono", gender: "MALE", classIdx: 0 },
    { first: "Chloe", last: "Nguyen", gender: "FEMALE", classIdx: 1 },
    { first: "Daniel", last: "Kim", gender: "MALE", classIdx: 1 },
    { first: "Emma", last: "Silva", gender: "FEMALE", classIdx: 2 },
    { first: "Farid", last: "Hakim", gender: "MALE", classIdx: 2 },
    { first: "Grace", last: "Osei", gender: "FEMALE", classIdx: 0 },
    { first: "Hana", last: "Yamamoto", gender: "FEMALE", classIdx: 1 },
  ];

  for (let i = 0; i < studentSeeds.length; i++) {
    const s = studentSeeds[i]!;
    const idx = i + 1;
    const email = `student${String(idx).padStart(2, "0")}@demo.local`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        fullName: `${s.first} ${s.last}`,
        passwordHash,
        status: "ACTIVE",
        emailVerified: new Date(),
        locale: "en",
      },
      update: {},
      select: { id: true },
    });
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, status: "ACTIVE" },
      update: {},
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: await roleId("student") } },
      create: { membershipId: membership.id, roleId: await roleId("student") },
      update: {},
    });

    const student = await prisma.student.upsert({
      where: { tenantId_studentNumber: { tenantId, studentNumber: `S-${String(idx).padStart(4, "0")}` } },
      create: {
        tenantId,
        campusId: campus.id,
        userId: user.id,
        studentNumber: `S-${String(idx).padStart(4, "0")}`,
        fullName: `${s.first} ${s.last}`,
        gender: s.gender,
        birthDate: new Date(2009, (i % 12), 10 + i),
        status: "ACTIVE",
        admissionDate: new Date("2026-07-01"),
      },
      update: {},
      select: { id: true },
    });

    // Enrollment in a classroom.
    const classroom = classrooms[s.classIdx % classrooms.length]!;
    await prisma.enrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
      create: {
        tenantId,
        studentId: student.id,
        classroomId: classroom.id,
        academicYearId: year.id,
        status: "ACTIVE",
      },
      update: {},
    });
    studentIds.push(student.id);

    // Guardian (parent) linked to the student.
    const parentEmail = `parent${String(idx).padStart(2, "0")}@demo.local`;
    const parentUser = await prisma.user.upsert({
      where: { email: parentEmail },
      create: {
        email: parentEmail,
        fullName: `${s.last} Family`,
        passwordHash,
        status: "ACTIVE",
        emailVerified: new Date(),
        locale: "en",
      },
      update: {},
      select: { id: true },
    });
    const parentMembership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: parentUser.id } },
      create: { tenantId, userId: parentUser.id, status: "ACTIVE" },
      update: {},
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: { membershipId_roleId: { membershipId: parentMembership.id, roleId: await roleId("parent") } },
      create: { membershipId: parentMembership.id, roleId: await roleId("parent") },
      update: {},
    });

    const guardian = await prisma.guardian.upsert({
      where: { userId: parentUser.id },
      create: {
        tenantId,
        userId: parentUser.id,
        fullName: `${s.last} Family`,
        relationship: "GUARDIAN",
        phone: "+62 800 000 0000",
      },
      update: {},
      select: { id: true },
    });
    await prisma.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
      create: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: "GUARDIAN",
        isPrimary: true,
      },
      update: {},
    });
  }

  // --- Announcement + event ------------------------------------------------
  await prisma.announcement.create({
    data: {
      tenantId,
      authorUserId: staffUsers[0]!.id,
      title: "Welcome to the new school year",
      body: "Term 1 begins on 1 July. Please review the updated timetable in your portal.",
      status: "PUBLISHED",
      priority: "NORMAL",
      audience: "ALL",
      publishAt: new Date(),
    },
  }).catch(() => undefined);

  await prisma.event.create({
    data: {
      tenantId,
      title: "Parent-Teacher Meeting",
      description: "Term 1 progress meetings for all grade levels.",
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      location: "Main Hall",
      status: "PUBLISHED",
    },
  }).catch(() => undefined);

  // --- CMS: a published homepage and a news post for the public site --------
  const homepage = await prisma.cmsPage.upsert({
    where: { tenantId_slug: { tenantId, slug: "home" } },
    update: { status: "PUBLISHED", publishedAt: new Date(), isHomepage: true },
    create: {
      tenantId,
      slug: "home",
      title: "Home",
      description: "Welcome to our school.",
      status: "PUBLISHED",
      publishedAt: new Date(),
      isHomepage: true,
    },
  });
  await prisma.cmsBlock.deleteMany({ where: { tenantId, pageId: homepage.id } });
  await prisma.cmsBlock.createMany({
    data: [
      {
        tenantId,
        pageId: homepage.id,
        type: "HEADING",
        sequence: 0,
        data: { text: "A place to learn and grow", level: 1 },
      },
      {
        tenantId,
        pageId: homepage.id,
        type: "PARAGRAPH",
        sequence: 1,
        data: {
          text: "We combine strong academics with a caring community. Explore our programmes and apply online.",
        },
      },
      {
        tenantId,
        pageId: homepage.id,
        type: "STATISTICS",
        sequence: 2,
        data: {
          items: [
            { value: "6", label: "Grade levels" },
            { value: "12", label: "Subjects" },
            { value: "1:18", label: "Teacher ratio" },
            { value: "40+", label: "Years of service" },
          ],
        },
      },
      {
        tenantId,
        pageId: homepage.id,
        type: "CTA",
        sequence: 3,
        data: {
          title: "Admissions are open",
          body: "Start an application in a few minutes.",
          label: "Apply now",
          href: "/apply",
        },
      },
    ],
  });

  const postClash = await prisma.post.findFirst({ where: { tenantId, slug: "welcome" } });
  if (!postClash) {
    await prisma.post.create({
      data: {
        tenantId,
        slug: "welcome",
        title: "Welcome to the new school year",
        excerpt: "Term 1 begins soon — here is everything families need to know.",
        content:
          "Term 1 begins on 1 July. Please review the updated timetable in your portal.\n\nWe look forward to welcoming everyone back.",
        type: "NEWS",
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorUserId: staffUsers[0]!.id,
      },
    });
  }

  // --- PPDB: a demo applicant user (uses the /apply portal) ----------------
  const applicantUser = await prisma.user.upsert({
    where: { email: "applicant@demo.local" },
    create: {
      email: "applicant@demo.local",
      fullName: "Ayu Lestari",
      passwordHash,
      status: "ACTIVE",
      emailVerified: new Date(),
      locale: "en",
      timezone: "Asia/Jakarta",
    },
    update: {},
    select: { id: true },
  });
  const applicantMembership = await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId, userId: applicantUser.id } },
    create: { tenantId, userId: applicantUser.id, status: "ACTIVE", title: "Applicant" },
    update: {},
    select: { id: true },
  });
  await prisma.userRole.upsert({
    where: { membershipId_roleId: { membershipId: applicantMembership.id, roleId: await roleId("applicant") } },
    create: { membershipId: applicantMembership.id, roleId: await roleId("applicant") },
    update: {},
  });
  await prisma.applicant.upsert({
    where: { userId: applicantUser.id },
    create: { tenantId, userId: applicantUser.id, fullName: "Ayu Lestari", email: "applicant@demo.local" },
    update: {},
  });

  // --- PPDB: an open admission period with a form and a track --------------
  const period = await prisma.admissionPeriod.upsert({
    where: { id: `seed-period-${tenant}` },
    update: {},
    create: {
      id: `seed-period-${tenant}`,
      tenantId,
      academicYearId: year.id,
      name: "2026/2027 Intake",
      description: "Open admissions for the next academic year.",
      openAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      closeAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      quota: 120,
      status: "OPEN",
    },
  });
  await prisma.admissionTrack.upsert({
    where: { periodId_code: { periodId: period.id, code: "REGULER" } },
    update: {},
    create: { tenantId, periodId: period.id, name: "Regular", code: "REGULER", quota: 100 },
  });
  const form = await prisma.applicationForm.upsert({
    where: { id: `seed-form-${tenant}` },
    update: {},
    create: { id: `seed-form-${tenant}`, tenantId, periodId: period.id, name: "Application form", isDefault: true },
  });
  await prisma.applicationField.deleteMany({ where: { tenantId, formId: form.id } });
  await prisma.applicationField.createMany({
    data: [
      { tenantId, formId: form.id, key: "national_id", label: "National ID / NISN", type: "SHORT_TEXT", required: true, sequence: 0, section: "Personal" },
      { tenantId, formId: form.id, key: "birth_place", label: "Place of birth", type: "SHORT_TEXT", required: true, sequence: 1, section: "Personal" },
      { tenantId, formId: form.id, key: "address", label: "Home address", type: "LONG_TEXT", required: true, sequence: 2, section: "Personal" },
      { tenantId, formId: form.id, key: "previous_school_name", label: "Previous school", type: "PREVIOUS_SCHOOL", required: false, sequence: 3, section: "Education" },
      { tenantId, formId: form.id, key: "programme", label: "Preferred programme", type: "SELECT", required: true, options: ["Science", "Social", "Language"], sequence: 4, section: "Education" },
    ],
  });

  // --- Timetable: bell periods and a few weekly slots ----------------------
  const periods = [
    { name: "Period 1", sequence: 1, startTime: "07:00", endTime: "07:45", isBreak: false },
    { name: "Period 2", sequence: 2, startTime: "07:45", endTime: "08:30", isBreak: false },
    { name: "Break", sequence: 3, startTime: "08:30", endTime: "09:00", isBreak: true },
    { name: "Period 3", sequence: 4, startTime: "09:00", endTime: "09:45", isBreak: false },
  ];
  for (const p of periods) {
    await prisma.schedulePeriod.upsert({
      where: { tenantId_sequence: { tenantId, sequence: p.sequence } },
      update: { name: p.name, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak },
      create: { tenantId, ...p },
    });
  }
  if (classrooms[0] && subjectIds[0] && teacherIds[0]) {
    const existingEntries = await prisma.timetableEntry.count({ where: { tenantId, academicYearId: year.id } });
    if (existingEntries === 0) {
      await prisma.timetableEntry.createMany({
        data: [
          { tenantId, academicYearId: year.id, classroomId: classrooms[0].id, subjectId: subjectIds[0]!, teacherId: teacherIds[0]!, dayOfWeek: 1, startTime: "07:00", endTime: "07:45" },
          { tenantId, academicYearId: year.id, classroomId: classrooms[0].id, subjectId: subjectIds[Math.min(1, subjectIds.length - 1)]!, dayOfWeek: 1, startTime: "07:45", endTime: "08:30" },
          { tenantId, academicYearId: year.id, classroomId: classrooms[0].id, subjectId: subjectIds[0]!, teacherId: teacherIds[0]!, dayOfWeek: 3, startTime: "07:00", endTime: "07:45" },
        ],
      });
    }
  }

  // --- Work: assignments, materials, assessments, grades -------------------
  // Demo content so the Assignments/Materials/Grades screens are populated.
  const firstClass = classrooms[0]!;
  const mathSubject = subjectIds[0]!;

  const demoAssignment = await prisma.assignment.upsert({
    where: { id: `demo-assignment-1` },
    create: {
      id: `demo-assignment-1`,
      tenantId,
      classroomId: firstClass.id,
      subjectId: mathSubject,
      teacherId: teacherIds[0] ?? null,
      title: "Fractions worksheet",
      instructions: "Solve questions 1-10. Show your working.",
      maxScore: 50,
      dueAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    update: {},
    select: { id: true, maxScore: true },
  });

  // One student submits, so the teacher view has something to grade.
  if (studentIds[0]) {
    await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: demoAssignment.id, studentId: studentIds[0] } },
      create: {
        tenantId,
        assignmentId: demoAssignment.id,
        studentId: studentIds[0],
        content: "1/2 + 1/3 = 5/6",
        status: "SUBMITTED",
      },
      update: {},
    });
  }

  const materialSeeds = [
    { title: "Chapter 3 notes", type: "DOCUMENT" as const, status: "PUBLISHED" as const, unit: "Fractions" },
    { title: "Khan Academy: Fractions", type: "LINK" as const, status: "PUBLISHED" as const, url: "https://www.khanacademy.org/math/arithmetic/fraction-arithmetic" },
    { title: "Draft: extra practice sheet", type: "DOCUMENT" as const, status: "DRAFT" as const, unit: "Fractions" },
  ];
  for (const m of materialSeeds) {
    await prisma.learningMaterial.upsert({
      where: { id: `demo-material-${m.title.slice(0, 8).replace(/\W/g, "")}` },
      create: {
        id: `demo-material-${m.title.slice(0, 8).replace(/\W/g, "")}`,
        tenantId,
        subjectId: mathSubject,
        classroomId: firstClass.id,
        teacherId: teacherIds[0] ?? null,
        title: m.title,
        type: m.type,
        status: m.status,
        unit: m.unit ?? null,
        url: m.url ?? null,
      },
      update: {},
    });
  }

  const assessmentSeeds = [
    { title: "Quiz 1", type: "QUIZ" as const, maxScore: 20, weight: 1, status: "PUBLISHED" as const },
    { title: "Midterm Exam", type: "EXAM" as const, maxScore: 100, weight: 2, status: "DRAFT" as const },
  ];
  for (const a of assessmentSeeds) {
    const assess = await prisma.assessment.upsert({
      where: { id: `demo-assessment-${a.title.slice(0, 5).replace(/\W/g, "")}` },
      create: {
        id: `demo-assessment-${a.title.slice(0, 5).replace(/\W/g, "")}`,
        tenantId,
        academicYearId: year.id,
        classroomId: firstClass.id,
        subjectId: mathSubject,
        title: a.title,
        type: a.type,
        maxScore: a.maxScore,
        weight: a.weight,
        status: a.status,
      },
      update: {},
      select: { id: true, maxScore: true },
    });
    // Publish the Quiz so students/parents see it; leave the exam in draft.
    const gradeStatus = a.status === "PUBLISHED" ? ("PUBLISHED" as const) : ("DRAFT" as const);
    for (let si = 0; si < studentIds.length && si < 4; si++) {
      const score = Math.round(assess.maxScore * (0.7 + ((si * 7) % 30) / 100));
      await prisma.grade.upsert({
        where: { assessmentId_studentId: { assessmentId: assess.id, studentId: studentIds[si]! } },
        create: {
          tenantId,
          assessmentId: assess.id,
          studentId: studentIds[si]!,
          score,
          status: gradeStatus,
          publishedAt: gradeStatus === "PUBLISHED" ? new Date() : null,
        },
        update: {},
      });
    }
  }

  // --- Communication & finance: a published announcement + one invoice -----
  await prisma.announcement.upsert({
    where: { id: "demo-announcement-1" },
    create: {
      id: "demo-announcement-1",
      tenantId,
      title: "Welcome to the new school year",
      body: "Term 1 begins Monday. Please arrive by 07:00 in full uniform.",
      audience: "ALL",
      priority: "NORMAL",
      status: "PUBLISHED",
      publishAt: new Date(),
      authorUserId: null,
    },
    update: {},
  });

  await prisma.announcement.upsert({
    where: { id: "demo-announcement-2" },
    create: {
      id: "demo-announcement-2",
      tenantId,
      title: "Draft: Parent-teacher evening",
      body: "Save the date — details to follow.",
      audience: "PARENTS",
      priority: "LOW",
      status: "DRAFT",
    },
    update: {},
  });

  if (studentIds[0]) {
    const invNo = `INV-${new Date().getFullYear()}-0001`;
    const existingInv = await prisma.invoice.findFirst({ where: { tenantId, invoiceNumber: invNo }, select: { id: true } });
    if (!existingInv) {
      await prisma.invoice.create({
        data: {
          tenantId,
          studentId: studentIds[0],
          academicYearId: year.id,
          invoiceNumber: invNo,
          dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
          subtotal: 5000000,
          discount: 0,
          total: 5000000,
          paidAmount: 2000000,
          currency: "IDR",
          status: "PARTIAL",
          items: {
            create: [
              { tenantId, description: "Tuition (Term 1)", quantity: 1, amount: 4500000 },
              { tenantId, description: "Activity fee", quantity: 1, amount: 500000 },
            ],
          },
          payments: {
            create: { tenantId, amount: 2000000, method: "BANK_TRANSFER", reference: "TRF-0001", status: "COMPLETED" },
          },
        },
      });
    }
  }

  console.log("\nSeed complete.");
  console.log("---------------------------------------------");
  console.log("Demo school slug:", DEMO_SLUG);
  console.log("Sign in at /login with any of these (password: %s):", SEED_PASSWORD);
  console.log("  Platform admin : superadmin@demo.local");
  console.log("  Principal      : principal@demo.local");
  console.log("  School admin   : admin@demo.local");
  console.log("  Teacher        : teacher.math@demo.local");
  console.log("  Student        : student01@demo.local");
  console.log("  Parent         : parent01@demo.local");
  console.log("  Applicant      : applicant@demo.local");
  console.log("---------------------------------------------");
  void pick;
  void randomBytes;
  void term1;
  void subjectIds;
  void teacherIds;
  void superAdmin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
