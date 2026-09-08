import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AssetsController } from './assets.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AssetsController],
  providers: [AuditService],
})
export class AssetsModule {}
