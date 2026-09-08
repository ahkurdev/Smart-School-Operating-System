import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { StudentsController } from './students.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [StudentsController],
  providers: [AuditService],
})
export class StudentsModule {}
