import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import databaseConfig from './config/database'
import { ClickhouseModule } from './fundamentals/clickhouse/clickhouse.module'
import { LoggerMiddleware } from './fundamentals/common/middleware/logger.middleware'
import { AuthModule } from './modules/auth/auth.module'
import { VersionModule } from './modules/version/version.module'

@Module({
  imports: [
    // forRoot 和 forRootAsync 都是用于在应用启动时加载配置文件的，区别是 forRoot 是同步加载，而 forRootAsync 是异步加载
    ConfigModule.forRoot({ load: [databaseConfig] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // 引入 ConfigModule 模块，用于获取配置文件中的数据库配置
      // useFactory 是一个工厂函数，用于创建 TypeOrmModule 实例，返回值是一个 TypeOrmModuleOptions 对象
      useFactory: (config: ConfigService) => config.get('database'),
      inject: [ConfigService], // 注入 ConfigService 服务，用于获取配置文件中的数据库配置
    }),
    AuthModule,
    VersionModule,
    ClickhouseModule.register({ url: 'http://localhost:8123' }),
  ],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // 为所有路由应用 LoggerMiddleware 中间件，排除 hello 路由的 POST 请求, 其他路由都应用 LoggerMiddleware 中间件
    consumer.apply(LoggerMiddleware).exclude({ path: 'hello', method: RequestMethod.POST }).forRoutes('*')
  }
}
