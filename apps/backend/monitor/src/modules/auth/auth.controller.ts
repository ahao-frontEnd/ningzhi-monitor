import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { AuthService } from './auth.service'

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 登录
   * @param req
   * @returns
   */
  @UseGuards(AuthGuard('local')) // 会自动读取当前目录下的 local.strategy.ts 文件，因为 local.strategy.ts 是 passport-jwt 提供的策略类
  @Post('/auth/login')
  async login(@Request() req) {
    return { data: await this.authService.login(req.body), success: true }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/auth/logout')
  async logout(/* @Request() req */) {
    return { success: await this.authService.logout(/* req.user */) }
  }

  // 获取当前用户信息
  @UseGuards(AuthGuard('jwt'))
  @Get('currentUser')
  currentUser() {
    return { data: { username: 'ningzhi123' }, success: true }
  }

  // 测试登录后才可访问的接口，在需要的地方使用守卫，可保证必须携带token才能访问
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Request() req) {
    return req.body.username
  }
}
