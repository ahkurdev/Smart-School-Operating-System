import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TimetableController } from './timetable.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [TimetableController],
  providers: [AuditService],
})
export class TimetableModule {}
