import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Exclude /metrics from metrics collection
    if (url === '/metrics') {
      return next.handle();
    }

    const startTime = Date.now();
    this.metricsService.httpRequestsInFlight.inc();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(context, startTime);
        },
        error: () => {
          this.recordMetrics(context, startTime, true);
        },
      }),
      finalize(() => {
        this.metricsService.httpRequestsInFlight.dec();
      }),
    );
  }

  private recordMetrics(context: ExecutionContext, startTime: number, isError = false) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const durationSec = (Date.now() - startTime) / 1000;

    const { method, route } = request;
    const path = route?.path || request.url;
    const status = response.statusCode.toString();

    const labels = { method, route: path, status };

    this.metricsService.incrementHttpRequests(labels);
    this.metricsService.recordHttpRequestDuration(labels, durationSec);

    if (isError || response.statusCode >= 400) {
      this.metricsService.incrementHttpErrors(labels);
    }
  }
}
