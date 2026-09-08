import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { CounselingController } from './counseling.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [CounselingController],
  providers: [AuditService],
})
export class CounselingModule {}
