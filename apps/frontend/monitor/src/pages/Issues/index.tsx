import { useQuery } from '@tanstack/react-query'
import { formatDate } from 'date-fns'
import { Bug, ListFilter, Timer } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

// const MOCK_ISSUES: Issue[] = [
//   {
//     id: 1,
//     title: 'ReferenceError',
//     description: 'myUndefinedFunction is not defined',
//     appType: 'react',
//     events: 13,
//     users: 2,
//     status: 'active',
//     createdAt: new Date(),
//   },
//   {
//     id: 2,
//     title: 'TypeError',
//     description: 'Cannot read property "name" of undefined',
//     appType: 'vue',
//     events: 6,
//     users: 1,
//     status: 'active',
//     createdAt: new Date(),
//   },
//   {
//     id: 3,
//     title: 'SyntaxError',
//     description: 'Unexpected token <',
//     appType: 'vanilla',
//     events: 8,
//     users: 3,
//     status: 'active',
//     createdAt: new Date(),
//   },
// ]

export function Issues() {
  const { data: applications } = useQuery<(ApplicationData & { appId: string })[]>({
    // - 在缓存中存取数据
    // - 跨组件 共享同一份数据 （多个 useQuery 用相同 key 会复用缓存）
    // 默认缓存在内存中
    queryKey: ['applications'],
  })
  const { data: issues } = useQuery({
    queryKey: ['issues'],
    queryFn: async () => {
      const res = await fetch('/dsn-api/bugs')
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
                  {issues?.map(issue => {
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
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
