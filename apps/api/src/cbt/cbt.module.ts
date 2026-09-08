import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { CbtController } from './cbt.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [CbtController],
  providers: [AuditService],
})
export class CbtModule {}
