import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { HrController } from './hr.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [HrController],
  providers: [AuditService],
})
export class HrModule {}
