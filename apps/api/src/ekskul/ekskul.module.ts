import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { EkskulController } from './ekskul.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [EkskulController],
  providers: [AuditService],
})
export class EkskulModule {}
