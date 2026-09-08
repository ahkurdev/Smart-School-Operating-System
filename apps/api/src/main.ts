import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { loadConfig } from './config/configuration'

async function bootstrap(): Promise<void> {
  const config = loadConfig()
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cookieParser())
  app.enableCors({
    origin: config.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
  app.set('trust proxy', 1)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  )
  app.setGlobalPrefix('api', { exclude: ['/health'] })
  app.enableShutdownHooks()

  const swagger = new DocumentBuilder()
    .setTitle('Smart School OS API')
    .setVersion('0.1')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger))

  await app.listen(config.port)
  console.log(`SSOS API listening on :${config.port} (docs at /api/docs)`)
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err)
  process.exit(1)
})
