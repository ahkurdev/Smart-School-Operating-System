import { ALL_PERMISSIONS, permissionSubject, type Permission } from "@/lib/permissions";

/**
 * Role definitions. These are templates: when a tenant is created, its roles are
 * materialised from these definitions (customisable afterwards). Platform roles
 * have `tenantId: null`; tenant roles are per-tenant rows.
 */

export type RoleSeed = {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  isDefault: boolean;
  /** Permission keys granted. "*" means all permissions. */
  permissions: Permission[] | "*";
};

const PLATFORM: RoleSeed[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Platform-wide administrator across all schools.",
    isSystem: true,
    isDefault: false,
    permissions: "*",
  },
  {
    key: "platform_admin",
    name: "Platform Admin",
    description: "Manages tenants and platform configuration.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "platform.manage",
      "tenant.read",
      "tenant.update",
      "tenant.manage_billing",
      "user.read",
      "role.read",
      "audit.read",
      "setting.read",
      "setting.manage",
      "reporting.read",
    ],
  },
];

/** Tenant-scoped roles, materialised per school. */
const TENANT: RoleSeed[] = [
  {
    key: "school_owner",
    name: "School Owner",
    description: "Owns the school account; full control within the tenant.",
    isSystem: true,
    isDefault: false,
    permissions: "*",
  },
  {
    key: "principal",
    name: "Principal",
    description: "Leads the school; broad read and approval authority.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "tenant.read",
      "campus.read",
      "user.read",
      "role.read",
      "academic.read", "academic.manage",
      "class.read", "class.manage",
      "subject.read", "subject.manage",
      "timetable.read", "timetable.manage",
      "student.read", "student.read_sensitive", "student.create", "student.update", "student.export",
      "teacher.read", "teacher.create", "teacher.update",
      "staff.read", "staff.manage",
      "guardian.read",
      "attendance.read", "attendance.export",
      "grade.read", "grade.approve", "grade.publish",
      "assignment.read", "material.read",
      "admission.read", "admission.verify", "admission.decide", "admission.convert",
      "cms.read", "cms.create", "cms.update", "cms.publish",
      "media.read", "media.manage",
      "announcement.read", "announcement.manage",
      "message.read", "message.send",
      "library.read",
      "finance.read", "finance.export",
      "asset.read", "facility.read", "facility.manage",
      "extracurricular.read", "extracurricular.manage",
      "achievement.read", "achievement.manage",
      "counseling.read", "discipline.read",
      "document.read", "document.manage",
      "reporting.read", "reporting.manage",
      "audit.read", "setting.read", "ai.use",
    ],
  },
  {
    key: "vice_principal",
    name: "Vice Principal",
    description: "Supports the principal with academic operations.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "tenant.read", "campus.read", "user.read",
      "academic.read", "class.read", "class.manage", "subject.read",
      "timetable.read", "timetable.manage",
      "student.read", "student.update", "student.export",
      "teacher.read", "staff.read",
      "guardian.read",
      "attendance.read", "attendance.export", "attendance.override",
      "grade.read", "grade.approve",
      "admission.read", "admission.verify",
      "announcement.read", "announcement.manage",
      "message.read", "message.send",
      "counseling.read", "discipline.read", "discipline.manage",
      "document.read",
      "reporting.read", "ai.use",
    ],
  },
  {
    key: "school_admin",
    name: "School Admin",
    description: "Day-to-day administrator for people and records.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "tenant.read", "campus.read", "campus.create", "campus.update",
      "user.read", "user.create", "user.update", "user.reset_password",
      "role.read", "membership.manage",
      "academic.read", "academic.manage",
      "class.read", "class.manage", "subject.read", "subject.manage",
      "timetable.read", "timetable.manage",
      "student.read", "student.read_sensitive", "student.create", "student.update", "student.import", "student.export",
      "teacher.read", "teacher.create", "teacher.update", "teacher.delete",
      "staff.read", "staff.manage",
      "guardian.read", "guardian.create", "guardian.update", "guardian.delete", "guardian.link",
      "attendance.read", "attendance.manage", "attendance.override", "attendance.export",
      "grade.read",
      "admission.read", "admission.manage", "admission.verify", "admission.decide", "admission.convert",
      "cms.read", "media.read",
      "announcement.read", "announcement.manage",
      "message.read", "message.send",
      "library.read", "document.read", "document.manage",
      "reporting.read", "ai.use",
    ],
  },
  {
    key: "academic_admin",
    name: "Academic Admin",
    description: "Manages academic structure, grades workflow, and timetables.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "academic.read", "academic.manage",
      "class.read", "class.manage", "subject.read", "subject.manage",
      "timetable.read", "timetable.manage",
      "student.read", "student.update", "student.export",
      "teacher.read", "teacher.update",
      "attendance.read", "attendance.manage", "attendance.override", "attendance.export",
      "grade.read", "grade.approve", "grade.publish",
      "reporting.read", "reporting.manage",
      "document.read", "ai.use",
    ],
  },
  {
    key: "admission_admin",
    name: "Admissions Admin (PPDB)",
    description: "Manages admission periods, verification, and decisions.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "admission.read", "admission.manage", "admission.verify", "admission.decide", "admission.convert",
      "student.read", "student.create",
      "guardian.read", "guardian.create", "guardian.link",
      "document.read", "document.manage",
      "reporting.read", "ai.use",
    ],
  },
  {
    key: "finance_admin",
    name: "Finance Admin",
    description: "Manages fees, invoices, and payments.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read",
      "finance.read", "finance.manage", "finance.export",
      "reporting.read", "document.read", "ai.use",
    ],
  },
  {
    key: "librarian",
    name: "Librarian",
    description: "Manages the library catalog and loans.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read", "teacher.read",
      "library.read", "library.manage", "library.borrow",
      "document.read", "reporting.read", "ai.use",
    ],
  },
  {
    key: "counselor",
    name: "Counselor",
    description: "Provides counseling; strict access to wellbeing records.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read", "student.read_sensitive",
      "guardian.read",
      "counseling.read", "counseling.manage",
      "discipline.read",
      "attendance.read", "grade.read",
      "document.read", "ai.use",
    ],
  },
  {
    key: "homeroom_teacher",
    name: "Homeroom Teacher",
    description: "Leads a class; reviews attendance and grades for their class.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read", "student.update",
      "guardian.read",
      "class.read", "subject.read", "timetable.read",
      "attendance.read", "attendance.manage", "attendance.scan", "attendance.override", "attendance.export",
      "grade.read", "grade.write", "grade.submit",
      "assignment.read", "assignment.manage",
      "material.read", "material.manage",
      "announcement.read", "announcement.manage",
      "message.read", "message.send",
      "reporting.read", "ai.use",
    ],
  },
  {
    key: "teacher",
    name: "Teacher",
    description: "Teaches classes; records attendance and grades.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read",
      "class.read", "subject.read", "timetable.read",
      "attendance.read", "attendance.manage", "attendance.scan",
      "grade.read", "grade.write", "grade.submit",
      "assignment.read", "assignment.manage",
      "material.read", "material.manage",
      "announcement.read", "announcement.manage",
      "message.read", "message.send",
      "ai.use",
    ],
  },
  {
    key: "staff",
    name: "Staff",
    description: "General staff member with limited read access.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "student.read", "announcement.read", "message.read", "message.send", "ai.use",
    ],
  },
  {
    key: "student",
    name: "Student",
    description: "Learns; views their own schedule, attendance, grades, work.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "attendance.read_own", "grade.read_own",
      "assignment.read", "assignment.submit",
      "material.read", "announcement.read", "message.read", "message.send",
      "library.read", "library.borrow", "ai.use",
    ],
  },
  {
    key: "parent",
    name: "Parent / Guardian",
    description: "Sees their own children's progress.",
    isSystem: true,
    isDefault: false,
    permissions: [
      "attendance.read_own", "grade.read_own",
      "announcement.read", "message.read", "message.send",
      "ai.use",
    ],
  },
  {
    key: "applicant",
    name: "Applicant",
    description: "Applies for admission via the PPDB portal.",
    isSystem: true,
    isDefault: false,
    permissions: ["admission.apply"],
  },
];

export const PLATFORM_ROLES = PLATFORM;
export const TENANT_ROLES = TENANT;

export function expandPermissions(seed: RoleSeed): Permission[] {
  if (seed.permissions === "*") return ALL_PERMISSIONS;
  return seed.permissions.filter((p) => ALL_PERMISSIONS.includes(p));
}

export { permissionSubject };
