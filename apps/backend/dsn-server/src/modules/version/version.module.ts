import { Module } from '@nestjs/common'

import { ClickhouseModule } from '../../fundamentals/clickhouse/clickhouse.module'
import { VersionController } from './version.controller'
import { VersionService } from './version.service'

@Module({
  imports: [ClickhouseModule.register({ url: 'http://localhost:8123' })],
  controllers: [VersionController],
  providers: [VersionService],
})
export class VersionModule {}
