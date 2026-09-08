import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { RolesController } from './roles.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [RolesController],
  providers: [AuditService],
})
export class RolesModule {}
