import { Copy, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { CreateProjectsModal } from './CreateProjectModal'
import { appLogoMap } from './meta'
import { AppData } from './types'

export const description = 'A collection of health charts.'

const appsData: AppData[] = [
  {
    type: 'vanilla',
    id: 'vanilla0fas9',
    name: '原生应用',
    bugs: 0,
    transactions: 0,
    data: [
      {
        date: '2024-01-01',
        resting: 62,
      },
      {
        date: '2024-01-02',
        resting: 52,
      },
      {
        date: '2024-01-03',
        resting: 31,
      },
      {
        date: '2024-01-04',
        resting: 62,
      },
      {
        date: '2024-01-05',
        resting: 82,
      },
      {
        date: '2024-01-06',
        resting: 62,
      },
      {
        date: '2024-01-07',
        resting: 70,
      },
    ],
  },
  {
    type: 'react',
    id: 'react0fas9',
    name: 'React 应用',
    bugs: 0,
    transactions: 0,
    data: [
      {
        date: '2024-01-01',
        resting: 62,
      },
      {
        date: '2024-01-02',
        resting: 62,
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
        resting: 42,
      },
      {
        date: '2024-01-06',
        resting: 62,
      },
      {
        date: '2024-01-07',
        resting: 70,
      },
    ],
  },
  {
    type: 'vanilla',
    id: 'vanilla0fas9',
    name: 'Ningzhi原生应用',
    bugs: 0,
    transactions: 0,
    data: [
      {
        date: '2024-01-01',
        resting: 62,
      },
      {
        date: '2024-01-02',
        resting: 32,
      },
      {
        date: '2024-01-03',
        resting: 35,
      },
      {
        date: '2024-01-04',
        resting: 42,
      },
      {
        date: '2024-01-05',
        resting: 52,
      },
      {
        date: '2024-01-06',
        resting: 82,
      },
      {
        date: '2024-01-07',
        resting: 70,
      },
    ],
  },
  {
    type: 'vue',
    id: 'vue0fas9',
    name: 'Vue3 应用',
    bugs: 0,
    transactions: 0,
    data: [
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
    ],
  },
]

export function Projects() {
  return (
    <div>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">项目总览</h1>
        <CreateProjectsModal />
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {appsData.map((app, index) => (
          <div key={index} className="w-full">
            <Card className="shadow-none hover:drop-shadow-xl">
              <CardHeader className="w-full flex flex-row justify-between align-top">
                <div className="flex items-center h-[48px]">
                  <img className="w-10 h-10 object-cover rounded-sm mr-3" src={appLogoMap[app.type]} alt="Project" />
                  <div className="flex flex-col justify-center gap-1 items-stretch h-full">
                    <CardTitle>
                      <Link to="/project/1" className="font-semibold text-sm">
                        {app.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      缺陷：{app.bugs} | 事务：{app.transactions}
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>删除</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-0 bg-muted">
                <ChartContainer
                  config={{
                    resting: {
                      label: 'Resting',
                      color: `hsl(var(--chart-${index + 1}))`,
                    },
                  }}
                  className="h-[150px] w-full"
                >
                  <LineChart
                    accessibilityLayer
                    margin={{
                      left: 14,
                      right: 14,
                      top: 10,
                    }}
                    data={app.data}
                  >
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
                    <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={value => {
                        return new Date(value).toLocaleDateString('en-US', {
                          weekday: 'short',
                        })
                      }}
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
                  </LineChart>
                </ChartContainer>
              </CardContent>
              <CardFooter className="flex flex-row items-center justify-between pt-6 gap-2 w-full">
                <p className="text-xs text-muted-foreground">创建时间：2024-01-01</p>
                <Button variant="secondary" size="sm">
                  <p className="text-xs text-left">应用 ID：{app.id}</p>
                  <Copy className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
