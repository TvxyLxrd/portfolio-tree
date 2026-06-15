import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env['FRONTEND_ORIGIN']
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
  });

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

void bootstrap();
