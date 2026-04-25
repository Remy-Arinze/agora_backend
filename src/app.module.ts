import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ThrottlerWithHeadersGuard } from './common/guards/throttler-with-headers.guard';
import { ThrottlerHeadersInterceptor } from './common/interceptors/throttler-headers.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { StudentsModule } from './students/students.module';
import { SchoolsModule } from './schools/schools.module';
import { TransfersModule } from './transfers/transfers.module';
import { NotificationModule } from './notification/notification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EmailModule } from './email/email.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { SessionsModule } from './sessions/sessions.module';
import { TimetableModule } from './timetable/timetable.module';
import { EventsModule } from './events/events.module';
import { GradesModule } from './grades/grades.module';
import { GoogleCalendarModule } from './integrations/google-calendar/google-calendar.module';
import { CloudinaryModule } from './storage/cloudinary/cloudinary.module';
import { PublicModule } from './public/public.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AiModule } from './ai/ai.module';
import { PaymentsModule } from './payments/payments.module';
import { ErrorsModule } from './operations/errors/errors.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AgoraCurriculumModule } from './agora-curriculum/agora-curriculum.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { MetricsModule } from './common/metrics/metrics.module';
import { HttpMetricsInterceptor } from './common/metrics/http-metrics.interceptor';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // ---------------------------------------------------------
    // TIERED RATE LIMITING CONFIGURATION
    // ---------------------------------------------------------
    // standard (300 req/min): Default for common UI fetches.
    // heavy-ai (10 req/min): For Lois, BullMQ jobs, and PDF parsing.
    // database-intensive (30 req/min): For reports, aggregations, and global search.
    // ---------------------------------------------------------
    ThrottlerModule.forRoot([
      {
        name: 'standard',
        ttl: 60,
        limit: 300,
      },
      {
        name: 'heavy-ai',
        ttl: 60,
        limit: 100,
      },
      {
        name: 'database-intensive',
        ttl: 60,
        limit: 100,
      },
    ]),
    DatabaseModule,
    TenantModule,
    AuthModule,
    OnboardingModule,
    StudentsModule,
    SchoolsModule,
    TransfersModule,
    NotificationModule,
    AnalyticsModule,
    EmailModule,
    SessionsModule,
    TimetableModule,
    EventsModule,
    GradesModule,
    GoogleCalendarModule,
    CloudinaryModule,
    PublicModule,
    SubscriptionsModule,
    AiModule,
    PaymentsModule,
    ErrorsModule,
    AssessmentsModule,
    AttendanceModule,
    AgoraCurriculumModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply enhanced rate limiting globally with user-based tracking and headers
    {
      provide: APP_GUARD,
      useClass: ThrottlerWithHeadersGuard,
    },
    // Add rate limit headers to all responses
    {
      provide: APP_INTERCEPTOR,
      useClass: ThrottlerHeadersInterceptor,
    },
    // HTTP Metrics Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    // Register exception filter as provider to enable dependency injection
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: '/', method: RequestMethod.ALL },
        { path: '/api', method: RequestMethod.ALL },
        { path: '/public', method: RequestMethod.ALL },
        { path: '/public/(.*)', method: RequestMethod.ALL },
        { path: '/auth', method: RequestMethod.ALL },
        { path: '/auth/(.*)', method: RequestMethod.ALL },
        { path: '/teachers/me', method: RequestMethod.ALL },
        { path: '/teachers/me/(.*)', method: RequestMethod.ALL },
        { path: '/students/me', method: RequestMethod.ALL },
        { path: '/students/me/(.*)', method: RequestMethod.ALL },
        { path: '/swagger', method: RequestMethod.ALL },
        { path: '/swagger/(.*)', method: RequestMethod.ALL },
        { path: '/swagger-json', method: RequestMethod.ALL },
        { path: '/metrics', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
