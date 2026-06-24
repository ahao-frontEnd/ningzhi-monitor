import { SetMetadata } from '@nestjs/common'

// SetMetadata('roles', roles) 用于设置元数据，用于在守卫中获取角色，在守卫中使用例子如下：
// @Injectable()
// export class RolesGuard implements CanActivate {
//   canActivate(context: ExecutionContext): boolean {
//     const request = context.switchToHttp().getRequest()
//     const user = request.user
//     const roles = context.getHandler().getMetadata('roles')
//     if (roles && roles.length > 0) {
//       return roles.some(role => user.roles.includes(role))
//     }
//     return true
//   }
// }
export const Roles = (...roles: string[]) => SetMetadata('roles', roles)
