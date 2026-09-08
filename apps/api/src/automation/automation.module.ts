import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AutomationController } from './automation.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AutomationController],
  providers: [AuditService],
})
export class AutomationModule {}
