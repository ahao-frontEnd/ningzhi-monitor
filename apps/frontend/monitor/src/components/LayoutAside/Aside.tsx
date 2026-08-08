import { useQuery } from '@tanstack/react-query' // @tanstack/react-query 是一个 React Query 库，用于处理异步查询和缓存
// lucide-react 是一个 React 组件库，提供了 Lucide 图标组件
import { Bug, CalendarCheck, Lightbulb, Package, Settings, Siren, Zap } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import * as srv from '@/services'
import { ningzhiConfetti } from '@/utils/ningzhi-confetti'

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'

const menus = [
  {
    name: 'projects',
    icon: Package,
    title: '项目总览（real data）',
    gap: true,
  },
  {
    name: 'issues',
    icon: Bug,
    title: '缺陷（real data）',
    badge: 6,
  },
  {
    name: 'performance',
    icon: Zap,
    title: '性能（mock data）',
    gap: true,
  },
  {
    name: 'dashboard',
    icon: Lightbulb,
    title: '监控（mock data）',
  },
  {
    name: 'crons',
    icon: CalendarCheck,
    title: '定时任务（mock data）',
  },
  {
    name: 'alerts',
    icon: Siren,
    title: '告警（mock data）',
  },
]

export function Aside() {
  const navigate = useNavigate()

  const { toast } = useToast()
  // useQuery 是一个 React Query 提供的钩子函数，用于执行异步查询并缓存结果。
  // 它会自动处理查询的执行、缓存、刷新等操作，而无需手动编写这些逻辑
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'], // queryKey 是一个唯一的标识符，用于缓存和管理查询结果
    queryFn: async () => {
      const res = await srv.currentUser()
      return res.data
    },
  })

  const handleConfetti = () => {
    ningzhiConfetti.firework()
  }
  const handleLogout = () => {
    toast({
      title: '退出登录',
    })
    localStorage.removeItem('token')
    navigate(`/account/login?redirect=${window.location.pathname}`)
  }

  return (
    <div className=" border-r bg-gray-50 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 ">
            <span>📹</span>
            <p className="font-semibold text-lg">Ningzhi - 监控平台</p>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {menus.map(menu => (
              <>
                <NavLink
                  key={menu.name}
                  to={`/${menu.name}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                      isActive && 'bg-muted'
                    )
                  }
                >
                  <menu.icon className="h-4 w-4" />
                  {menu.title}
                  {menu.badge && (
                    <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">{menu.badge}</Badge>
                  )}
                </NavLink>
                {menu.gap && <div className="my-3 h-[1px] bg-gray-100" />}
              </>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="grid">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-fit flex justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              onClick={handleConfetti}
            >
              {currentUser && (
                <>
                  <Avatar>
                    <AvatarImage src={`https://robohash.org/${currentUser.username}?set=set1&size=100x100`} />
                    <AvatarFallback>{currentUser.username}</AvatarFallback>
                  </Avatar>
                  <p className="text-left">
                    <p className="text-lg">{currentUser.username}</p>
                    庆祝一下 🎉
                  </p>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full flex justify-start gap-3 mt-2 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <Settings className="h-4 w-4" />
              设置
            </Button>
            <Button variant="outline" size="sm" className="w-full mt-1" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
