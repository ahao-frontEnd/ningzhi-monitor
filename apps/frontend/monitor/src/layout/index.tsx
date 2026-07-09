import { useLayoutEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { Aside } from '@/components/LayoutAside/Aside'

export function Layout() {
  // 检查是否有 token，没有则跳转到登录页, useLayoutEffect 确保在 DOM 渲染完成后执行跳转
  useLayoutEffect(() => {
    if (!localStorage.getItem('token')) {
      window.location.href = `/account/login?redirect=${window.location.pathname}`
    }
  }, [])

  return (
    <div className="grid h-screen w-full grid-cols-[280px_1fr]">
      <Aside />
      <div className="flex flex-col overflow-y-auto relative">
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
