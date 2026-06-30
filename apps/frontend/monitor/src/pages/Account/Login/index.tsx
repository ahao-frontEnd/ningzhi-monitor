import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { TaiJi } from './TaiJi'
import { World } from './World'

export const description =
  "A login page with two columns. The first column has the login form with email and password. There's a Forgot your password link and a link to sign up if you do not have an account. The second column has a cover image."

export function Login() {
  const navigate = useNavigate()

  const handleLogin = () => {
    localStorage.setItem('token', '123456')
    const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/projects'
    navigate(redirectUrl)
  }

  return (
    <div className="container relative h-screen w-full flex-row items-center justify-end grid max-w-none grid-cols-2  !min-w-[1300px]">
      <div className="relative h-full flex-col bg-muted p-10 text-white dark:border-r flex">
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http:www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          Ningzhi Monitor
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-4xl mb-8">&ldquo;天行健，君子以自强不息&rdquo;</p>
            <p className="text-lg">&ldquo;登录监控平台，查看系统状态&rdquo;</p>
            <footer className="text-sm">@Ningzhi</footer>
          </blockquote>
        </div>
      </div>
      <TaiJi />
      <World yi="yin" />
      <World yi="yang" />
      <div className="lg:p-8">
        <div className="flex items-center justify-center ">
          <div className="mx-auto grid w-[350px] gap-6">
            <div className="grid gap-2 text-center">
              <h1 className="text-2xl font-bold mb-8">Ningzhi 性能与异常监控平台</h1>
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
              <Button type="submit" className="w-full" onClick={handleLogin}>
                登录
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">没有账号? 注册</div>
          </div>
        </div>
      </div>
    </div>
  )
}
