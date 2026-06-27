import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './fundamentals/common/filters/http-exception.filter'

// import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
// import { ValidationPipe } from './common/pipes/validation.pipe'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 全局使用中间件
  // app.use(logger)

  // 全局过滤器
  app.useGlobalFilters(new HttpExceptionFilter())

  // 全局管道
  // app.useGlobalPipes(new ValidationPipe());

  // 全局拦截器
  // app.useGlobalInterceptors(new LoggingInterceptor());

  app.setGlobalPrefix('api')

  // 设置 swagger 文档的相关配置
  const swaggerOptions = new DocumentBuilder()
    .setTitle('Ningzhi 监控平台 sdk api 文档')
    .setDescription('Ningzhi 监控平台 dsn server')
    .setVersion('1.0.0')
    .addBearerAuth() // 添加 bearer 认证方案， 就是 token 认证
    .build()
  // 创建 swagger 文档
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerOptions)
  // 配置 swagger 文档
  SwaggerModule.setup('ningzhi/doc', app, swaggerDocument)

  await app.listen(8080)
}
bootstrap()
