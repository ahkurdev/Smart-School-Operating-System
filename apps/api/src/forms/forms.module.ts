import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { FormsController } from './forms.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [FormsController],
  providers: [AuditService],
})
export class FormsModule {}
