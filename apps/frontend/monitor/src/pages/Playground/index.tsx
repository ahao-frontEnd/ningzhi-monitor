import copyText from 'copy-text-to-clipboard'
import { Activity, ArrowLeft, Bug, CheckCircle2, ClipboardCopy, Code2, MessageSquare, MousePointerClick } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

// 带复制按钮的代码块
function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { toast } = useToast()
  const handleCopy = () => {
    copyText(code)
    toast({ variant: 'success', title: '代码已复制到剪贴板' })
  }
  return (
    <div className="mt-3 relative">
      {label && (
        <div className="absolute top-1.5 left-2 text-[10px] text-muted-foreground font-mono bg-background/60 px-1.5 py-0.5 rounded">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-1.5 right-2 p-1 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        title="复制代码"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>
      <pre className="pt-6 pb-3 px-3 bg-muted rounded-md text-xs overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// 上报记录
interface ReportRecord {
  id: number
  time: string
  eventType: string
  message: string
  status: 'success' | 'error'
}

export function Playground() {
  const { appId = '' } = useParams<{ appId: string }>()
  const { toast } = useToast()
  const [records, setRecords] = useState<ReportRecord[]>([])
  const [customMessage, setCustomMessage] = useState('')

  // —— 两种环境的 DSN：
  //    本地开发（Vite 代理）用相对路径 /dsn-api/...
  //    线上生产（浏览器直接访问）用完整 HTTPS 路径
  const initCodeDev = `import { init } from '@ningzhi/monitor-sdk-browser'

// 本地开发：配合 Vite 代理（vite.config.ts 中配置 /dsn-api → 后端）
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})`

  const initCodeProd = `import { init } from '@ningzhi/monitor-sdk-browser'

// 线上生产：填写完整的 HTTPS 地址
init({
  dsn: 'https://monitor.ningzhi2.site/dsn-api/tracing/${appId}',
  integrations: [],
})`

  // 核心上报函数：用 fetch 模拟 SDK 实际发送的请求
  const report = async (eventType: string, message: string, info: Record<string, unknown>) => {
    try {
      const res = await fetch(`/dsn-api/tracing/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, message, ...info }),
      })
      if (res.ok) {
        setRecords(prev => [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            eventType,
            message,
            status: 'success' as const,
          },
          ...prev,
        ])
        toast({ variant: 'success', title: '上报成功', description: `${eventType}: ${message}` })
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '上报失败', description: (e as Error).message })
    }
  }

  // ===== 模拟场景 =====

  const simulateJSError = () => {
    report('error', 'Unexpected token', { type: 'SyntaxError', stack: 'at main.ts:18:3' })
  }

  const simulatePromiseReject = () => {
    report('error', '接口调用错误', { type: 'Error', stack: 'Promise.reject at main.ts:21:1' })
  }

  const simulatePerformance = () => {
    // 模拟一组典型的 Web Vitals 指标
    report('performance', 'Web Vitals 上报', {
      // FCP：First Contentful Paint（首次有内容绘制，单位 ms）
      fcp: 1280,
      // LCP：Largest Contentful Paint（最大内容元素绘制，衡量加载性能）
      lcp: 2150,
      // CLS：Cumulative Layout Shift（累计布局偏移，越小越好，<0.1 优秀）
      cls: 0.05,
      // INP：Interaction to Next Paint（交互延迟，替代 FID）
      inp: 148,
      // TTFB：Time To First Byte（首字节响应时间，后端响应速度）
      ttfb: 420,
      // DOM Ready 时间（DOMContentLoaded）
      dom_ready: 980,
      // 页面 load 事件时间
      load_event: 2430,
      // 页面路径
      path: '/home',
    })
  }

  const simulateClick = () => {
    report('click', '按钮点击', { target: 'button#counter', page: location.pathname })
  }

  const simulateCustomMessage = () => {
    if (!customMessage.trim()) {
      toast({ variant: 'destructive', title: '请输入消息内容' })
      return
    }
    report('message', customMessage.trim(), { source: 'manual' })
    setCustomMessage('')
  }

  // —— 每个场景的"完整示例代码"（SDK init + 场景触发，DSN 用相对路径版）
  //    用户复制到自己项目就能跑

  const jsErrorExample = `import { init } from '@ningzhi/monitor-sdk-browser'

// —— Step 1：应用入口处初始化一次，全局生效
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})

// —— Step 2：SDK 自动监听 window.onerror
// 任何位置抛出的未捕获异常，SDK 自动上报
throw new Error('Unexpected token')`

  const promiseExample = `import { init } from '@ningzhi/monitor-sdk-browser'

// —— Step 1：应用入口处初始化一次，全局生效
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})

// —— Step 2：SDK 自动监听 unhandledrejection
// 未 catch 的 Promise 拒绝自动上报
Promise.reject(new Error('接口调用错误'))`

  const performanceExample = `import { init } from '@ningzhi/monitor-sdk-browser'

// —— Step 1：应用入口处初始化一次，全局生效
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})

// —— Step 2：SDK 自动通过 PerformanceObserver 采集 Web Vitals
// 无需手动写任何代码，初始化后会自动上报：
//   FCP  — First Contentful Paint（首次内容绘制，<1800ms 优秀）
//   LCP  — Largest Contentful Paint（最大内容绘制，<2500ms 优秀）
//   CLS  — Cumulative Layout Shift（布局偏移，<0.1 优秀）
//   INP  — Interaction to Next Paint（交互延迟，<200ms 优秀）
//   TTFB — Time To First Byte（首字节时间，<800ms 优秀）
//   以及 navigation timing（domReady / loadEvent 等）

// —— 如果需要自定义上报性能指标：
// const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
// capturePerformance({
//   fcp: 1280, lcp: 2150, cls: 0.05, inp: 148,
//   ttfb: nav.responseStart, dom_ready: nav.domContentLoadedEventEnd,
// })`

  const clickExample = `import { init } from '@ningzhi/monitor-sdk-browser'

// —— Step 1：应用入口处初始化一次，全局生效
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})

// —— Step 2：SDK 自动监听 document click
// 用户点击元素时自动上报行为数据
document.querySelector('#submit-btn')!.click()`

  const messageExample = `import { init, captureMessage } from '@ningzhi/monitor-sdk-browser'

// —— Step 1：应用入口处初始化一次，全局生效
init({
  dsn: '/dsn-api/tracing/${appId}',
  integrations: [],
})

// —— Step 2：业务代码中任意位置主动上报自定义消息
captureMessage('hello world')
captureMessage('用户注册成功', { userId: 123, source: 'login' })`

  return (
    <div className="flex-1 flex-col">
      {/* 页头 */}
      <header className="flex items-center justify-between h-[36px] mb-4">
        <h1 className="flex flex-row items-center text-xl font-semibold">
          <Link to="/projects" className="mr-3 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Code2 className="h-5 w-5 mr-2" />
          数据上报演练场
        </h1>
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">应用 ID：{appId}</div>
      </header>

      {/* ================================================ */}
      {/* 1. SDK 初始化接入说明（最核心，放在最前面）        */}
      {/* ================================================ */}
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Code2 className="h-4 w-4 mr-2 text-primary" />
            第一步：SDK 初始化（只需在应用入口写一次）
          </CardTitle>
          <CardDescription>
            安装 <code className="px-1 py-0.5 bg-muted rounded">@ningzhi/monitor-sdk-browser</code> 包后，在 main.ts / index.ts 入口处调用{' '}
            <code className="px-1 py-0.5 bg-muted rounded">init()</code>，DSN 替换为当前应用的上报地址
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dev">
            <TabsList className="mb-2">
              <TabsTrigger value="dev">本地开发（Vite 代理）</TabsTrigger>
              <TabsTrigger value="prod">线上生产（HTTPS）</TabsTrigger>
            </TabsList>
            <TabsContent value="dev">
              <CodeBlock label="src/main.ts（本地）" code={initCodeDev} />
              <p className="mt-2 text-xs text-muted-foreground">
                💡 本地需在 <code className="px-1 py-0.5 bg-muted rounded">vite.config.ts</code> 中配置{' '}
                <code className="px-1 py-0.5 bg-muted rounded">/dsn-api</code> 代理到后端，详见 Playground 页面下的 vite 代理示例
              </p>
            </TabsContent>
            <TabsContent value="prod">
              <CodeBlock label="src/main.ts（线上）" code={initCodeProd} />
              <p className="mt-2 text-xs text-muted-foreground">
                💡 生产环境用完整 HTTPS 地址，监控平台会在「创建应用」时生成完整 DSN，复制粘贴即可
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ================================================ */}
      {/* 2. 场景卡片：每个场景都附"完整复制即用"的示例代码   */}
      {/* ================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 模拟 JS 异常 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Bug className="h-4 w-4 mr-2 text-destructive" />
              模拟 JS 异常（未捕获 Error）
            </CardTitle>
            <CardDescription>SDK 自动监听 window.onerror，未 try/catch 的异常无需写业务代码即可上报</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={simulateJSError}>
              模拟上报一次
            </Button>
            <CodeBlock label="src/main.ts（完整可复制）" code={jsErrorExample} />
          </CardContent>
        </Card>

        {/* 模拟 Promise 拒绝 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Bug className="h-4 w-4 mr-2 text-destructive" />
              模拟 Promise 拒绝
            </CardTitle>
            <CardDescription>SDK 自动监听 unhandledrejection 事件，未 catch 的 async/await 或 Promise 拒绝自动上报</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={simulatePromiseReject}>
              模拟上报一次
            </Button>
            <CodeBlock label="src/main.ts（完整可复制）" code={promiseExample} />
          </CardContent>
        </Card>

        {/* 模拟性能指标上报 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Activity className="h-4 w-4 mr-2 text-purple-500" />
              模拟性能指标上报（Web Vitals）
            </CardTitle>
            <CardDescription>
              SDK 通过 PerformanceObserver 自动采集 FCP / LCP / CLS / INP / TTFB 等核心 Web Vitals 指标，无需手动写代码
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={simulatePerformance}>
              模拟上报一次
            </Button>
            <CodeBlock label="src/main.ts（完整可复制）" code={performanceExample} />
          </CardContent>
        </Card>

        {/* 模拟点击上报 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <MousePointerClick className="h-4 w-4 mr-2 text-blue-500" />
              模拟点击上报
            </CardTitle>
            <CardDescription>SDK 自动监听 document click，上报用户点击的元素、页面路径等行为数据</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={simulateClick}>
              模拟上报一次
            </Button>
            <CodeBlock label="src/pages/home.ts（完整可复制）" code={clickExample} />
          </CardContent>
        </Card>

        {/* 自定义消息上报 */}
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
              自定义消息上报（captureMessage）
            </CardTitle>
            <CardDescription>通过 captureMessage 主动上报任意业务消息，可附带自定义上下文信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="输入消息内容，例如：用户登录成功 / 搜索关键词 xxx"
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && simulateCustomMessage()}
              />
              <Button size="sm" onClick={simulateCustomMessage}>
                模拟上报一次
              </Button>
            </div>
            <CodeBlock label="src/service/user.ts（完整可复制）" code={messageExample} />
          </CardContent>
        </Card>
      </div>

      {/* ================================================ */}
      {/* 3. 上报记录                                                       */}
      {/* ================================================ */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">本次会话的上报记录</CardTitle>
          <CardDescription>
            仅保存在当前页面内存中，刷新即清空。上报后可前往{' '}
            <Link to="/issues" className="text-blue-600 underline">
              缺陷
            </Link>{' '}
            页面查看线上数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无上报记录，点击上方「模拟上报一次」按钮试试</p>
          ) : (
            <div className="space-y-2">
              {records.map(record => (
                <div key={record.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-muted-foreground text-xs w-24">{record.time}</span>
                  <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">{record.eventType}</span>
                  <span className="text-sm">{record.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
