import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const description =
  "A login page with two columns. The first column has the login form with email and password. There's a Forgot your password link and a link to sign up if you do not have an account. The second column has a cover image."

export function Login() {
  return (
    <div className="w-full lg:grid min-h-screen" style={{ backgroundImage: 'url(https://www.miaomaedu.com/bg-strip-dark.svg)' }}>
      <div className="flex items-center justify-center ">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Ningzhi - 监控平台</h1>
            <p className="text-balance text-muted-foreground">登录监控平台</p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="email">邮箱</Label>
              </div>
              <Input id="email" type="email" placeholder="m@example.com" required />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">密码</Label>
              </div>
              <Input id="password" type="password" required placeholder="请输入密码" />
            </div>
            <Button type="submit" className="w-full">
              登录
            </Button>
            {/* <Button variant="outline" className="w-full">
                            Login with Google
                        </Button> */}
          </div>
          <div className="mt-4 text-center text-sm">没有账号? 注册</div>
        </div>
      </div>
    </div>
  )
}
