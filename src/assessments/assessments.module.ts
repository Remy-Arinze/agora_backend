import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ExamTimetableModule } from '../exam-timetable/exam-timetable.module';

@Module({
    imports: [DatabaseModule, AiModule, NotificationModule, SubscriptionsModule, ExamTimetableModule],
    controllers: [AssessmentsController],
    providers: [AssessmentsService],
    exports: [AssessmentsService]
})
export class AssessmentsModule { }
