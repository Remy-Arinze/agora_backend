import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Global rate limiting: 100 requests per minute by default
    // Auth endpoints have stricter limits via @Throttle decorators
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
