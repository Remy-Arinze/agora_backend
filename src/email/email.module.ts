import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';

@Module({
  imports: [SchoolSettingsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
