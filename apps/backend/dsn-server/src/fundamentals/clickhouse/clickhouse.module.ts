import { createClient } from '@clickhouse/client'
import { DynamicModule, Global, Module } from '@nestjs/common'

import { ClickhouseInitializer } from './clickhouse.initializer'

@Global()
@Module({})
export class ClickhouseModule {
  static forRoot(options: { url: string; username: string; password: string }): DynamicModule {
    return {
      module: ClickhouseModule,
      providers: [
        {
          provide: 'CLICKHOUSE_CLIENT',
          useFactory: () => {
            // 创建 ClickHouse 客户端， 确保只初始化一次
            return createClient(options)
          },
        },
        // NestJS 发现 providers 中有 这个逻辑 ，实例化它（注入 CLICKHOUSE_CLIENT ）
        // 实现 OnModuleInit 接口， 用于在模块初始化完成后执行一些操作
        ClickhouseInitializer,
      ],
      exports: ['CLICKHOUSE_CLIENT'],
    }
  }
}
