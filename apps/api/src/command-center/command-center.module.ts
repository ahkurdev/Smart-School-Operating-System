import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { CommandCenterController } from './command-center.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [CommandCenterController],
  providers: [AuditService],
})
export class CommandCenterModule {}
