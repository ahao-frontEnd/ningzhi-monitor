# Kafka 4.x KIP-848 自动化修复：docker-compose init 容器方案

> 日期：2026-08-08
> 项目：main-monitor
> 前置阅读：[03-kafka-cloud-deployment-troubleshooting.md](./03-kafka-cloud-deployment-troubleshooting.md) 问题 7
> 关联文件：[.devcontainer/docker-compose.yml](../../.devcontainer/docker-compose.yml)

---

## 一、背景：同一个坑踩了第二次

[03 文档问题 7](./03-kafka-cloud-deployment-troubleshooting.md) 记录了线上部署时 Kafka 4.x KIP-848 的坑：`__consumer_offsets` topic 不自动创建，导致 ClickHouse Kafka 引擎表消费者收到 `COORDINATOR_NOT_AVAILABLE`，消息堆积不落盘。

当时用的是**手动修复**——在服务器上执行一次 `kafka-topics.sh --create`。文档的"经验教训"里也写了：

> 最好把这步写入初始化脚本（docker-compose 里加 `depends_on` + 一个临时 init 容器跑 create topic 命令），避免未来服务器重启/换机器后又要手动修。

但本地开发环境没有做这个自动化，结果**再次踩坑**：

### 现象

- SDK 上报接口 `POST /dsn-api/tracing/reactqtckkm` 返回 201 成功 ✅
- 但 `GET /dsn-api/span` 返回空数组 `[]` ❌
- ClickHouse `monitor_data` 表 count=0，`base_monitor_view` count=0

### 排查路径

| 检查点                           | 结果                                               | 结论                        |
| -------------------------------- | -------------------------------------------------- | --------------------------- |
| `.env` 的 `WRITE_MODE`           | 未配置 → 默认 `kafka`                              | 走纯 Kafka 链路             |
| `base_monitor_storage`（直写表） | 0 条                                               | 合理（kafka 模式不直写）    |
| `monitor_data`（Kafka 落盘目标） | **0 条**                                           | ❌ 断点！Kafka 消息没被消费 |
| ClickHouse 表是否存在            | 5 张表全在（含 `kafka_monitor` 引擎表）            | 表结构 OK                   |
| `kafka_monitor` 配置             | `kafka_broker_list = 'ningzhi-monitor-kafka:9092'` | 配置正确                    |
| ClickHouse → Kafka 网络          | `CONNECT OK`                                       | 网络通                      |
| Kafka topics 列表                | 只有 `monitor`，**没有 `__consumer_offsets`**      | ❌ **根因！**               |

### 根因

与线上完全相同——**Kafka 4.x KIP-848**：新 group coordinator 不自动创建 `__consumer_offsets` topic。

但为什么本地又出现了？因为本地 Kafka 容器**没有配置数据持久化 volume**（docker-compose.yml 里 `volumes` 被注释掉了），每次 `docker compose down` 后 Kafka 数据全部丢失，`__consumer_offsets` 也不复存在。而 03 文档的手动修复只在线上服务器执行过一次，本地从未做过。

---

## 二、为什么手动方案不够

| 场景                            | 手动方案的问题                                        |
| ------------------------------- | ----------------------------------------------------- |
| 本地 `docker compose down` 重启 | Kafka 数据清空，`__consumer_offsets` 丢失，需手动再建 |
| 换一台开发机器                  | 新机器上 Kafka 全新启动，需手动再建                   |
| 线上服务器迁移                  | 新服务器 Kafka 全新启动，需手动再建                   |
| CI/CD 首次部署到新环境          | 部署后 Kafka 消费不通，需人工介入                     |

手动方案的三个痛点：

1. **不可复现**：依赖人记得"要执行这一步"，新成员接手时不知道
2. **不可自动化**：CI/CD 部署后需要人工 SSH 进服务器执行命令
3. **不可追溯**：没有代码记录这个步骤，只有文档（文档和代码分离容易不同步）

---

## 三、自动化方案设计

### 核心思路

在 docker-compose.yml 里新增一个**一次性 init 容器**（`kafka-init`），在 Kafka 完全启动后自动创建必要的 topics，ClickHouse 等 init 容器执行完毕后再启动。

### 启动依赖链

```
Kafka 启动 → (healthcheck 通过) → kafka-init 执行 create topics → (exit 0) → ClickHouse 启动
```

### 三个关键技术点

#### 1. Kafka healthcheck（判断 Kafka 是否完全就绪）

```yaml
healthcheck:
  test: ['CMD-SHELL', '/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list >/dev/null 2>&1']
  interval: 5s
  timeout: 5s
  retries: 20
  start_period: 10s
```

用 `kafka-topics.sh --list` 检测——比 TCP 端口检测更可靠，确保 broker 已能处理请求（不只是端口开了，而是 Kafka 服务已完全初始化）。

- `start_period: 10s`：Kafka 启动需要几秒，给一个宽限期
- `retries: 20` + `interval: 5s`：最多等 100 秒，Kafka 启动慢时也不会误判

#### 2. kafka-init 一次性服务（创建 topics）

```yaml
ningzhi-monitor-kafka-init:
  image: apache/kafka # 复用 Kafka 镜像（含 kafka-topics.sh 工具）
  depends_on:
    ningzhi-monitor-kafka:
      condition: service_healthy # 等 Kafka healthcheck 通过
  command:
    - /bin/bash
    - -c
    - |
      /opt/kafka/bin/kafka-topics.sh --bootstrap-server ningzhi-monitor-kafka:9092 \
        --create --if-not-exists \
        --topic __consumer_offsets --partitions 50 --replication-factor 1 \
        --config cleanup.policy=compact
      /opt/kafka/bin/kafka-topics.sh --bootstrap-server ningzhi-monitor-kafka:9092 \
        --create --if-not-exists \
        --topic monitor --partitions 1 --replication-factor 1
  restart: 'no' # 执行完即退出
```

关键设计：

| 设计点                       | 说明                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `image: apache/kafka`        | 复用 Kafka 镜像，不需要额外拉取工具镜像                                                 |
| `condition: service_healthy` | 等 Kafka healthcheck 通过才执行（不是 `service_started`，端口开了不等于服务就绪）       |
| `--if-not-exists`            | **幂等保证**：topic 已存在时跳过，不报错。重复 `docker compose up` 安全                 |
| `restart: "no"`              | 一次性容器，执行完退出，不会反复重启                                                    |
| 创建两个 topic               | `__consumer_offsets`（KIP-848 修复）+ `monitor`（业务 topic，提前创建避免首次发送延迟） |

#### 3. ClickHouse 依赖 init 容器完成

```yaml
ningzhi-monitor-clickhouse:
  depends_on:
    ningzhi-monitor-kafka-init:
      condition: service_completed_successfully
```

`service_completed_successfully` 是 docker compose 的一个 depends_on condition：

| condition 值                     | 含义                                |
| -------------------------------- | ----------------------------------- |
| `service_started`                | 容器启动即继续（不管服务是否就绪）  |
| `service_healthy`                | 容器 healthcheck 通过才继续         |
| `service_completed_successfully` | 容器**执行完毕并退出码为 0** 才继续 |

用 `service_completed_successfully` 确保 ClickHouse 在 topics 创建完成后才启动，这样 ClickHouse 的 Kafka 引擎表消费者启动时 `__consumer_offsets` 一定已经存在。

---

## 四、完整配置

改动只涉及一个文件：[.devcontainer/docker-compose.yml](../../.devcontainer/docker-compose.yml)

### 改动 1：Kafka 服务加 healthcheck

```yaml
ningzhi-monitor-kafka:
  image: apache/kafka
  # ... 原有配置不变 ...
  healthcheck: # 新增
    test: ['CMD-SHELL', '/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list >/dev/null 2>&1']
    interval: 5s
    timeout: 5s
    retries: 20
    start_period: 10s
```

### 改动 2：新增 kafka-init 服务（在 Kafka 和 ClickHouse 之间）

```yaml
ningzhi-monitor-kafka-init:
  image: apache/kafka
  container_name: ningzhi-monitor-kafka-init
  depends_on:
    ningzhi-monitor-kafka:
      condition: service_healthy
  command:
    - /bin/bash
    - -c
    - |
      echo "==== Kafka init: creating required topics ===="
      /opt/kafka/bin/kafka-topics.sh --bootstrap-server ningzhi-monitor-kafka:9092 \
        --create --if-not-exists \
        --topic __consumer_offsets --partitions 50 --replication-factor 1 \
        --config cleanup.policy=compact
      echo "✅ __consumer_offsets created (or already exists)"
      /opt/kafka/bin/kafka-topics.sh --bootstrap-server ningzhi-monitor-kafka:9092 \
        --create --if-not-exists \
        --topic monitor --partitions 1 --replication-factor 1
      echo "✅ monitor created (or already exists)"
      echo "==== Kafka init done ===="
  restart: 'no'
```

### 改动 3：ClickHouse 依赖 kafka-init 完成

```yaml
ningzhi-monitor-clickhouse:
  image: clickhouse:25.10
  depends_on: # 新增
    ningzhi-monitor-kafka-init:
      condition: service_completed_successfully
  # ... 原有配置不变 ...
```

---

## 五、验证过程与结果

### 验证方法

```powershell
# 1. 停掉所有服务（清空 Kafka 数据，模拟全新环境）
docker compose -f .devcontainer/docker-compose.yml down

# 2. 重新启动
docker compose -f .devcontainer/docker-compose.yml up -d
```

### 启动日志（依赖链按预期工作）

```
Container ningzhi-monitor-kafka Created
Container ningzhi-monitor-kafka-init Created
Container ningzhi-monitor-clickhouse Created
Container ningzhi-monitor-kafka Started
Container ningzhi-monitor-kafka Waiting       ← 等 healthcheck
Container ningzhi-monitor-kafka Healthy       ← ✅ healthcheck 通过
Container ningzhi-monitor-kafka-init Started   ← init 容器开始执行
Container ningzhi-monitor-kafka-init Waiting   ← 等执行完成
Container ningzhi-monitor-kafka-init Exited    ← ✅ 执行完毕退出
Container ningzhi-monitor-clickhouse Started   ← CK 在 init 完成后启动
```

### kafka-init 执行日志

```
==== Kafka init: creating required topics ====
Created topic __consumer_offsets.
✅ __consumer_offsets created (or already exists)
Created topic monitor.
✅ monitor created (or already exists)
==== Kafka init done ====
```

退出状态：`exited (exit=0)` ✅

### Topics 验证

```
$ kafka-topics.sh --list
__consumer_offsets       (50 分区, cleanup.policy=compact)
monitor                  (1 分区)
```

### ClickHouse 消费者状态（零异常）

```
table:                      kafka_monitor
assignments.topic:          ['monitor']
assignments.partition_id:   [0]
exceptions.text:            []                    ← 零异常！
num_rebalance_assignments:  1                     ← 消费者组协调器正常
is_currently_used:          1
```

### 端到端数据验证

发送测试数据 → 3 秒后 ClickHouse 有数据：

```
monitor_data:        1 条 ✅
base_monitor_view:   1 条 ✅
内容: reactqtckkm  error  kafka-init verification test
消费者: num_messages_read=1, num_commits=1
```

---

## 六、对线上部署与 CI/CD 的影响

### compose 文件继承关系

```
docker-compose.yml              ← 基础设施（Kafka/CK/PG/Redis）  ← 改动在这里
  ↑ include
docker-compose.deploy.yml       ← 本地部署（+ server + caddy）
  ↑ include
docker-compose.production.yml   ← 线上部署（+ server + dsn-server + caddy，ACR 镜像）
```

三个 compose 文件通过 `include` 继承，改动 `docker-compose.yml` 会自动传递到 `deploy.yml` 和 `production.yml`。

### 影响分析

| 关注点              | 结论                 | 说明                                                                                |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| **CI/CD 流程**      | ✅ 不受影响          | CI/CD 只是 rsync 同步 `.devcontainer/` 目录 + `docker compose up`，新服务会自动启动 |
| **线上部署**        | ✅ 正面影响          | 线上 Kafka 也自动创建 `__consumer_offsets`，不再需要手动 `docker exec` 修复         |
| **幂等安全**        | ✅ `--if-not-exists` | topic 已存在时跳过，重复执行不报错                                                  |
| **启动耗时**        | ✅ 可忽略            | 多了 kafka-init 执行时间（约 2-3 秒）                                               |
| **线上已有 topics** | ✅ 安全              | `--if-not-exists` 跳过，不会覆盖已有 topic 的配置                                   |

### CI/CD 部署流程变化

CI/CD 的 [deploy.yml](../../.github/workflows/deploy.yml) 步骤 5 原来是：

```bash
docker compose -f .devcontainer/docker-compose.production.yml up -d \
  ningzhi-monitor-postgresql \
  ningzhi-monitor-redis \
  ningzhi-monitor-clickhouse \
  ningzhi-monitor-kafka
```

改动后**不需要改 deploy.yml**——`docker compose up -d` 会自动按依赖链启动 `kafka-init`，无需显式声明。原有的 `sleep 15` 等待时间也足够覆盖 kafka-init 的 2-3 秒执行时间。

---

## 七、与 03 文档手动方案的对比

| 维度          | 手动方案（03 文档）                  | 自动化方案（本文档）            |
| ------------- | ------------------------------------ | ------------------------------- |
| 执行方式      | SSH 进服务器手动 `docker exec`       | docker compose 自动执行         |
| 触发时机      | 部署后人工介入                       | 容器启动时自动                  |
| 幂等性        | `--create`（已存在会报错）           | `--if-not-exists`（已存在跳过） |
| 新机器/新环境 | 需要记得手动执行                     | 自动执行，零人工                |
| 可复现性      | 依赖文档记录                         | 代码即文档，版本可追溯          |
| 启动顺序      | 无保障（CK 可能先于 topic 创建启动） | 有保障（CK 等 init 完成才启动） |
| 适用场景      | 紧急修复已部署的环境                 | 日常开发 + 全新部署 + CI/CD     |

> **最佳实践**：两者结合——已部署的旧环境用手动方案修复一次，新环境/新机器由自动化方案兜底。

---

## 八、面试可说的重难点

### 1. Docker Compose 的 depends_on condition 三种模式

```
service_started：容器进程启动即继续（端口可能还没开）
service_healthy：容器 healthcheck 通过才继续（服务完全就绪）
service_completed_successfully：容器执行完毕且退出码 0 才继续（用于一次性 init 容器）
```

很多人只知道 `service_started`，不了解后两种。能讲出 `service_completed_successfully` 用于 init 容器等待的场景，体现对 Docker Compose 编排能力的深入理解。

### 2. Kafka healthcheck 的设计

不能用简单的 TCP 端口检测（`nc -z localhost 9092`），因为 Kafka 端口开了不等于 broker 已完全初始化。用 `kafka-topics.sh --list` 检测——只有 broker 能正常处理元数据请求才算就绪。

这是"健康检查要检测业务就绪而非网络就绪"的典型案例。

### 3. 幂等性设计（`--if-not-exists`）

自动化脚本必须幂等——重复执行不能报错。`kafka-topics.sh --create --if-not-exists` 保证了 topic 已存在时跳过。这是基础设施即代码（IaC）的基本原则。

### 4. init 容器模式

Kubernetes 里有 `initContainers`，Docker Compose 里用 `service_completed_successfully` 实现等价效果。核心思想：**把"环境前置条件准备"和"主服务启动"解耦**，init 容器负责准备（建 topic、建表、跑迁移），主服务负责运行。

### 5. 同一个坑踩两次的教训

手动修复只解决了当下的问题，没有解决"未来重复出现"的问题。**任何手动修复的步骤，都应该考虑是否能自动化**——如果能在 docker-compose / CI/CD 里固化，就不要依赖人去记。

> 这个点面试可以这么说："线上踩过一次 KIP-848 的坑，手动修复后以为解决了，结果本地开发又踩了一次——因为 Kafka 容器重建数据会丢。这让我意识到手动修复只是'救火'，真正的解决方案是把它写进基础设施配置里，让它在每次启动时自动执行。"

---

## 九、后续优化方向

| 优化项                     | 说明                                                                 | 优先级           |
| -------------------------- | -------------------------------------------------------------------- | ---------------- |
| Kafka 数据持久化           | 取消注释 `volumes: - ./kafka_data:/bitnami/kafka/data`，重启不丢数据 | 中（但会占磁盘） |
| ClickHouse 数据持久化      | 加 `volumes: - ./clickhouse_data:/var/lib/clickhouse`                | 中               |
| kafka-init 创建更多 topics | 如果后续新增业务 topic，在 command 里追加 `--create` 命令            | 按需             |
| healthcheck 优化           | 加 `kafka-topics.sh --list` 的超时处理，避免卡死                     | 低               |
| 监控告警                   | kafka-init 退出码非 0 时触发告警（CI/CD 里加检查）                   | 低               |
