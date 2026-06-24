import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 从上下文获取角色
    const roles = this.reflector.get<string[]>('roles', context.getHandler())
    //   如果没有角色，直接返回 true
    if (!roles) {
      return true
    }
    const request = context.switchToHttp().getRequest()
    const { user } = request.query
    return !!roles.find(role => role === user)
  }
}
