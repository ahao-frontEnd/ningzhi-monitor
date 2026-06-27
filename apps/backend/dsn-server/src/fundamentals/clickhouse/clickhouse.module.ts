import { createClient } from '@clickhouse/client'
import { DynamicModule } from '@nestjs/common'

export class ClickhouseModule {
  static register(options: { url: string }): DynamicModule {
    const { url = 'http://localhost:8123' } = options
    return {
      module: ClickhouseModule,
      providers: [
        {
          provide: 'CLICKHOUSE_CLIENT',
          useFactory: () => {
            return createClient({
              url,
              username: 'default',
              password: 'ningzhiClickhouse',
            })
          },
        },
      ],
      exports: ['CLICKHOUSE_CLIENT'],
    }
  }
}
