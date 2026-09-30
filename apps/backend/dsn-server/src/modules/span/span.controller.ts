import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common'

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
  span(@Query('app_id') app_id?: string) {
    return this.spanService.span(app_id)
  }

  @Get('bugs')
  bugs(@Query('app_id') app_id?: string) {
    return this.spanService.bugs(app_id)
  }
}
