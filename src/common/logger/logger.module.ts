import { Module, Global } from '@nestjs/common';
import { OpenObserveLogger } from './openobserve-logger.service';

@Global()
@Module({
  providers: [OpenObserveLogger],
  exports: [OpenObserveLogger],
})
export class LoggerModule {}
