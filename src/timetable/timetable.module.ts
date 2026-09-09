import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { ResourcesService } from './resources.service';
import { TimetableCuratorService } from './timetable-curator.service';
import { SchoolsModule } from '../schools/schools.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => SchoolsModule), NotificationModule, SchoolSettingsModule, SubscriptionsModule],
  controllers: [TimetableController],
  providers: [TimetableService, ResourcesService, TimetableCuratorService],
  exports: [TimetableService, ResourcesService, TimetableCuratorService],
})
export class TimetableModule {}
