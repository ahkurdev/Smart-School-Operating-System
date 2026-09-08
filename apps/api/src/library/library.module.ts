import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { LibraryController } from './library.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [LibraryController],
  providers: [AuditService],
})
export class LibraryModule {}
