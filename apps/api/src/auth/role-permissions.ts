/**
 * Static role -> permission map. Server-side source of truth.
 * Built-in roles get implicit permissions; CustomRole adds extra per membership.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  YAYASAN: ['school.read', 'school.manage', 'report.read', 'finance.read', 'audit.read'],
  KEPALA_SEKOLAH: [
    'school.read', 'student.read', 'student.read_sensitive', 'teacher.read',
    'attendance.read', 'attendance.manage', 'grade.read', 'grade.approve',
    'report.read', 'report.publish', 'finance.read', 'audit.read', 'timetable.read', 'timetable.manage',
  ],
  WAKIL_KEPALA: ['school.read', 'student.read', 'attendance.read', 'grade.read', 'timetable.read', 'timetable.manage'],
  ADMIN_SEKOLAH: ['*'],
  TATA_USAHA: ['student.read', 'student.create', 'student.update', 'document.read', 'document.manage'],
  BENDAHARA: ['finance.read', 'finance.manage', 'student.read'],
  WALI_KELAS: ['student.read', 'attendance.read', 'attendance.manage', 'grade.read', 'grade.input', 'rapor.input'],
  GURU: ['student.read', 'attendance.read', 'attendance.manage', 'grade.read', 'grade.input', 'lms.manage', 'assignment.manage'],
  GURU_BK: ['student.read', 'counseling.read', 'counseling.manage', 'student.read_sensitive'],
  PUSTAKAWAN: ['library.read', 'library.manage'],
  LABORAN: ['asset.read', 'asset.manage', 'lab.read', 'lab.manage'],
  PETUGAS_UKS: ['uks.read', 'uks.manage', 'student.read'],
  PEMBINA_OSIS: ['ekskul.read', 'ekskul.manage', 'student.read'],
  PEMBINA_EKSKUL: ['ekskul.read', 'ekskul.manage', 'student.read'],
  OPERATOR_PPDB: ['ppdb.read', 'ppdb.manage', 'ppdb.verify', 'student.create'],
  SECURITY: ['visitor.read', 'visitor.manage', 'incident.read', 'incident.manage'],
  SARPRAS: ['asset.read', 'asset.manage', 'facility.read', 'facility.manage', 'maintenance.manage'],
  SISWA: ['self.read', 'lms.learn', 'assignment.submit', 'library.search', 'cbt.take'],
  ORTU: ['child.read', 'child.attendance.read', 'child.grade.read', 'child.finance.read', 'child.rapor.read'],
  ALUMNI: ['self.read', 'alumni.self'],
  AUDITOR: ['audit.read', 'report.read'],
}

/// Resolve effective permissions for a role + optional custom role permission list.
export function resolvePermissions(role: string, customPermissions: string[] | null): string[] {
  const base = ROLE_PERMISSIONS[role] ?? []
  return customPermissions ? Array.from(new Set([...base, ...customPermissions])) : base
}

export function hasPermission(perms: string[], required: string[]): boolean {
  if (perms.includes('*')) return true
  return required.every((r) => perms.includes(r))
}
