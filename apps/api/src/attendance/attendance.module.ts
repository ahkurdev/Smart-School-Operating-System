import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AttendanceController } from './attendance.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AttendanceController],
  providers: [AuditService],
})
export class AttendanceModule {}
