import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Security: Helmet middleware for HTTP security headers
  // Protects against XSS, clickjacking, MIME sniffing, and other attacks
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    // Only disable crossOriginEmbedderPolicy in development for Swagger UI
    crossOriginEmbedderPolicy: isProduction,
  }));

  // Cookie parser for httpOnly refresh token cookies
  app.use(cookieParser());

  // Global exception filter for better error messages
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe with strict transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // CORS configuration - allow credentials for httpOnly cookies
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true, // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });

  // Swagger/OpenAPI configuration - ONLY enabled in non-production environments
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Agora API')
      .setDescription(
        'Multi-Tenant Digital Education Identity Platform - Chain-of-Trust Registry'
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth'
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('onboarding', 'Student onboarding and bulk import')
      .addTag('students', 'Student management')
      .addTag('schools', 'School/tenant management')
      .addTag('transfers', 'Student transfer requests')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    // Expose swagger JSON for codegen (development only)
    app.getHttpAdapter().get('/swagger-json', (req, res) => {
      res.json(document);
    });

    logger.log(`📚 Swagger docs available at http://localhost:${process.env.PORT || 4000}/api/swagger`);
    logger.log(`📦 Swagger JSON at http://localhost:${process.env.PORT || 4000}/api/swagger-json`);
  } else {
    logger.log('🔒 Swagger documentation disabled in production');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Agora API running on http://localhost:${port}`);
}

bootstrap();

