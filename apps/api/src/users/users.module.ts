import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { UsersController } from './users.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [UsersController],
  providers: [AuditService],
})
export class UsersModule {}
