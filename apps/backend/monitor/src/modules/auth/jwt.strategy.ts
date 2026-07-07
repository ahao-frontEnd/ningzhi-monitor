import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { AdminService } from '../admin/admin.service'
import { jwtConstants } from './constants'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // PassportStrategy(Strategy) 是 passport-jwt 提供的策略类，用于验证 jwt token
  constructor(private readonly adminService: AdminService) {
    super({
      jwtFromRequest: ExtractJwt.fromHeader('token'), // 从请求头中提取 token
      ignoreExpiration: false, // 忽略过期时间, 可以根据实际情况设置为 true，但是不建议在生产环境中使用
      secretOrKey: jwtConstants.secret, // 密钥
    })
  }

  async validate(payload: any) {
    // payload 是 jwt token 中的 payload 部分，包含了用户信息，比如 username 和 password
    // token 验证通过后，即可拿到
    const user = await this.adminService.validateUser(payload.username, payload.password)
    return user
  }
}
