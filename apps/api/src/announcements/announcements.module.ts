import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AnnouncementsController } from './announcements.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AnnouncementsController],
  providers: [AuditService],
})
export class AnnouncementsModule {}
