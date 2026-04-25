import { Module, forwardRef } from '@nestjs/common';
import { StudentsController, SchoolStudentAdmissionController } from './students.controller';
import { StudentMeController } from './student-me.controller';
import { CourseRegistrationController } from './course-registration.controller';
import { StudentsService } from './students.service';
import { StudentAdmissionService } from './student-admission.service';
import { CourseRegistrationService } from './course-registration.service';
import { DatabaseModule } from '../database/database.module';
import { SchoolsModule } from '../schools/schools.module';
import { AuthModule } from '../auth/auth.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { LiveStatusModule } from '../live-status/live-status.module';
import { TimetableModule } from '../timetable/timetable.module';
import { GradesModule } from '../grades/grades.module';
import { EventsModule } from '../events/events.module';
import { CloudinaryModule } from '../storage/cloudinary/cloudinary.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => SchoolsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => OnboardingModule),
    TimetableModule,
    LiveStatusModule,
    forwardRef(() => GradesModule),
    forwardRef(() => EventsModule),
    CloudinaryModule,
    SubscriptionsModule,
    NotificationModule,
  ],
  controllers: [
    StudentMeController,
    StudentsController,
    SchoolStudentAdmissionController,
    CourseRegistrationController,
  ],
  providers: [StudentsService, StudentAdmissionService, CourseRegistrationService],
  exports: [StudentsService, StudentAdmissionService, CourseRegistrationService],
})
export class StudentsModule { }
