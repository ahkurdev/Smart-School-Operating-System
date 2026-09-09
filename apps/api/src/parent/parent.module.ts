import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ParentController } from './parent.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [ParentController],
  providers: [AuditService],
})
export class ParentModule {}
