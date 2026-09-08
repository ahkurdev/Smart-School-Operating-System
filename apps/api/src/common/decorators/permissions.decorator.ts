import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'ssos:permissions'
export const IS_PUBLIC_KEY = 'ssos:isPublic'

/// Endpoint requires ALL listed permissions (within active school context).
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms)

/// Endpoint is public (no auth) e.g. health, public website API.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
