# Kafka + ClickHouse 集成重构总结

> 日期：2026-08-07
> 项目：main-monitor
> 作者：与 dsn-server 重构相关联
> 前置阅读：[01-kafka-intro-for-beginners.md](./01-kafka-intro-for-beginners.md)

---

## 一、背景与目标

### 1.1 改造前的问题

项目里有两份 "Kafka 半成品"代码，没有一个真正跑起来：

1. **[kafkaConsumerService.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/kafka/kafkaConsumerService.ts)**（已删除）
   - 定义了 `@Client(Transport.KAFKA)` 但**没有注册进任何 NestJS Module**，服务根本不会被实例化
   - `consumeMessages()` 方法**没有任何地方调用**
   - 用 `kafkaClient.send('tracking', {}).subscribe({...})` 作为消费者，这个 API 是**请求-响应模式**，根本不是订阅消费
   - `writeToClickHouse(payload)` 是空函数，只打了一行 log
   - `KafkaConsumerService` 订阅的是 `tracking` topic，但 SQL 文件里是 `monitor` topic，两边对不上

2. **[kafka-clickhouse-view.sql](file:///c:/Users/56801/Desktop/main-monitor/sql/kafka-clickhouse-view.sql)**（修复前）
   - 没有 `IF NOT EXISTS`，重复执行报错
   - `kafka_monitor` 表结构是 `key String, value String` 两列，但业务需要 4 列（app_id / event_type / message / info）
   - `monitor_data` 用 `CREATE TABLE ... AS kafka_monitor` 直接复制 key/value 结构，和业务完全对不上
   - `kafka_broker_list = 'localhost:9094'` 对 ClickHouse 容器是错误的（应该是服务名）

**实际运行链路**：只有 "HTTP → SpanService → 直写 ClickHouse base_monitor_storage" 这一条，Kafka 相关代码全是死代码。

### 1.2 改造目标

采用 **方案 B**（ClickHouse 自消费 Kafka）：

- **Node 端只做 Producer**：把监控数据打包发 Kafka
- **ClickHouse 用 Kafka 引擎表做 Consumer**：数据自动从 Kafka 落盘到 `monitor_data`
- **保留直写兜底（WRITE_MODE 开关）**：灰度期间双写对比，出问题一键切回直写
- **查询接口完全兼容**：`span()` / `bugs()` 不用改，仍然查 `base_monitor_view`
- **启动时自动建表**：和已有 [clickhouse.initializer.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/clickhouse/clickhouse.initializer.ts) 保持一致风格

---

## 二、最终架构

```
┌───────────────────────────────────────────────────────────────────┐
│                       前端 SDK（客户端）                           │
│         POST /api/tracing/:app_id (event_type / message / ...)    │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                   NestJS（宿主机进程）                            │
│                                                                   │
│  SpanController                                                    │
│       │                                                           │
│       ▼                                                           │
│  SpanService.tracking()                                           │
│       │                                                           │
│       ├─► WRITE_MODE=direct ──► CLICKHOUSE_CLIENT.insert()       │
│       │                             │                             │
│       │                             ▼                             │
│       │                        base_monitor_storage 表            │
│       │                                                           │
│       └─► WRITE_MODE=kafka/both ─► KafkaProducerService          │
│                                        │                          │
│                                        ▼  kafkajs                 │
│                               localhost:9094 (EXTERNAL listener) │
└───────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Docker 容器网络                                │
│                                                                   │
│  ┌─────────────────────────────┐                                  │
│  │  Kafka Broker               │                                  │
│  │  - PLAINTEXT :9092 (容器内) │ ←─────────┐                     │
│  │  - EXTERNAL :9094 (宿主机)  │           │                     │
│  │  Topic: monitor             │           │ 容器内通信           │
│  └─────────────────────────────┘           │ 服务名               │
│        │                                    │ ningzhi-monitor-    │
│        │ Kafka 引擎消费                    │ kafka:9092           │
│        ▼                                    ▼                     │
│  ┌─────────────────────────────────────────────────┐              │
│  │  ClickHouse                                     │              │
│  │                                                  │              │
│  │  kafka_monitor (Kafka 引擎，虚拟表)              │              │
│  │    4 列：app_id / event_type / message / info   │              │
│  │         ↓ 物化视图 kafka_to_monitor_data        │              │
│  │  monitor_data (MergeTree，真实存储)              │              │
│  │         ↓ 物化视图 base_monitor_view             │              │
│  │  base_monitor_view 追加 processed_message 列     │              │
│  │         ↓                                        │              │
│  │  SpanService.span() / bugs()  SELECT 查询        │              │
│  └─────────────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

---

## 三、代码变更清单

### 3.1 新建文件：[kafka.producer.service.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/kafka/kafka.producer.service.ts)

职责单一：**只负责把消息发到 Kafka**。

- 用 `kafkajs`（项目已有依赖，不要引入 NestJS `@Client`）
- `OnModuleInit` 时连接 Kafka，`WRITE_MODE=direct` 时跳过
- `sendTracking(msg: TrackingMessage)` 发送 1 条消息到 `monitor` topic
- Producer 配置：`allowAutoTopicCreation: true` + `idempotent: true`（幂等）
- `writeMode` getter 读环境变量 `WRITE_MODE`，支持 `kafka`（默认）/ `direct` / `both`
- 消息的 key = `app_id`，保证**同一个 app 的消息按 Partition 有序**

### 3.2 删除文件：`kafkaConsumerService.ts`

原因：

- 原代码是 NestJS `@Client` + `ClientKafka.send()` 模式，这是**请求-响应模式**不是消费模式，根本无法订阅消费消息
- Node 端消费者在 ClickHouse 引擎表方案下是冗余的（有了 Kafka 引擎表就不需要 Node 自己消费）
- 避免未来有人"修复"它，形成**双消费者**重复写数据

### 3.3 修改文件：[clickhouse.module.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/clickhouse/clickhouse.module.ts#L13-L27)

把 `KafkaProducerService` 加入 providers 和 exports。因为 `ClickhouseModule` 是 `@Global()` 的，所以整个应用任意模块不用再 import Kafka 相关东西，直接注入即可（和 `CLICKHOUSE_CLIENT` 一样）。

### 3.4 修改文件：[span.service.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/modules/span/span.service.ts#L26-L59)

- 构造函数注入 `KafkaProducerService`
- `tracking()` 里按 `writeMode` 分支：
  - `direct`：**只**直写 `base_monitor_storage`（老行为）
  - `kafka`：**只**发 Kafka；发送失败抛异常，让接口返回 5xx（防止静默丢数据）
  - `both`：先直写，再发 Kafka；**Kafka 发送失败不影响接口响应**（因为直写已经成功），只记日志
- `span()` / `bugs()` **完全不变**，查 `base_monitor_view`——但 base_monitor_view 的底层源表已从 `base_monitor_storage` 切换到 `monitor_data`（见下一节）

### 3.5 修改文件：[clickhouse.initializer.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/clickhouse/clickhouse.initializer.ts)

**阶段 1 — 版本迁移**：

- 查 `system.tables` 判断老版本的 `base_monitor_view` 是否存在（判断条件：`create_table_query` 里包含 `base_monitor_storage`）
- 如果存在，先 `DROP`。因为新版本它的 `FROM` 要改成 `monitor_data`

**阶段 2 — 按依赖顺序幂等建表**（每条语句单独调用 `clickHouseClient.command`，因为一次只能执行一条 SQL）：

```
kafka_monitor (Kafka 引擎)
    ↓ 先有源表
monitor_data (MergeTree 存储)
    ↓ 先有目标表
kafka_to_monitor_data (物化视图，TO monitor_data)
    ↓ 最后建查询视图
base_monitor_view (物化视图，FROM monitor_data，追加 processed_message)
```

关键配置细节：

- `kafka_monitor` 表结构 4 列，与业务字段完全对齐（**不再是 key/value 两列**）
- `kafka_broker_list = 'ningzhi-monitor-kafka:9092'`（**容器内 PLAINTEXT listener，不是 localhost**）
- `kafka_format = 'JSONEachRow'`（所以 kafkajs 发的消息必须是扁平 JSON，刚好这 4 个字段）
- `kafka_handle_error_mode = 'stream'`（解析失败的消息写入 kafka_errors 虚拟表，便于排查）
- `base_monitor_view` **不用 `POPULATE`**——新建表时不要回填历史数据，避免后续重建时造成重复

### 3.6 修改文件：[kafka-clickhouse-view.sql](file:///c:/Users/56801/Desktop/main-monitor/sql/kafka-clickhouse-view.sql)

同步代码里的 SQL 为 `IF NOT EXISTS` 版本，字段结构改成 4 业务列，修正 broker list。保持注释完整，便于直接在 DataGrip 手动执行。

---

## 四、排障复盘（实际遇到的 3 个关键问题）

### 问题 1：ClickHouse Kafka 消费者 `Can't get assignment`

**现象**：启动后一直报 `StorageKafka: Can't get assignment. Will keep trying.`，`monitor_data` 永远是 0。

**排查步骤**：

1. 先确认 kafkajs 发送成功了吗？→ 用 `kafka-console-consumer --partition 0 --offset 0`（不依赖 consumer group 的直接 partition 消费）读到了 4 条，消息格式完全正确。
2. 那么是 ClickHouse 的 consumer group 连不上 Coordinator。开启 ClickHouse 的 librdkafka debug 日志：
   ```xml
   <!-- /etc/clickhouse-server/config.d/kafka_debug.xml -->
   <clickhouse><kafka>
     <debug>cgrp,protocol,metadata,broker</debug>
     <log_level>7</log_level>
   </kafka></clickhouse>
   ```
3. 重启 ClickHouse 后看到详细日志：
   ```
   Group "monitor-ch" FindCoordinator response error: COORDINATOR_NOT_AVAILABLE
   ```
4. 怀疑 `__consumer_offsets` 不存在，尝试 `--describe --topic __consumer_offsets` → 报错 `Topic does not exist` ✓
5. 尝试 Kafka 自带 `kafka-console-consumer --group xxx --from-beginning` → 同样消费了 0 条，验证不是 ClickHouse 的问题 ✓

**根因**：Kafka 4.x KIP-848（新 Group Coordinator）**不会自动创建 `__consumer_offsets` 内部 topic**，导致 Coordinator 始终不可用。这是 Kafka 4.0 的已知行为。

**修复**（只需执行一次）：

```bash
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9094 --create \
  --topic __consumer_offsets \
  --partitions 50 \
  --replication-factor 1 \
  --config cleanup.policy=compact
```

验证修复：`kafka-consumer-groups.sh --list` 不再报错。

---

### 问题 2：ClickHouse `kafka_broker_list` 应该配什么地址？

**错误尝试**：`localhost:9094` → 看起来合理，但实际上 ClickHouse 是跑在自己的 Docker 容器里的，`localhost` 指的是 ClickHouse 容器本身，它内部没有 Kafka broker。

**正确值**：`ningzhi-monitor-kafka:9092`

- `ningzhi-monitor-kafka` 是 Docker Compose 中 Kafka 服务的名称（容器网络 DNS 可解析）
- `9092` 是 `PLAINTEXT` listener 端口，专门用于容器间通信
- 而 `9094` 是 `EXTERNAL` listener，是宿主机通过 `0.0.0.0:9094` 映射出来的，只能在宿主机（Node 端 kafkajs）用

**记忆口诀**：

- 宿主机上的程序（Node、DataGrip）→ `localhost:9094`
- 容器里的程序（ClickHouse、其他容器）→ `ningzhi-monitor-kafka:9092`

---

### 问题 3：`@clickhouse/client` 的 `json<T>()` 泛型

**错误写法**（我一开始犯的）：

```typescript
const checkJson = await result.json<{ data: Array<{ cnt: string | number }> }>()
const oldViewExists = Number(checkJson.data?.[0]?.cnt ?? 0) > 0
// ❌ 编译报错：Property 'cnt' does not exist on type { data: ... }[]
```

**正确写法**：

```typescript
// json<T>() 返回 QueryResult<T>，其内部结构是 { data: T[]; ... }
// 所以泛型 T 应该是"数组元素的类型"，而不是整个响应
const checkJson = await result.json<{ cnt: string | number }>()
const oldViewExists = Number(checkJson.data?.[0]?.cnt ?? 0) > 0
```

这个坑如果不踩，`pnpm build` 会在启动前就报错。

---

## 五、验证步骤（怎么确认链路完全通了）

### 5.1 TypeScript 编译

```powershell
cd apps/backend/dsn-server
pnpm run build
# → 应该 0 errors 0 warnings
```

### 5.2 启动（灰度双写模式）

```powershell
$env:WRITE_MODE="both"
pnpm start:dev
# 启动日志里应该有：
#   [KafkaProducer] Kafka producer connected (brokers=localhost:9094)
#   [ClickhouseInitializer] ClickHouse schema initialized successfully (kafka + monitor_data + views)
#   [NestApplication] Nest application successfully started
```

### 5.3 发送测试消息

```powershell
$body = '{"event_type":"error","message":"verify","page":"/test"}'
Invoke-RestMethod -Uri "http://localhost:8080/api/tracing/verify-app" -Method Post -ContentType "application/json" -Body $body
```

### 5.4 验证 Kafka → ClickHouse 消费

```powershell
Start-Sleep -Seconds 8

# monitor_data 应该至少 +1
docker exec ningzhi-monitor-clickhouse clickhouse-client --query "SELECT count() FROM monitor_data"

# base_monitor_view processed_message 列应该正确
docker exec ningzhi-monitor-clickhouse clickhouse-client --query "SELECT any(processed_message) FROM base_monitor_view WHERE app_id='verify-app'"
# → Ningzhi ==> error
```

### 5.5 验证查询接口

```powershell
# 应该返回所有条目（包含刚发的）
curl http://localhost:8080/api/span

# 只返回 event_type='error' 的条目
curl http://localhost:8080/api/bugs
```

### 5.6 切到纯 Kafka 模式

```powershell
# 停服务后：
$env:WRITE_MODE="kafka"
pnpm start:dev
```

---

## 六、WRITE_MODE 选型建议

| 阶段                               | WRITE_MODE          | 说明                                                                                                            |
| ---------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| 新环境首次上线（Kafka 还没验证过） | `both`              | 双写一段时间，两边比对 `count(base_monitor_storage)` 与 `count(monitor_data)`，确认数据完全一致                 |
| 比对成功后 1-3 天                  | `both` 保留一段时间 | 让消费者组运行稳定，观察有没有 offset 异常、重复消费                                                            |
| 稳定后（正式运行）                 | `kafka`             | 最干净的链路，只写 Kafka，ClickHouse 自己异步落盘；避免了 `base_monitor_storage` 和 `monitor_data` 双份存储浪费 |
| 遇到 Kafka 故障紧急回滚            | `direct`            | 不用改代码，改环境变量重启即可；等价于改造前的行为，100% 兼容                                                   |

---

## 七、未来可以扩展的方向

### 7.1 表结构增强

- 当前 `ORDER BY tuple()` 是空排序键，实际使用建议改成 `ORDER BY (app_id, event_type, ...)` 或加 `_timestamp` 字段，提升 `WHERE app_id=? AND event_type=?` 查询性能
- 增加 TTL（例如 `TTL toDateTime(info.timestamp) + INTERVAL 90 DAY`），自动清理过期监控数据

### 7.2 多物化视图

同一份 `kafka_monitor` 可以挂多个物化视图：

- `kafka_to_errors` → `WHERE event_type = 'error'` 写入 error 专用表
- `kafka_to_daily_agg` → 按天聚合 `app_id` 的统计数据
- 这样就不用每次 `SELECT count() ... GROUP BY` 跑大表

### 7.3 Producer 批量 & 压缩

`kafkajs` 的 producer 可以配置 `batch.size` / `compression.codec=gzip`，高流量时显著降低 Kafka 写入带宽和存储。

### 7.4 ClickHouse librdkafka 全局配置

目前 librdkafka 的 `debug` 等设置是**按表**配的。如果未来有多张 Kafka 引擎表，可以在 `/etc/clickhouse-server/config.d/kafka.xml` 里放全局 `<kafka>...</kafka>` 配置（含 `security.protocol`、`ssl.*`、`sasl.*` 等），共用凭据。

---

## 八、附：改动文件与行数（一览）

| 文件                      | 变更 | 行数                                                              |
| ------------------------- | ---- | ----------------------------------------------------------------- |
| kafka.producer.service.ts | 新建 | 108 行                                                            |
| kafkaConsumerService.ts   | 删除 | 53 行（旧有 bug）                                                 |
| clickhouse.module.ts      | 修改 | +2 行 import，+1 行 provider，+1 行 export                        |
| span.service.ts           | 修改 | +1 行 import，+1 构造参数，tracking() 方法重构为 3 模式分支       |
| clickhouse.initializer.ts | 修改 | + 老视图迁移检查，+ 4 条 CREATE 语句（替换旧的 2 条），+ 完整注释 |
| kafka-clickhouse-view.sql | 修改 | 4 条 CREATE ... IF NOT EXISTS，字段修正，broker 修正，完整流向图  |
