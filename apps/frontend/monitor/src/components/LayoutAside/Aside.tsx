import clsx from 'clsx' // clsx 是一个用于条件合并 className 的库
import { Bug, CalendarCheck, Lightbulb, Package, PartyPopper, Settings, Siren } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ningzhiConfetti } from '@/utils/ningzhi-confetti'

const menus = [
  {
    name: 'projects',
    icon: Package,
    title: '项目总览',
    gap: true,
  },
  {
    name: 'issues',
    icon: Bug,
    title: '缺陷',
    badge: 6,
  },
  {
    name: 'performance',
    icon: Package,
    title: '性能',
    gap: true,
  },
  {
    name: 'dashboard',
    icon: Lightbulb,
    title: '监控',
  },
  {
    name: 'crons',
    icon: CalendarCheck,
    title: '定时任务',
  },
  {
    name: 'alerts',
    icon: Siren,
    title: '告警',
  },
]

export function Aside() {
  const navigate = useNavigate()
  const handleConfetti = () => {
    ningzhiConfetti.firework()
  }
  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate(`/account/login?redirect=${window.location.pathname}`)
  }
  return (
    <div className=" border-r bg-gray-50 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 ">
            <img className="w-10" src="https://www.miaomaedu.com/study_service/study_service_5.svg" />
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
                    clsx(
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
              className="w-full flex justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
              onClick={handleConfetti}
            >
              <PartyPopper className="h-4 w-4" />
              庆祝一下 🎉
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full flex justify-start gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
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
