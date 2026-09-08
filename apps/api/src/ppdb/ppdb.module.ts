import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PpdbController } from './ppdb.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [PpdbController],
  providers: [AuditService],
})
export class PpdbModule {}
