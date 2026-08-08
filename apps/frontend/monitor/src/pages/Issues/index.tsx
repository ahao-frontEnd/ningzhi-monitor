import { useQuery } from '@tanstack/react-query'
import { formatDate } from 'date-fns'
import { AppWindow, Bug, ChevronDown, ListFilter, Timer } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as srv from '@/services'
import { ApplicationData } from '@/types/api'

import { appLogoMap } from '../Projects/meta'

export interface Issue {
  id: number
  title: string
  description: string
  appId: string
  events: number
  users: number
  status: 'active' | 'draft'
  createdAt: Date
}

export interface IssueRes {
  info: {
    type: string
    stack: string
    path: string
  }
  message: string
  created_at: Date
  app_id: string
}

const ALL_APPS_VALUE = '__all__'

export function Issues() {
  const [searchParams, setSearchParams] = useSearchParams()

  // —— 应用列表：独立 queryFn，用户直进 /issues 也能拿到数据；key 为 ['applications'] 跨页面共享缓存
  const { data: applications, isLoading: appsLoading } = useQuery<(ApplicationData & { appId: string })[]>({
    queryKey: ['applications'],
    queryFn: async () => {
      const res = await srv.fetchApplicationList()
      const allEvents = await fetch('/dsn-api/span')
      const allEventsData = await allEvents.json()
      return res.data.applications.map(app => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bugs = allEventsData.filter((event: any) => event.app_id === app.appId && event.event_type === 'error')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transactions = allEventsData.filter((event: any) => event.app_id === app.appId && event.event_type !== 'error')
        const data = new Array(7).fill(0).map((_, index) => ({
          date: new Date(new Date().setDate(new Date().getDate() - index)).toISOString(),
          resting: Math.floor(Math.random() * (100 - 20) + 20),
        }))
        return {
          ...app,
          bugs: bugs.length,
          transactions: transactions.length,
          data,
        }
      })
    },
    staleTime: 1000 * 60 * 5, // 5 分钟内复用缓存，减少反复请求
  })

  // —— 当前选中的 appId：优先读 URL，否则默认 全部（ALL_APPS_VALUE）
  const selectedAppId = searchParams.get('app_id') || ALL_APPS_VALUE

  const setSelectedAppId = (value: string) => {
    if (value === ALL_APPS_VALUE) {
      searchParams.delete('app_id')
      setSearchParams(searchParams, { replace: true })
    } else {
      setSearchParams({ ...Object.fromEntries(searchParams), app_id: value }, { replace: true })
    }
  }

  const selectedApp = applications?.find(a => a.appId === selectedAppId)

  // —— 缺陷列表：queryKey 带 selectedAppId，切换 app 自动重新请求；queryFn 传 app_id 给后端
  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', selectedAppId],
    queryFn: async () => {
      const url = selectedAppId === ALL_APPS_VALUE ? '/dsn-api/bugs' : `/dsn-api/bugs?app_id=${encodeURIComponent(selectedAppId)}`
      const res = await fetch(url)
      const issues = await res.json()
      const parsedIssues = issues.map((issue: IssueRes, index: number) => ({
        id: index + 1,
        title: issue.info.type,
        description: issue.message,
        status: 'active',
        createdAt: new Date(issue.created_at ?? Date.now()),
        appId: issue.app_id,
        events: Math.ceil(Math.random() * 20),
        users: Math.ceil(Math.random() * 10),
      }))
      return parsedIssues as Issue[]
    },
  })

  const getCreateApplication = (appId: string) => {
    return applications?.find(app => app.appId === appId)
  }

  return (
    <div className="flex-1 flex-col">
      <header className="flex items-center justify-between h-[36px] mb-4">
        <h1 className="flex flex-row items-center text-xl font-semibold">
          <Bug className="h-6 w-6 mr-2" />
          缺陷
          {selectedAppId !== ALL_APPS_VALUE && selectedApp && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">· {selectedApp.name}</span>
          )}
        </h1>
        {/* <CreateProjectsModal onCreateProject={createApplication} /> */}
      </header>
      <Tabs defaultValue="all">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">所有</TabsTrigger>
            <TabsTrigger value="active" disabled>
              待解决
            </TabsTrigger>
            <TabsTrigger value="draft" disabled>
              已解决
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            {/* —— 切换应用下拉 —— */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 pr-2">
                  {appsLoading ? (
                    <Skeleton className="h-4 w-20 rounded" />
                  ) : selectedApp ? (
                    <>
                      <img
                        src={appLogoMap[(selectedApp.type as keyof typeof appLogoMap) || 'vanilla']}
                        alt={selectedApp.type}
                        className="w-3.5 h-3.5 rounded"
                      />
                      <span className="sm:whitespace-nowrap max-w-[160px] truncate">{selectedApp.name}</span>
                    </>
                  ) : (
                    <>
                      <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="sm:whitespace-nowrap">所有应用</span>
                    </>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>切换应用</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {appsLoading ? (
                  <div className="p-2 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full rounded" />
                    ))}
                  </div>
                ) : applications && applications.length > 0 ? (
                  <DropdownMenuRadioGroup value={selectedAppId} onValueChange={setSelectedAppId}>
                    <DropdownMenuRadioItem value={ALL_APPS_VALUE}>
                      <div className="flex items-center gap-2 w-full">
                        <AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1">所有应用</span>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {applications.map(app => {
                      const type = (app.type as keyof typeof appLogoMap) || 'vanilla'
                      return (
                        <DropdownMenuRadioItem key={app.appId} value={app.appId}>
                          <div className="flex items-center gap-2 w-full">
                            <img src={appLogoMap[type]} alt={type} className="w-3.5 h-3.5 rounded" />
                            <span className="flex-1 min-w-0 truncate">{app.name}</span>
                            {typeof app.bugs === 'number' && app.bugs > 0 ? (
                              <span className="text-xs text-destructive font-medium">{app.bugs}</span>
                            ) : null}
                          </div>
                        </DropdownMenuRadioItem>
                      )
                    })}
                  </DropdownMenuRadioGroup>
                ) : (
                  <div className="p-3 text-xs text-muted-foreground text-center">暂无应用，先去创建一个</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">筛选</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>状态筛选</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked disabled>
                  所有
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem disabled>待解决</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem disabled>已解决</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <TabsContent value="all">
          <Card x-chunk="dashboard-06-chunk-0">
            <CardHeader>
              <CardTitle className="flex flex-row items-center">缺陷列表</CardTitle>
              <CardDescription>以下是您的应用程序中的缺陷列表。您可以在此处查看缺陷的详细信息，以及对其进行操作</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1">
                            <ListFilter className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">排序规则</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuRadioGroup value="lastScreen">
                            <DropdownMenuRadioItem value="lastScreen" disabled>
                              最后访问
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="events" disabled>
                              事件
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="users" disabled>
                              用户
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                    <TableHead>统计</TableHead>
                    <TableHead>事件</TableHead>
                    <TableHead>用户</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={`loading-${i}`}>
                        <TableCell className="font-medium py-4">
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-40 rounded" />
                            <Skeleton className="h-3 w-64 rounded" />
                            <Skeleton className="h-3 w-48 rounded" />
                          </div>
                        </TableCell>
                        <TableCell className="px-0 py-4">
                          <Skeleton className="w-[90%] h-16 rounded" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-10 rounded" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-4 w-10 rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : issues?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        {selectedAppId === ALL_APPS_VALUE ? '当前没有缺陷数据，快去触发一个 JS 异常试试吧' : '该应用当前没有缺陷数据'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues?.map(issue => {
                      const currentApp = getCreateApplication(issue.appId)
                      const currentAppType = currentApp?.type || 'vanilla'
                      return (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium flex flex-col gap-1 my-2">
                            <p className="text-sm text-blue-500">{issue.title}</p>
                            <p className="flex items-center gap-1 marker:text-xs text-gray-500">
                              <div className="w-2 h-2 bg-destructive rounded" />
                              {issue.description}
                            </p>
                            <div className="flex flex-row items-center gap-2">
                              <div className="flex flex-row items-center gap-1">
                                <img src={appLogoMap[currentAppType]} alt="React" className="w-4 h-4 rounded" />
                                <p className="text-xs text-gray-500">{currentApp?.name || 'Ningzhi React 应用'}</p>
                              </div>
                              <p className="flex flex-row items-center text-xs text-gray-500">
                                <Timer className="h-3 w-3 mr-1" />
                                {formatDate(issue.createdAt, 'yyyy-MM-dd HH:mm:ss')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="px-0">
                            <ChartContainer
                              config={{
                                resting: {
                                  label: 'Resting',
                                  color: `hsl(var(--chart-${issue.id}))`,
                                },
                              }}
                              className="w-[90%] h-16"
                            >
                              <LineChart
                                accessibilityLayer
                                margin={{
                                  left: 14,
                                  right: 14,
                                  top: 10,
                                }}
                                data={[
                                  {
                                    date: '2024-01-01',
                                    resting: 62,
                                  },
                                  {
                                    date: '2024-01-02',
                                    resting: 72,
                                  },
                                  {
                                    date: '2024-01-03',
                                    resting: 35,
                                  },
                                  {
                                    date: '2024-01-04',
                                    resting: 62,
                                  },
                                  {
                                    date: '2024-01-05',
                                    resting: 52,
                                  },
                                  {
                                    date: '2024-01-06',
                                    resting: 62,
                                  },
                                  {
                                    date: '2024-01-07',
                                    resting: 70,
                                  },
                                ]}
                              >
                                <CartesianGrid
                                  strokeDasharray="4 4"
                                  vertical={false}
                                  stroke="hsl(var(--muted-foreground))"
                                  strokeOpacity={0.5}
                                />
                                <Line
                                  dataKey="resting"
                                  type="natural"
                                  fill="var(--color-resting)"
                                  stroke="var(--color-resting)"
                                  strokeWidth={2}
                                  dot={false}
                                  activeDot={{
                                    fill: 'var(--color-resting)',
                                    stroke: 'var(--color-resting)',
                                    r: 4,
                                  }}
                                />
                                <ChartTooltip
                                  content={
                                    <ChartTooltipContent
                                      indicator="line"
                                      labelFormatter={value => {
                                        return new Date(value).toLocaleDateString('zh-CN', {
                                          day: 'numeric',
                                          month: 'long',
                                          year: 'numeric',
                                        })
                                      }}
                                    />
                                  }
                                  cursor={false}
                                />
                              </LineChart>
                            </ChartContainer>
                          </TableCell>
                          <TableCell>{issue.events}</TableCell>
                          <TableCell className="hidden md:table-cell">{issue.users}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
