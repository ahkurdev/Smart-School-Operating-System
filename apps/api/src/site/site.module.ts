import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SiteController } from './site.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [SiteController],
  providers: [AuditService],
})
export class SiteModule {}
