import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';
import { PortalsModule } from '../portals/portals.module';

@Module({
  imports: [SchoolSettingsModule, PortalsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
