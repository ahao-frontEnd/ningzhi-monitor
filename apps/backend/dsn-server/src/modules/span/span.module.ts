import { Module } from '@nestjs/common'

import { SpanController } from './span.controller'
import { SpanService } from './span.service'

@Module({
  controllers: [SpanController],
  providers: [SpanService],
})
export class SpanModule {}
