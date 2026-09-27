/**
 * Permission catalog. Permissions are `subject.action` strings, the single
 * vocabulary shared by the RBAC layer, policies, UI affordances, and AI tools.
 *
 * The database stores Role -> RolePermission -> Permission rows seeded from this
 * catalog. Keeping the canonical list here (a) guarantees the seed and the code
 * never drift, and (b) gives us a compile-time union to check against.
 */

export const PERMISSIONS = {
  // Platform / tenant administration
  "platform.manage": "Create and manage tenants, platform-wide settings",
  "tenant.read": "View school/tenant settings",
  "tenant.update": "Update school/tenant settings",
  "tenant.manage_billing": "Manage platform billing for the tenant",

  "campus.read": "View campuses",
  "campus.create": "Create campuses",
  "campus.update": "Update campuses",
  "campus.delete": "Delete campuses",

  // Users, roles, permissions
  "user.read": "View users",
  "user.create": "Create users",
  "user.update": "Update users",
  "user.delete": "Delete users",
  "user.reset_password": "Reset another user's password",
  "role.read": "View roles",
  "role.create": "Create roles",
  "role.update": "Update roles and permissions",
  "role.delete": "Delete roles",
  "membership.manage": "Manage user membership in the tenant",

  // Academic structure
  "academic.read": "View academic structure",
  "academic.manage": "Manage academic years, terms, grade levels",
  "class.read": "View classes",
  "class.manage": "Manage classes and enrollment",
  "subject.read": "View subjects",
  "subject.manage": "Manage subjects and curriculum",
  "timetable.read": "View timetables",
  "timetable.manage": "Manage timetables and scheduling",

  // Students
  "student.read": "View student records",
  "student.read_sensitive": "View sensitive student fields (medical, special-ed)",
  "student.create": "Create students",
  "student.update": "Update students",
  "student.delete": "Delete (archive) students",
  "student.export": "Export student data",
  "student.import": "Import student data",

  // Teachers / staff
  "teacher.read": "View teacher records",
  "teacher.create": "Create teachers",
  "teacher.update": "Update teachers",
  "teacher.delete": "Delete (archive) teachers",
  "staff.read": "View staff records",
  "staff.manage": "Manage staff records",

  // Guardians
  "guardian.read": "View guardian records",
  "guardian.create": "Create guardians",
  "guardian.update": "Update guardians",
  "guardian.delete": "Delete guardians",
  "guardian.link": "Link guardians to students",

  // Attendance
  "attendance.read": "View attendance",
  "attendance.read_own": "View own attendance",
  "attendance.manage": "Open and manage attendance sessions",
  "attendance.scan": "Scan student QR to record attendance",
  "attendance.override": "Manually override attendance records",
  "attendance.export": "Export attendance",

  // Grades
  "grade.read": "View grades (scoped)",
  "grade.read_own": "View own grades",
  "grade.write": "Enter grades",
  "grade.submit": "Submit grades for review",
  "grade.approve": "Approve grades",
  "grade.publish": "Publish grades to students/parents",

  // Assignments / materials
  "assignment.read": "View assignments",
  "assignment.manage": "Create and manage assignments",
  "assignment.submit": "Submit assignment work",
  "material.read": "View learning materials",
  "material.manage": "Manage learning materials",

  // Admissions (PPDB)
  "admission.read": "View admission periods and applications",
  "admission.manage": "Manage admission periods, tracks, forms",
  "admission.verify": "Verify applicant documents",
  "admission.decide": "Accept or reject applicants",
  "admission.convert": "Convert accepted applicants into students",
  "admission.apply": "Apply as an applicant",

  // CMS / public site
  "cms.read": "View CMS content",
  "cms.create": "Create CMS content",
  "cms.update": "Update CMS content",
  "cms.delete": "Delete CMS content",
  "cms.publish": "Publish CMS content",
  "media.read": "View media library",
  "media.manage": "Upload and manage media",

  // Communication
  "announcement.read": "View announcements",
  "announcement.manage": "Create and manage announcements",
  "message.read": "View messages",
  "message.send": "Send messages",
  "notification.manage": "Manage notification templates and delivery",

  // Library
  "library.read": "View library catalog",
  "library.manage": "Manage library items and loans",
  "library.borrow": "Borrow and return library items",

  // Finance
  "finance.read": "View finance data",
  "finance.manage": "Manage fees, invoices, payments",
  "finance.export": "Export finance data",

  // Assets / facilities
  "asset.read": "View assets",
  "asset.manage": "Manage assets and maintenance",
  "facility.read": "View facilities",
  "facility.book": "Book facilities",
  "facility.manage": "Manage facilities and bookings",

  // Extracurricular / achievements
  "extracurricular.read": "View extracurricular activities",
  "extracurricular.manage": "Manage extracurricular activities",
  "achievement.read": "View achievements",
  "achievement.manage": "Manage achievements",

  // Wellbeing
  "counseling.read": "View counseling records",
  "counseling.manage": "Manage counseling records",
  "discipline.read": "View discipline records",
  "discipline.manage": "Manage discipline records",

  // Documents / data
  "document.read": "View documents",
  "document.manage": "Manage documents",
  "reporting.read": "View reports and analytics",
  "reporting.manage": "Build and run reports",
  "audit.read": "View audit trail",

  // System
  "setting.read": "View system settings",
  "setting.manage": "Manage system settings and feature flags",
  "apikey.manage": "Manage API keys and webhooks",
  "ai.use": "Use the AI assistant",
}

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** Human-readable description for a permission (used in the role editor). */
export function describePermission(p: Permission): string {
  return PERMISSIONS[p];
}

/** Group a permission by its subject prefix (e.g. "student" from "student.read"). */
export function permissionSubject(p: Permission): string {
  const idx = p.indexOf(".");
  return idx === -1 ? p : p.slice(0, idx);
}
