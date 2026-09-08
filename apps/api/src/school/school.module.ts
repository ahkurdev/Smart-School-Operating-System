import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SchoolController } from './school.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [SchoolController],
  providers: [AuditService],
})
export class SchoolModule {}
