import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { DatabaseModule } from '../database/database.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => StudentsModule)],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
