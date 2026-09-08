import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { GradesController } from './grades.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [GradesController],
  providers: [AuditService],
})
export class GradesModule {}
