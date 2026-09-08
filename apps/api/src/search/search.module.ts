import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SearchController } from './search.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [SearchController],
  providers: [AuditService],
})
export class SearchModule {}
