import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { resolvePermissions } from '../auth/role-permissions'

class CreateCustomRoleDto {
  name!: string
  permissions!: string[]
}

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.read')
  async list() {
    // roles.read granted via membership resolution below; SUPER_ADMIN/* passes
    return { items: await this.prisma.customRole.findMany() }
  }

  @Post()
  @RequirePermissions('roles.manage')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomRoleDto) {
    const schoolId = user.memberships[0]?.schoolId
    if (!schoolId) throw new BadRequestException('No school context')
    if (!Array.isArray(dto.permissions)) throw new BadRequestException('permissions must be an array')
    return this.prisma.customRole.create({
      data: { schoolId, name: String(dto.name).slice(0, 100), permissions: JSON.stringify(dto.permissions.map(String)) },
    })
  }

  @Get(':id/members')
  async members(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.prisma.customRole.findUnique({ where: { id } })
    if (!role) throw new BadRequestException('Role not found')
    return {
      role: { id: role.id, name: role.name, permissions: resolvePermissions('CUSTOM', safeParse(role.permissions)) },
    }
  }
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}
