import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common'

import { VersionService } from './version.service'

@Controller()
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  getVersion() {
    return this.versionService.getVersion()
  }

  @Post('tracing/:app_id')
  tracking(@Param() { app_id }: { app_id: string }, @Body() params: { event_type: string; message: string }): any {
    Logger.log('app_id ===> ', app_id)
    Logger.log('params ===> ', params)
    return this.versionService.tracking(params)
  }

  @Get('span')
  span(): Promise<any> {
    return this.versionService.span()
  }
}
