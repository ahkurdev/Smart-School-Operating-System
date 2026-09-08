import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { OpsController } from './ops.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [OpsController],
  providers: [AuditService],
})
export class OpsModule {}
