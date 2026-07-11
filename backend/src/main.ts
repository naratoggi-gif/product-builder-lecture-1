import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { safeRequestLogger } from './shared/safe-logger.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
  }));
  app.use(safeRequestLogger);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useStaticAssets(join(process.cwd(), 'public'));
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
