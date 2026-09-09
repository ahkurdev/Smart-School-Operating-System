import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { NotificationsController } from './notifications.controller'

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
