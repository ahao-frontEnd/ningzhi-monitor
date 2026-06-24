import { Injectable } from '@nestjs/common'

@Injectable()
export class VersionService {
  getVersion() {
    return '1.0.0'
  }
}
