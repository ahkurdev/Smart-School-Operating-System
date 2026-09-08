import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { FinanceController } from './finance.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [FinanceController],
  providers: [AuditService],
})
export class FinanceModule {}
