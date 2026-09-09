import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { IntegrationsController } from './integrations.controller'

@Module({
  imports: [JwtModule.register({})],
  controllers: [IntegrationsController],
})
export class IntegrationsModule {}
