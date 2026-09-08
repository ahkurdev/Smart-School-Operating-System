import { z } from 'zod'

export const Permission = z.string().min(1)
export type Permission = z.infer<typeof Permission>

export const ROLES = [
  'SUPER_ADMIN',
  'YAYASAN',
  'KEPALA_SEKOLAH',
  'WAKIL_KEPALA',
  'ADMIN_SEKOLAH',
  'TATA_USAHA',
  'BENDAHARA',
  'WALI_KELAS',
  'GURU',
  'GURU_BK',
  'PUSTAKAWAN',
  'LABORAN',
  'PETUGAS_UKS',
  'PEMBINA_OSIS',
  'PEMBINA_EKSKUL',
  'OPERATOR_PPDB',
  'SECURITY',
  'SARPRAS',
  'SISWA',
  'ORTU',
  'ALUMNI',
  'AUDITOR',
] as const
export type Role = (typeof ROLES)[number]

export const loginSchema = z.object({
  identity: z.string().min(3).max(191),
  password: z.string().min(8).max(128),
})
export type LoginInput = z.infer<typeof loginSchema>

export const refreshSchema = z.object({}).passthrough()
