import { Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, Label, Rectangle, ReferenceLine, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApplicationType } from '@/types/api'

import { appLogoMap } from '../Projects/meta'

export interface Performance {
  id: number
  path: string
  appType: ApplicationType
  appName: string
  users: number
}

const MOCK_PERFORMANCE: Performance[] = [
  {
    id: 1,
    path: '/',
    appType: 'react',
    appName: 'Ningzhi - React 应用',
    users: 2,
  },
  {
    id: 2,
    path: '/dashboard',
    appType: 'vue',
    appName: 'Ningzhi - Vue 应用',
    users: 1,
  },
  {
    id: 3,
    path: '/issues',
    appType: 'vanilla',
    appName: 'Ningzhi - JavaScript 应用',
    users: 3,
  },
]

export function Performance() {
  const generateSummaryPath = (queryParams: { project: string; appType: ApplicationType; transaction: string }) => {
    const query = new URLSearchParams(queryParams).toString()
    return `summary?${query.toString()}`
  }
  return (
    <div className="flex-1 flex-col">
      <header className="flex items-center justify-between h-[36px] mb-4">
        <h1 className="flex flex-row items-center text-xl font-semibold">
          <Zap className="h-6 w-6 mr-2" />
          性能
        </h1>
      </header>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          <Card className="flex flex-col flex-grow">
            <CardHeader>
              <CardTitle className="flex flex-row items-center">时长分布图</CardTitle>
              <CardDescription>通过时长分布图，您可以清晰看到资源记载情况</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                className="w-full h-64"
                config={{
                  steps: {
                    label: 'Steps',
                    color: 'hsl(var(--chart-2))',
                  },
                }}
              >
                <BarChart
                  accessibilityLayer
                  margin={{
                    left: -4,
                    right: -4,
                  }}
                  data={[
                    {
                      date: '2024-01-01',
                      steps: 2000,
                    },
                    {
                      date: '2024-01-02',
                      steps: 2100,
                    },
                    {
                      date: '2024-01-03',
                      steps: 2200,
                    },
                    {
                      date: '2024-01-04',
                      steps: 1300,
                    },
                    {
                      date: '2024-01-05',
                      steps: 1400,
                    },
                    {
                      date: '2024-01-06',
                      steps: 2500,
                    },
                    {
                      date: '2024-01-07',
                      steps: 1600,
                    },
                  ]}
                >
                  <Bar dataKey="steps" fill="var(--color-steps)" radius={5} fillOpacity={0.6} activeBar={<Rectangle fillOpacity={0.8} />} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tickFormatter={value => {
                      return new Date(value).toLocaleDateString('en-US', {
                        weekday: 'short',
                      })
                    }}
                  />
                  <ChartTooltip
                    defaultIndex={2}
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        labelFormatter={value => {
                          return new Date(value).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        }}
                      />
                    }
                    cursor={false}
                  />
                  <ReferenceLine y={1200} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeWidth={1}>
                    <Label position="insideBottomLeft" value="Average Steps" offset={10} fill="hsl(var(--foreground))" />
                    <Label
                      position="insideTopLeft"
                      value="12,343"
                      className="text-lg"
                      fill="hsl(var(--foreground))"
                      offset={10}
                      startOffset={100}
                    />
                  </ReferenceLine>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="flex flex-col flex-grow">
            <CardHeader>
              <CardTitle className="flex flex-row items-center">P50 时长统计</CardTitle>
              <CardDescription>通过 P50 时长统计，您可以查看应用的性能数据。</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                className="w-full h-64"
                config={{
                  time: {
                    label: 'Time',
                    color: 'hsl(var(--chart-4))',
                  },
                }}
              >
                <AreaChart
                  accessibilityLayer
                  data={[
                    {
                      date: '2024-01-01',
                      time: 8.5,
                    },
                    {
                      date: '2024-01-02',
                      time: 7.2,
                    },
                    {
                      date: '2024-01-03',
                      time: 8.1,
                    },
                    {
                      date: '2024-01-04',
                      time: 6.2,
                    },
                    {
                      date: '2024-01-05',
                      time: 5.2,
                    },
                    {
                      date: '2024-01-06',
                      time: 8.1,
                    },
                    {
                      date: '2024-01-07',
                      time: 7.0,
                    },
                  ]}
                  margin={{
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                  }}
                >
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['dataMin - 5', 'dataMax + 2']} hide />
                  <defs>
                    <linearGradient id="fillTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-time)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-time)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <Area dataKey="time" type="natural" fill="url(#fillTime)" fillOpacity={0.4} stroke="var(--color-time)" />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                    formatter={value => (
                      <div className="flex min-w-[120px] items-center text-xs text-muted-foreground">
                        Time in bed
                        <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
                          {value}
                          <span className="font-normal text-muted-foreground">hr</span>
                        </div>
                      </div>
                    )}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        <Card x-chunk="dashboard-06-chunk-0">
          <CardHeader>
            <CardTitle className="flex flex-row items-center">性能监控</CardTitle>
            <CardDescription>通过性能监控，您可以查看应用的性能数据。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>事务</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>用户</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_PERFORMANCE.map(performance => (
                  <TableRow key={performance.id}>
                    <TableCell className="font-medium py-4">
                      <Link
                        to={generateSummaryPath({
                          project: `${performance.id}`,
                          appType: performance.appType,
                          transaction: performance.path,
                        })}
                        className="text-sm text-blue-500"
                      >
                        {performance.path}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-row items-center gap-1">
                        <img src={appLogoMap[performance.appType]} alt="React" className="w-4 h-4 rounded" />
                        <p className="text-xs text-gray-500">{performance.appName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{performance.users}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
