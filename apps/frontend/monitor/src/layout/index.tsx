import { Outlet } from 'react-router-dom'

import { Aside } from '@/components/LayoutAside/Aside'

export const description =
  'A products dashboard with a sidebar navigation and a main content area. The dashboard has a header with a search input and a user menu. The sidebar has a logo, navigation links, and a card with a call to action. The main content area shows an empty state with a call to action.'

export function Layout() {
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
