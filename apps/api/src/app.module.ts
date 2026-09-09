import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { APP_GUARD, APP_FILTER } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { RolesModule } from './auth/roles.module'
import { SchoolModule } from './school/school.module'
import { StudentsModule } from './students/students.module'
import { TimetableModule } from './timetable/timetable.module'
import { AttendanceModule } from './attendance/attendance.module'
import { LmsModule } from './lms/lms.module'
import { GradesModule } from './grades/grades.module'
import { CounselingModule } from './counseling/counseling.module'
import { LibraryModule } from './library/library.module'
import { FinanceModule } from './finance/finance.module'
import { ScholarshipModule } from './scholarship/scholarship.module'
import { AssetsModule } from './assets/assets.module'
import { HrModule } from './hr/hr.module'
import { EkskulModule } from './ekskul/ekskul.module'
import { OpsModule } from './ops/ops.module'
import { AnnouncementsModule } from './announcements/announcements.module'
import { IotModule } from './iot/iot.module'
import { AutomationModule } from './automation/automation.module'
import { CommandCenterModule } from './command-center/command-center.module'
import { SearchModule } from './search/search.module'
import { PpdbModule } from './ppdb/ppdb.module'
import { ParentModule } from './parent/parent.module'
import { StudentModule } from './student/student.module'
import { UsersModule } from './users/users.module'
import { CbtModule } from './cbt/cbt.module'
import { SiteModule } from './site/site.module'
import { HealthController } from './health/health.controller'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { LoggingMiddleware } from './common/middleware/logging.middleware'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AuditModule } from './audit/audit.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    RolesModule,
    SchoolModule,
    StudentsModule,
    TimetableModule,
    AttendanceModule,
    LmsModule,
    GradesModule,
    CounselingModule,
    LibraryModule,
    FinanceModule,
    ScholarshipModule,
    AssetsModule,
    HrModule,
    EkskulModule,
    OpsModule,
    AnnouncementsModule,
    IotModule,
    AutomationModule,
    CommandCenterModule,
    SearchModule,
    PpdbModule,
    ParentModule,
    StudentModule,
    UsersModule,
    CbtModule,
    SiteModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*')
  }
}
