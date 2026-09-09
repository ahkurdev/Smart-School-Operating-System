import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { RequirePermissions } from '../common/decorators/permissions.decorator'
import { statusList } from './providers'

@Controller('integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  /// Status only — never leaks secret values, only configured/missing + env var name.
  @Get('status')
  @RequirePermissions('school.manage')
  async status() {
    return { items: statusList() }
  }
}
