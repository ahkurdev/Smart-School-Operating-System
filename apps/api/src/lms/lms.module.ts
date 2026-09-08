import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { LmsController } from './lms.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [LmsController],
  providers: [AuditService],
})
export class LmsModule {}
