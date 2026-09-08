import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ScholarshipController } from './scholarship.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [ScholarshipController],
  providers: [AuditService],
})
export class ScholarshipModule {}
