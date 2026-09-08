import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { IotController } from './iot.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [IotController],
  providers: [AuditService],
})
export class IotModule {}
