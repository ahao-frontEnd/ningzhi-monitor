import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common'

import { SpanService } from './span.service'

export interface TrackingParams {
  event_type: string
  message?: string
}

@Controller()
export class SpanController {
  constructor(private readonly spanService: SpanService) {}

  @Post('tracing/:app_id')
  tracking(@Param() { app_id }: { app_id: string }, @Body() params: TrackingParams) {
    Logger.log(app_id)
    Logger.log(params)
    return this.spanService.tracking(app_id, params)
  }

  @Get('span')
  span() {
    return this.spanService.span()
  }

  @Get('bugs')
  bugs() {
    return this.spanService.bugs()
  }
}
