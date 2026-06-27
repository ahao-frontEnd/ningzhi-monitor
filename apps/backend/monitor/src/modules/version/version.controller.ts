import { Controller, Get, Query } from '@nestjs/common'

import { VersionService } from './version.service'

@Controller()
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  getVersion() {
    return this.versionService.getVersion()
  }

  @Get('tracking')
  tracking(@Query() params: { event_type: string; message: string }): any {
    return this.versionService.tracking(params)
  }

  @Get('span')
  span(): Promise<any> {
    return this.versionService.span()
  }
}
