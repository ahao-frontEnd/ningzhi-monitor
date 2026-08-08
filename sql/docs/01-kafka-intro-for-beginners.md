# Kafka 入门指南（小白向）

> 面向完全没接触过 Kafka 的开发者，用一个**快递站**的类比帮你建立直觉。
> 看完这篇你就知道：Kafka 是什么、为什么要用它、它的核心概念、怎么在本项目里用它。

---

## 一、Kafka 是什么？用一句话解释

**Kafka 是一个"消息中转站"（消息队列系统）**。

它的作用类似**快递驿站**：

| <br />                                    | 类比                   | 实际含义                                                |
| :---------------------------------------- | ---------------------- | ------------------------------------------------------- |
| 📦 寄件人（商家）                         | **生产者 Producer**    | 你的程序产生数据（比如用户的点击事件、报错日志）        |
| 📍 快递驿站（存放包裹的货架）             | **Kafka Broker**       | Kafka 服务器，负责接收、存储消息                        |
| 🏷️ 货架编号（不同商家的包裹分开放）       | **Topic**              | 消息的"分类文件夹"，比如 `monitor` topic 专门存监控数据 |
| 🛍️ 取件人（买家）                         | **消费者 Consumer**    | 从 Topic 里拿消息去处理（比如写入数据库、发告警）       |
| 🏬 驿站里的工作人员（分配货架、通知取件） | **协调器 Coordinator** | Kafka 内部组件，负责决定哪个消费者消费哪一批消息        |

**核心作用**：让**生产者**和**消费者\*\*\*\*解耦**——

- 生产者不用管数据给谁、对方是不是在线，只要往 Kafka 里"扔"就行
- 消费者也不用管谁发的，需要的时候去 Kafka 里"取"就行
- 双方速度不一样也没关系（比如每秒产生 1 万条数据，但数据库每秒只能写 1000 条），Kafka 在中间"缓冲"

---

## 二、为什么项目里要用 Kafka？（不用行不行？）

原来的链路是\*\*"HTTP 直写数据库"\*\*：

```
用户请求 → 后端服务 → 直接写 ClickHouse（数据库）
```

这在流量小的时候没问题，但如果流量突然变大（比如 1 秒来 10 万个请求），直接写数据库会有问题：

1. **数据库扛不住** — 写入压力太大，数据库会变慢甚至挂掉
2. **请求会超时** — 数据库写入慢，用户的 HTTP 请求要等很久才能返回
3. **数据可能丢** — 数据库挂掉了，来的请求就直接报错丢失

引入 Kafka 之后：

```
用户请求 → 后端服务 → 写 Kafka（毫秒级）→ 数据库慢慢消费 Kafka 的消息
```

好处：

1. **削峰填谷** — 突发流量高峰全部积压在 Kafka，数据库按自己的节奏慢慢消费
2. **请求更快** — 写 Kafka 只要几毫秒，不用等数据库写入完成
3. **更可靠** — 数据先写到 Kafka（存到磁盘），不会因为数据库临时不可用就丢了
4. **灵活** — 同一份数据可以被多个消费者各取一份去做不同处理（比如一个写 CK，一个发告警）

---

## 三、Kafka 的核心概念（必须搞懂的 7 个词）

这 7 个词会在各种文档、代码、报错里反复出现，记不住也要混个脸熟。

### 3.1 Broker

Kafka 的服务器。你启动的 `docker-compose` 里那个 `ningzhi-monitor-kafka` 容器就是一个 Broker。可以理解为**快递站本体**。

### 3.2 Topic

消息的"分类"。生产者往某个 Topic 里发，消费者从某个 Topic 里取。

本项目里用的 Topic 叫 `monitor`，专门存前端 SDK 上报的监控数据。

一个 Broker 里可以有很多 Topic，互不干扰。

### 3.3 Partition（分区）

一个 Topic 可以分成多个 Partition（本项目的 `monitor` 只有 1 个 Partition）。可以理解为**货架上的几层**——同一类快递（同一个 Topic）可以分开放在几层（多个 Partition）上。

- 同一个 Partition 内的消息是严格有序的
- 不同 Partition 之间没有顺序保证
- 为什么要分区？方便**并行处理**：消费者多的时候，每个消费者各负责几个 Partition，不会互相抢

### 3.4 Producer（生产者）

往 Topic 里写消息的程序。本项目里是 [kafka.producer.service.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/kafka/kafka.producer.service.ts) 里封装的 `KafkaProducerService`。

发消息时可以指定 `key`：

- 相同 key 的消息会进入同一个 Partition
- 好处：保证**同一个 app 的监控数据进入同一个 Partition，消费时不会乱序**
- 本项目里 key = `app_id`

### 3.5 Consumer（消费者）

从 Topic 里读消息的程序。

本项目里**没有** Node.js 消费者——我们用了 **ClickHouse 的 Kafka 引擎表**作为消费者（它内部有 librdkafka（lib Rapid‑Data kafka） 客户端）。

### 3.6 Consumer Group（消费者组）

多个消费者可以组成一个"消费者组"，组里**共同消费**一个 Topic 的全部 Partition——每个 Partition 只会被组里一个消费者消费。

本项目里 ClickHouse 的消费者组名是 `monitor-ch`。

> 举个栗子：Topic A 有 3 个 Partition，消费者组里有 2 个消费者
>
> - 消费者 1 → 消费 Partition 0 + 1
> - 消费者 2 → 消费 Partition 2
>
> 这个分配工作就是 Coordinator 做的（下一个概念）。

### 3.7 Coordinator（协调器）

Kafka Broker 内部的一个角色，负责：

- 给消费者分配 Partition（谁消费哪一层货架）
- 跟踪每个消费者消费到了哪条消息（即 offset）
- 检测消费者是否掉线（掉线了就把它的 Partition 重新分配给别人）

**⚠️ 本项目里遇到的关键问题**就是 Coordinator 不工作——原因见下方 5.2 节。

---

## 四、消息怎么在 Kafka 里流转？（一张时序图）

以本项目里"用户点了一个按钮，触发 `event_type: 'click'` 上报"为例：

```
时间  | 操作                           | 说明
------|--------------------------------|------------------------------
 T1   | SDK 发送 HTTP POST /tracing    | 前端按钮点击事件
 T2   | SpanService.tracking()         | 后端收到请求
 T3   | KafkaProducerService           | 把数据打包成 JSON：
      |   .sendTracking({              |   {"app_id":"demo",
      |      app_id: "demo",           |    "event_type":"click",
      |      event_type: "click", ...})|    "message":"..." }
 T4   | Kafka Broker 接收消息          | 写进 monitor Topic 的
      |                                | Partition 0（key=demo）
 T5   | HTTP 返回 200                  | ✅ 到此为止，SDK 侧已完成
 T6   | (几秒后) ClickHouse 的 Kafka   | ClickHouse 以消费者组
      |   引擎表开始消费               | monitor-ch 的身份消费
 T7   | 物化视图 kafka_to_monitor_data | 从 kafka_monitor 表自动
      |   自动同步                     | 同步数据到 monitor_data
 T8   | 用户查 GET /api/span           | base_monitor_view 从
      |                                | monitor_data 读数据返回
```

---

## 五、踩过的坑（Kafka 新手容易遇到的问题）

这些都是**本项目实际遇到**的问题，以后改 Kafka 相关配置时先对照一下：

### 5.1 坑 1：Docker 内外 listener 不一样

Kafka Broker 有多个 listener（可以理解为"对外服务的多个地址"）：

```
本项目 Kafka 容器的配置：
  LISTENERS:
    PLAINTEXT://:9092       ← 容器内服务间通信（PLAINTEXT listener）
    EXTERNAL://0.0.0.0:9094 ← 宿主机访问（EXTERNAL listener）
  ADVERTISED_LISTENERS:
    PLAINTEXT://ningzhi-monitor-kafka:9092   ← 其他容器连它时用这个
    EXTERNAL://localhost:9094                ← 宿主机连它时用这个
```

**所以**：

- kafkajs（在宿主机上跑的 Node 程序）→ `localhost:9094` ✓
- ClickHouse（在另一个容器里） → `ningzhi-monitor-kafka:9092` ✓
- 反过来都会连不上！

### 5.2 坑 2：Kafka 4.x 的 `__consumer_offsets` 不会自动创建

**问题现象**：消费者（包括 kafkajs、clickhouse、kafka-console-consumer）加入 consumer group 时都报 `COORDINATOR_NOT_AVAILABLE`。

**原因**：Kafka 4.0 引入了新的 Group Coordinator（KIP-848），它不会像老版本那样自动创建内部 topic `__consumer_offsets`。这个 topic 是存储 offset（消费到哪了）和协调消费者分配的——它不存在，Coordinator 就没法工作。

**修复命令**（只需要跑一次，除非删了 Kafka 容器重建）：

```bash
docker exec ningzhi-monitor-kafka \
  /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9094 \
  --create \
  --topic __consumer_offsets \
  --partitions 50 \
  --replication-factor 1 \
  --config cleanup.policy=compact
```

怎么验证修好了？执行完跑这个：

```bash
docker exec ningzhi-monitor-kafka \
  /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9094 \
  --list
```

如果不报错，就说明 `__consumer_offsets` 存在了。

### 5.3 坑 3：`allowAutoTopicCreation` 有陷阱

kafkajs 的 Producer 配置里有 `allowAutoTopicCreation: true`——意思是"如果发送的 Topic 不存在，让 Broker 自动创建"。

但它是**发送消息时才会触发**！第一次 send 时 Broker 会返回 Topic 不存在的 metadata 错误，kafkajs 内部会重试。对使用者来说**感知不到**（没有报错），但会有**几十毫秒的延迟**。所以关键链路建议预先手动创建好 Topic。

### 5.4 坑 4：`kafka_format = 'JSONEachRow'` 对消息格式有严格要求

ClickHouse 的 Kafka 引擎表如果配置了 `kafka_format = 'JSONEachRow'`，那么 Kafka 消息的 value **必须是**每行一个扁平 JSON，字段名和表的列名完全对应。

```json
✅ 正确：
{"app_id":"demo","event_type":"error","message":"msg","info":{"key":"val"}}

❌ 错误（多套了一层）：
{"payload": {"app_id":"demo", ...}}

❌ 错误（列名不匹配）：
{"appId":"demo","eventType":"error", ...}
```

---

## 六、本项目里 Kafka 相关的文件速查

| 文件                                                                                                                                                   | 作用                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [kafka.producer.service.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/kafka/kafka.producer.service.ts)      | Kafka 生产者，Node 端只有它一个文件负责发消息         |
| [clickhouse.initializer.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/clickhouse/clickhouse.initializer.ts) | 启动时自动创建 ClickHouse 端的 Kafka 引擎表、物化视图 |
| [span.service.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/modules/span/span.service.ts)                                | 调用 Producer 写 Kafka 的业务逻辑                     |
| [kafka-clickhouse-view.sql](file:///c:/Users/56801/Desktop/main-monitor/sql/kafka-clickhouse-view.sql)                                                 | 建表 SQL 文档（可以在 DataGrip 里手动执行）           |

---

## 七、环境变量

| 变量            | 默认值           | 说明                                                                       |
| --------------- | ---------------- | -------------------------------------------------------------------------- |
| `KAFKA_BROKERS` | `localhost:9094` | kafkajs 连接的 Broker 列表（宿主机视角）                                   |
| `WRITE_MODE`    | `kafka`          | 写模式：`kafka`（仅 Kafka）/ `direct`（仅直写 CK）/ `both`（双写，灰度用） |

---

## 八、常用运维命令

```powershell
# ===== 查看所有 Topic =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9094 --list

# ===== 查看某个 Topic 详情 =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9094 --describe --topic monitor

# ===== 手动创建 Topic（3 分区 1 副本） =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9094 --create --topic my-topic --partitions 3 --replication-factor 1

# ===== 从 Topic 里读全部消息（从头开始消费） =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9094 --topic monitor --from-beginning --timeout-ms 10000

# ===== 查看消费者组列表 =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9094 --list

# ===== 查看某个消费者组的消费进度 =====
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9094 --describe --group monitor-ch

# ===== 手动发送一条消息（回车后每行是一条） =====
docker exec -i ningzhi-monitor-kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9094 --topic monitor
# 然后在控制台粘贴 JSON，按回车发送
```

---

## 九、调试建议（出问题了从哪看）

如果消息发了但查不到数据，按这个顺序排查：

```
1. 检查 kafkajs 是否连接成功
   → Node 启动日志里有没有 [KafkaProducer] Kafka producer connected

2. 检查消息是否真的进了 Kafka
   → 用上面的 kafka-console-consumer.sh 从 begin 消费 monitor Topic
   → 如果有 0 条消息：Producer 发送失败，回去看应用日志
   → 如果有消息：继续下一步

3. 检查 Consumer Group 是否正常
   → 用 kafka-consumer-groups.sh --describe --group monitor-ch
   → 如果报错 COORDINATOR_NOT_AVAILABLE：__consumer_offsets 没创建，看 5.2 节
   → 如果 STATE 是 Stable：正常，继续下一步

4. 检查 ClickHouse 的 monitor_data 表有没有数据
   → clickhouse-client --query "SELECT count() FROM monitor_data"
   → 有数据：base_monitor_view 查询层问题
   → 没数据：看 ClickHouse 日志

5. 看 ClickHouse 日志里的 Kafka 错误
   → docker exec ningzhi-monitor-clickhouse bash -c \
       "tail -200 /var/log/clickhouse-server/clickhouse-server.log | grep -i kafka"
   → 常见错误：broker 地址不对（localhost:9094 → 应该是 ningzhi-monitor-kafka:9092）
```
