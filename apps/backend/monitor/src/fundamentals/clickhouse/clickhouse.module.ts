import { createClient } from '@clickhouse/client'
import { DynamicModule, Global, Module } from '@nestjs/common'

@Global() // 全局模块，确保在应用中只能实例化一次 ClickHouse 客户端
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
      ],
      exports: ['CLICKHOUSE_CLIENT'],
    }
  }
}
