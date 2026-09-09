import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { StudentController } from './student.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [StudentController],
  providers: [AuditService],
})
export class StudentModule {}
