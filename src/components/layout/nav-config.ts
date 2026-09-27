import type { Permission } from "@/lib/permissions";

/**
 * Admin navigation model. Grouped by domain (never a flat list of 40 items, per
 * DESIGN.md). Each item carries the permission that gates it, so the sidebar can
 * be filtered server-side to what the actor may actually open.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Permission required to see the item. Omit for items everyone can open. */
  permission?: Permission;
  /** Optional feature-flag key; item hidden when the module is off. */
  feature?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/app" }],
  },
  {
    label: "People",
    items: [
      { label: "Students", href: "/app/students", permission: "student.read" },
      { label: "Teachers", href: "/app/teachers", permission: "teacher.read" },
      { label: "Guardians", href: "/app/guardians", permission: "guardian.read" },
      { label: "Staff", href: "/app/staff", permission: "staff.read" },
    ],
  },
  {
    label: "Academic",
    items: [
      { label: "Academic Years", href: "/app/academic-years", permission: "academic.read" },
      { label: "Classes", href: "/app/classes", permission: "class.read" },
      { label: "Subjects", href: "/app/subjects", permission: "subject.read" },
      { label: "Timetable", href: "/app/timetable", permission: "timetable.read" },
      { label: "Attendance", href: "/app/attendance", permission: "attendance.read" },
      { label: "Grades", href: "/app/grades", permission: "grade.read" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { label: "Applicants", href: "/app/admissions", permission: "admission.read" },
      { label: "Periods", href: "/app/admissions/periods", permission: "admission.manage" },
      { label: "Verification", href: "/app/admissions/verification", permission: "admission.verify" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", href: "/app/announcements", permission: "announcement.read" },
      { label: "Notifications", href: "/app/notifications", permission: "notification.manage" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Pages", href: "/app/cms/pages", permission: "cms.read" },
      { label: "News", href: "/app/cms/posts", permission: "cms.read" },
      { label: "Events", href: "/app/cms/events", permission: "cms.read" },
      { label: "Media", href: "/app/cms/media", permission: "media.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Library", href: "/app/library", permission: "library.read", feature: "library" },
      { label: "Finance", href: "/app/finance", permission: "finance.read", feature: "finance" },
      { label: "Assets", href: "/app/assets", permission: "asset.read" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", href: "/app/analytics", permission: "reporting.read" },
      { label: "AI Assistant", href: "/app/assistant", permission: "ai.use", feature: "ai" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users", href: "/app/users", permission: "user.read" },
      { label: "Roles", href: "/app/roles", permission: "role.read" },
      { label: "Integrations", href: "/app/integrations", permission: "apikey.manage" },
      { label: "Audit", href: "/app/audit", permission: "audit.read" },
      { label: "Settings", href: "/app/settings", permission: "setting.read" },
    ],
  },
];

/** Filter the navigation to the items an actor may see (permission + flags). */
export function filterNav(
  canPass: (permission: Permission) => boolean,
  isFeatureOn: (flag: string) => boolean,
): NavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.permission && !canPass(item.permission)) return false;
      if (item.feature && !isFeatureOn(item.feature)) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
