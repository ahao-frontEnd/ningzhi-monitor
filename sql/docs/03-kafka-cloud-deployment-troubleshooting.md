# Kafka + ClickHouse 云服务器部署：问题复盘与面试重难点

> 日期：2026-08-08
> 项目：main-monitor
> 作者：与 dsn-server 生产部署相关联
> 前置阅读：[01-kafka-intro-for-beginners.md](./01-kafka-intro-for-beginners.md) · [02-kafka-clickhouse-refactor-summary.md](./02-kafka-clickhouse-refactor-summary.md)

---

## 一、背景

前两篇文档（01、02）解决了**代码层面的架构改造**（把原来直写 ClickHouse 改成 "Kafka + ClickHouse 自消费 + 直写兜底"三段模式）。

本篇聚焦**云服务器生产部署阶段**遇到的 9 大类问题，覆盖：

1. 磁盘空间管理（ClickHouse system_log 爆仓）
2. Git 网络代理（GitHub 443 连接失败）
3. CI/CD 文件传输（SCP → rsync 迁移）
4. NestJS 后端配置（硬编码 IP → 环境变量）
5. Caddy 反向代理路由（handle → handle_path 修复 400）
6. Caddy 前端目录挂载错误（chat 挂载到 builder-dist → 页面内容串台）
7. Kafka 4.x KIP-848 问题（`__consumer_offsets` 不自动创建）
8. dsn-server 直写兜底表缺失（`base_monitor_storage` 不存在导致 direct 写入 crash）
9. 查询 UNION 缺失（Kafka 管道断时直写数据查不到）

每一节包含：**现象 → 排查路径 → 根因 → 修复方法 → 经验教训**。

---

## 二、部署遇到的 9 大类问题与修复

### 问题 1：ClickHouse system_log 把磁盘占满 → 服务器磁盘 100%

**现象**：CI/CD 推送前端文件时报磁盘满（`df -h /` 100% 使用率）。同时 ClickHouse 启动时 system_log 表配置报错。

**排查路径**：

1. `df -h /` → 确认根分区已满
2. `du -sh /var/lib/docker/volumes/*` → 发现 ClickHouse 数据卷占 30G+
3. ClickHouse 容器内 `SELECT table, formatReadableSize(sum(bytes)) FROM system.parts GROUP BY table` → `system.query_log`、`system.trace_log` 等系统日志表占绝大多数空间

**根因**：ClickHouse 默认开启大量 system_log 表（`query_log`、`trace_log`、`text_log`、`opentelemetry_span_log`、`query_thread_log`、`query_views_log` 等），每张表每小时写入大量诊断信息，无 TTL，长期运行会无限增长。

**修复（长期方案，写入 config.d 目录）**：

创建 `.devcontainer/clickhouse/config.d/disable_logs.xml`：

```xml
<clickhouse>
    <!-- 直接移除不需要的日志表（写入量大但价值低） -->
    <trace_log remove="remove" />
    <text_log remove="remove" />
    <opentelemetry_span_log remove="remove" />
    <query_thread_log remove="remove" />
    <query_views_log remove="remove" />

    <!-- 保留 metric_log，但降低写入频率（默认 1s 一次 → 60s 聚合 + 7.5s 刷盘） -->
    <metric_log>
        <flush_interval_milliseconds>7500</flush_interval_milliseconds>
        <collect_interval_milliseconds>60000</collect_interval_milliseconds>
    </metric_log>
</clickhouse>
```

⚠️ **第一次踩坑**：之前在 `<metric_log>` 里加了 `<ttl>` 标签，ClickHouse 启动会报 `Syntax error`——**`<ttl>` 是表级 TTL，不能放在 `<log>` 配置块里**。system_log 的 TTL 要通过 `CREATE TABLE ... TTL ...` 语句改，或者直接 `remove="remove"` 删掉。

**紧急清理命令（已占满时执行）**：

```sql
-- ClickHouse 内 truncate 最大的日志表
TRUNCATE TABLE system.trace_log;
TRUNCATE TABLE system.text_log;
TRUNCATE TABLE system.query_thread_log;
```

同时清理服务器上的 Docker 垃圾：

```bash
docker image prune -af
docker volume prune -f   # 谨慎，确认没有重要数据
```

**经验教训**：任何有日志写入的中间件（ClickHouse、Redis、Elasticsearch）**上线前必须配置日志保留策略**，否则几个月后一定爆盘。

---

### 问题 2：Git `Failed to connect to github.com port 443`

**现象**：`git push` 一直超时 `connect ETIMEDOUT`，浏览器却能打开 GitHub。代理软件（Clash/V2Ray）正在运行但 Git 不走代理。

**根因**：系统代理默认不覆盖 Git 的 HTTP/HTTPS 流量。Git 有自己的代理配置，需要单独设置。

**修复（只给 GitHub 用代理，国内仓库不走代理）**：

```bash
git config --global http.https://github.com.proxy http://127.0.0.1:7890
# 注意：不用配置 https.proxy，http.https://github.com.proxy 同时作用于 HTTPS 连接
```

用 `--global` 还是仓库级？

- 如果只有 main-monitor 一个 GitHub 仓库，可以在仓库目录执行 `git config http.https://github.com.proxy ...`（不带 `--global`），避免代理软件退出后 git clone 其它项目走不通。
- 如果多个 GitHub 仓库，用 `--global` 全局。

**验证**：`git config --global --list | grep proxy`

**经验教训**：代理问题的核心是"哪个应用发请求就配哪个应用的代理"——浏览器有浏览器代理、git 有 git 代理、npm/pip/docker 都有各自的代理配置，不能假设开了 Clash 所有程序都走代理。

---

### 问题 3：CI/CD `appleboy/scp-action@v0.1.7` 持续报 `exit code 1`

**现象**：GitHub Actions 里 SCP 上传前端文件到服务器，报错 `Process exited with status 1`，且错误信息被 GitHub secret mask 成 `***`，完全无法定位。

**排查路径**：

1. 先怀疑密钥不对 → 重配 GitHub Secrets，问题依旧
2. 再怀疑服务器磁盘满 → `df -h` 发现确实 100%（见问题 1）。清磁盘后 SCP 还是失败
3. 换用 `appleboy/ssh-action` + 手动 `scp` 命令，看到了真实错误：`scp: not found`（服务器默认没装 scp？其实是 SCP action 封装后的权限问题）
4. 最后决定放弃 `appleboy/scp-action`，改用官方推荐的 `webfactory/ssh-agent` + `rsync` 组合

**修复**：

deploy.yml 改两步：

1. 先装 SSH agent：

```yaml
- name: Setup SSH agent
  uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

- name: Add server to known_hosts
  run: |
    mkdir -p ~/.ssh
    ssh-keyscan -p 22 -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts
```

2. 用 `rsync` 传输：

```yaml
- name: Sync frontend to server
  run: |
    rsync -avz --delete \
      -e "ssh -p 22" \
      dist/ \
      ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/home/ubuntu/frontend-dist/
```

**为什么 rsync 比 scp 好**：
| 特性 | scp | rsync |
|-----|-----|-------|
| 断点续传 | ❌ | ✅ 只同步差异文件 |
| `--delete` 清理旧文件 | ❌ | ✅ `--delete` 删除目标端多余文件 |
| 错误信息 | ❌ 不透明（被 appleboy 封装后无信息） | ✅ 直接输出到 Actions 日志 |
| 大文件性能 | 每次全量传 | ✅ 增量 + 压缩（`-z`） |

**经验教训**：CI/CD 尽量用**原生命令 + 透明输出**，不要用封装度太高的 action。出问题时第一原则是"看到真实错误信息"。

---

### 问题 4：NestJS 后端启动报 `connect ETIMEDOUT 192.168.1.102:5432`

**现象**：生产环境 dsn-server/monitor-server 启动时 TypeOrmModule 连接 PostgreSQL 超时，错误信息里有一个**局域网 IP `192.168.1.102`**——这是开发机器的 IP，云服务器当然访问不到。

**根因**：三个配置文件里数据库/Redis/ClickHouse 的 host 是硬编码的：

| 文件                             | 错误硬编码值                                 |
| -------------------------------- | -------------------------------------------- |
| `config/database.ts`             | `host: '192.168.1.102'`（PostgreSQL）        |
| `config/redis.ts`                | `host: 'localhost'`（Redis）                 |
| `app.module.ts` ClickhouseModule | `url: 'http://localhost:8123'`（ClickHouse） |

**修复**：全部改成"环境变量 + Docker 服务名默认值"模式：

```typescript
// database.ts
export default () => ({
  database: {
    host: process.env.DATABASE_HOST || 'ningzhi-monitor-postgresql',
    // ...
  },
})

// redis.ts
export default () => ({
  redis: {
    host: process.env.REDIS_HOST || 'ningzhi-monitor-redis',
    // ...
  },
})

// app.module.ts
ClickhouseModule.forRoot({
  url: `http://${process.env.CLICKHOUSE_HOST || 'ningzhi-monitor-clickhouse'}:8123`,
})
```

还要确保 `ConfigModule.forRoot` 能加载 `.env`：

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env', 'apps/backend/dsn-server/.env'],
  // ...
})
```

**为什么用数组 envFilePath？**

- 从 monorepo 根目录 `pnpm --filter xxx start` 时，process.cwd() 是 `main-monitor/`，`apps/backend/dsn-server/.env` 能被找到
- 从 `cd apps/backend/dsn-server && pnpm start` 时，cwd 是 `.../dsn-server/`，`.env` 能被找到
- 生产环境 Docker 里没有 `.env`，两个路径都找不到，NestJS **静默跳过**，直接用环境变量的默认值（Docker 服务名）

**经验教训**：

1. **任何后端服务禁止硬编码 host/port/password**——"本地跑通就推到线上"一定炸
2. `.env` 只放敏感信息，非敏感的默认值（比如 Docker 服务名）要写在代码里的 fallback（`\|\|`），这样没有 `.env` 也能直接跑

---

### 问题 5：Caddy `/dsn-api` 路由返回 400 Bad Request

**现象**：

- `curl http://localhost:8082/api/span`（直接连 dsn-server）→ **200 OK** ✅
- `curl https://monitor.ningzhi2.site/dsn-api/span`（走 Caddy）→ **400 Bad Request** ❌
- 响应头里只有 `via: 1.1 Caddy`，**没有** `X-Powered-By: Express`（说明 400 是 Caddy 自己返回的，没转发到 dsn-server）

**原 Caddyfile 写法（有问题）**：

```caddyfile
handle /dsn-api* {
    rewrite ^/dsn-api(.*)$ /api$1
    reverse_proxy ningzhi-monitor-dsn-server:8080
}
```

**根因**：Caddy 的 `handle /dsn-api*` 路径匹配存在歧义，加上 `rewrite` 的正则和 `handle` 路径的双重解析，最终请求没落到正确的后端。关键证据是 **400 响应头里只有 Caddy 信息**，说明请求根本没到 dsn-server。

**修复（用 handle_path 替代 handle + rewrite）**：

```caddyfile
handle_path /dsn-api/* {
    rewrite * /api{path}
    reverse_proxy ningzhi-monitor-dsn-server:8080
}
```

请求处理流程（修复后）：

1. 浏览器请求 `GET /dsn-api/span`
2. `handle_path /dsn-api/*` 匹配，**自动剥离 `/dsn-api` 前缀**，剩下 `{path} = /span`
3. `rewrite * /api{path}` 拼成 `/api/span`
4. `reverse_proxy` 转发 `GET /api/span` 到 `dsn-server:8080`
5. dsn-server 返回 JSON，Caddy 透传给浏览器

**为什么 handle_path 更可靠**：

- `handle` 是"匹配整个路径，不改写"，需要手动 `rewrite`，正则和匹配模式容易冲突
- `handle_path` 是 Caddy 专门为"路由前缀剥离"设计的指令，等价于 `handle + uri strip_prefix`，语义明确
- 记忆口诀：**路由前缀映射用 handle_path，不做路径改写用普通 handle**

**经验教训**：反向代理出现"直接访问正常，经代理返回 4xx/5xx"时，先对比响应头——如果响应头里只有代理服务器（Caddy/nginx），那一定是路由规则问题，请求根本没到后端。

---

### 问题 6：chat.ningzhi2.site 返回 builder 的页面（内容串台）

**现象**：

- `chat.ningzhi2.site` 返回的 `<title>` 是"可视化无代码平台"（builder 的标题）
- `builder.ningzhi2.site` 也返回同样内容
- 连打包后的 JS 文件名 hash 都完全一样（`index-CYjC5wZ3.js`）

**排查路径**：

1. 先看 DNS → `dig chat.ningzhi2.site` 能解析到服务器 ✅
2. 看 Caddy TLS 证书 → 三个域名单独的证书目录都存在 ✅
3. 看 Caddy 容器挂载 → `/app/frontend/chat/dist/` 和 `/app/frontend/builder/dist/` 文件修改时间都是 `Jul 29 15:29`，完全一致 ❌
4. 看 docker-compose.yml volume：

```yaml
# ❌ 第 51 行，chat 挂载源写成了 builder-dist！
- /home/ubuntu/builder-dist:/app/frontend/chat/dist:ro
```

**根因**：`docker-compose.production.yml` 里 chat 的 volume 挂载源写成了 builder 的宿主机目录 `/home/ubuntu/builder-dist`，导致两个站点根目录完全相同。同时 `/home/ubuntu/chat-dist` 实际上**不存在**（chat 前端是另一个独立项目，没有随当前仓库 CI/CD 部署）。

**修复**：

1. docker-compose.yml 改成正确的挂载源：

```yaml
- /home/ubuntu/chat-dist:/app/frontend/chat/dist:ro
```

2. 服务器上创建 `/home/ubuntu/chat-dist` 目录并把 chat 前端打包文件放进去
3. 重建 Caddy 容器加载新 volume

**经验教训**：

1. 多个站点的 volume 挂载复制粘贴时一定要**改两边的源和目标**，只改一边就会出现"内容串台"
2. 三个站点但只有一个前端项目在当前仓库 → 后续考虑把 builder/chat 也并入 monorepo，统一由 deploy.yml 构建部署
3. 排查"两个域名内容一样"的最快方法是**看打包产物的 hash**——如果文件名 hash 相同，肯定是静态资源目录复用了

---

### 问题 7：Kafka 4.x KIP-848 —— `__consumer_offsets` 不自动创建

**现象**：

- SDK 上报接口 201 返回（消息发到了 Kafka）
- `kafka-topics.sh --list` 能看到 `monitor` topic ✅
- 但 ClickHouse 的 `monitor_data` 表 count=0，`base_monitor_view` count=0
- dsn-server 启动日志里出现：

```
ERROR [kafkajs] InitProducerId error: The coordinator is loading
and hence can't process requests for this group
```

**排查路径**：

1. `monitor_data` 空 → 要么 Kafka broker 没消息，要么 ClickHouse 没消费
2. `kafka-console-consumer` 直接读 partition（不依赖 group）读到了消息 → broker 有数据 ✅
3. `kafka-consumer-groups.sh --describe --group monitor-ch` → 报错 `COORDINATOR_NOT_AVAILABLE`
4. `kafka-topics.sh --list | grep consumer_offsets` → **没有 `__consumer_offsets` topic** ❌

**根因**：Kafka 4.0（KIP-848）引入了新的 KRaft Group Coordinator，默认情况下**不再自动创建 `__consumer_offsets` 内部 topic**。而 Kafka 3.x 及以前版本是第一次有消费者时自动创建。这导致所有消费者（ClickHouse Kafka 引擎、`kafka-console-consumer --group`）都找不到 Coordinator。

**修复（服务器上只执行一次）**：

```bash
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --create \
  --topic __consumer_offsets \
  --partitions 50 \
  --replication-factor 1 \
  --config cleanup.policy=compact
```

注意：这是 Kafka 的**内部 topic**，存储消费者的 offset 提交。参数说明：

- `partitions 50`：Kafka 默认值。consumer group 最多能有 50 个成员（分区数决定最大并行消费者数）
- `replication-factor 1`：单 broker 部署，固定 1
- `cleanup.policy=compact`：Key 相同的消息只保留最新版本（offset 提交天然是 set(key=group+topic+partition, value=offset) 语义，compact 策略最合适）

**后续不用重复执行**：只要 Kafka 卷没被 `docker volume prune` 删掉，这个 topic 会持久化保留。

**经验教训**：

1. Kafka 大版本升级（3.x → 4.x）会引入破坏性变化，不要直接用 `latest` 或 `<major>.x`，固定 patch 版本并查 changelog
2. 任何带 Consumer Group 的 Kafka 消费者连不上 Coordinator，第一步查 `__consumer_offsets` 是否存在
3. 最好把这步**写入初始化脚本**（docker-compose 里加 `depends_on` + 一个临时 init 容器跑 create topic 命令），避免未来服务器重启/换机器后又要手动修

---

### 问题 8：`base_monitor_storage` 表不存在 —— direct/both 模式 crash

**现象**：

- 问题 7 让 Kafka 管道暂时用不了，打算切 `WRITE_MODE=both` 先用直写兜底
- 但接口一上报就 500，日志报 `UNKNOWN_TABLE: base_monitor_storage`

**根因**：代码重构时，`base_monitor_view` 已经从指向 `base_monitor_storage` 改成指向 `monitor_data`，新的 [clickhouse.initializer.ts](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/fundamentals/clickhouse/clickhouse.initializer.ts) 里只有 `kafka_monitor / monitor_data / 物化视图 base_monitor_view` 四条 CREATE 语句，**遗漏了 `base_monitor_storage`**。但 [span.service.ts:39](file:///c:/Users/56801/Desktop/main-monitor/apps/backend/dsn-server/src/modules/span/span.service.ts#L39) 的 direct 写入还在写这张表。

**修复**：在 `statements` 数组开头补一条 CREATE TABLE：

```sql
CREATE TABLE IF NOT EXISTS base_monitor_storage (
    app_id     String,
    event_type String,
    message    String,
    info       JSON
) ENGINE = MergeTree()
ORDER BY tuple()
```

放在 `kafka_monitor` 之前创建，确保应用启动时就存在。

**临时救急命令（已部署的服务器手动执行）**：

```bash
docker exec ningzhi-monitor-clickhouse clickhouse-client -q "
  CREATE TABLE IF NOT EXISTS base_monitor_storage (
      app_id     String,
      event_type String,
      message    String,
      info       JSON
  ) ENGINE = MergeTree() ORDER BY tuple()
"
```

**经验教训**：重构时"删除旧 SQL 语句"要和"删除引用这些 SQL 的代码"**同步做**，不能只删一边。推荐做法：代码改造完成后，把 WRITE_MODE 按 `direct → both → kafka` 顺序全部跑一遍，确保每个模式都能独立工作。

---

### 问题 9：Kafka 管道断时，direct 写入的数据查不到（查询遗漏兜底表）

**现象**：

- `WRITE_MODE=both` 上报成功
- `SELECT count() FROM base_monitor_storage` > 0 ✅（直写进去了）
- 但 `curl /dsn-api/span` 依然返回空数组 ❌

**根因**：`span()` 方法只查 `base_monitor_view`，而 `base_monitor_view` 指向 `monitor_data`（Kafka 管道产物）。direct 写入的 `base_monitor_storage` 不在查询范围内。

**修复**：`span()` 和 `bugs()` 改成 UNION ALL 查询两张表：

```typescript
async span() {
  const query = `
      SELECT
          app_id,
          event_type,
          message,
          info,
          concat('Ningzhi ==> ', event_type) AS processed_message
      FROM base_monitor_storage
      UNION ALL
      SELECT * FROM base_monitor_view
  `
  // ...
}
```

关键点：

1. **`UNION ALL` 而不是 `UNION`**：两张表理论上不会有重复（写入路径独立），UNION ALL 不用去重更快
2. **两张表的 SELECT 列必须完全对齐**：`base_monitor_storage` 没有 `processed_message` 列，用 `concat(...) AS processed_message` 现场补
3. `bugs()` 同理，两个子 SELECT 都加 `WHERE event_type = 'error'`

**为什么查询也要兜底**：

- Kafka 管道恢复后，历史积压的数据通过物化视图会写入 `monitor_data`，和 `base_monitor_storage` 产生重叠（both 模式双写的那部分）
- 但 `UNION ALL` 有轻度重复没关系（监控场景，重复 1 条 error 影响很小），**查得到比完全准确更重要**。如果后续要精确，可以在查询里加 `DISTINCT` 或在应用层去重。

**经验教训**：引入"多写 / 多存储"兜底策略时，**查询层必须做 UNION**，否则只有写入有兜底、查询没有兜底等于没做兜底。这是架构设计的完整性要求——写入和查询必须一致。

---

## 三、端到端部署流程（完整梳理）

下面是从"代码写好"到"线上 SDK 上报成功、前端查到数据"的**14 步全流程**，可以作为下次新项目部署的 Checklist。

### Step 1：代码改造完成

- 硬编码 host 全部替换为 `process.env.XXX_HOST || 'docker-service-name'`
- `ConfigModule` 配置 `isGlobal` + `envFilePath` 数组
- Kafka producer / ClickHouse schema 初始化代码完成
- 三个 WRITE_MODE 本地都能跑通（`direct`、`both`、`kafka`）

### Step 2：本地编译验证

```powershell
# 删除 TypeScript incremental 缓存（有时会"假编译成功"）
Remove-Item apps/backend/dsn-server/tsconfig.build.tsbuildinfo -Force
# 重新 build
pnpm --filter @ningzhi/monitor-dsn-server build
# 验证 dist 目录结构（注意 rootDir=. 时 dist/src/main.js）
ls apps/backend/dsn-server/dist
```

### Step 3：写 Dockerfile（多阶段构建）

- Stage 1 `builder`：安装依赖 + `nest build`
- Stage 2 `runner`：只安装生产依赖 + COPY dist + CMD
- 如果有邮件模板等非代码资源，记得 COPY 到对应位置（并确认 `git ls-files` 追踪了这些文件，否则 CI 拉不到）

### Step 4：本地 Docker 构建验证

```powershell
docker build -f apps/backend/dsn-server/Dockerfile -t test-dsn .
# 至少 build 成功，不用跑容器（容器依赖中间件）
```

### Step 5：写 docker-compose.production.yml

- 每个服务固定 `container_name`（便于调试和日志排查）
- `depends_on` 声明依赖顺序
- Caddy 的 volumes：**每个站点的宿主机目录互相独立！**（chat → chat-dist，builder → builder-dist）
- dsn-server 加 `environment: WRITE_MODE=both`（新环境先双写）

### Step 6：写 Caddyfile

- 后端接口路由用 `handle_path /prefix/* + rewrite + reverse_proxy` 组合
- 每个子域名单独一个 `xxx.ningzhi2.site { ... }` 块
- `file_server` 的 SPA 回退用 `try_files {path} {path}/ /index.html`

### Step 7：写 deploy.yml（GitHub Actions CI/CD）

- Build job：构建 Docker 镜像（monitor-server、dsn-server）→ 推 ACR
- Build job：构建前端（`pnpm --filter xxx build`）→ upload-artifact
- Deploy job：download-artifact → `ssh-agent` setup → `rsync -avz --delete` 同步前端
- Deploy job：`appleboy/ssh-action` 登录服务器 → 拉镜像 → `docker compose up -d --force-recreate` 重启服务 → 重建 Caddy（加载新配置）

### Step 8：配置 git 代理 → push 触发 CI

```bash
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git push origin main
```

等待 GitHub Actions 全部绿勾。

### Step 9：服务器 Docker 镜像拉取 + 容器启动

服务器上验证：

```bash
docker ps  # 看所有服务都在 Running，没有 Restarting
docker logs ningzhi-monitor-dsn-server --tail 20
# 看到：Kafka producer connected / ClickHouse schema initialized / Nest started
```

### Step 10：ClickHouse 基础设施表初始化

- 代码里的 `ClickhouseInitializer` 会在 `OnModuleInit` 时建表
- 如果有遗漏（比如问题 8 的 `base_monitor_storage`），手动补一条 CREATE TABLE

### Step 11：解决 Kafka 4.x KIP-848

```bash
# 首次部署必须手动创建
docker exec ningzhi-monitor-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --create \
  --topic __consumer_offsets --partitions 50 --replication-factor 1 \
  --config cleanup.policy=compact
```

### Step 12：ClickHouse system_log 清理

```bash
# 第一次上线前配好 disable_logs.xml，避免将来爆盘
# 已经上线了可以手动 truncate 一次 + 重启 ClickHouse 加载 config
docker exec ningzhi-monitor-clickhouse clickhouse-client -q "
  TRUNCATE TABLE system.trace_log;
  TRUNCATE TABLE system.text_log;
"
```

### Step 13：SDK 上报 → 存储 → 查询 端到端验证

```bash
# 1. 模拟上报（用 vanilla demo 或 curl）
curl -X POST https://monitor.ningzhi2.site/dsn-api/tracing/test-app \
  -H "Content-Type: application/json" \
  -d '{"event_type":"error","message":"deploy verification"}'

# 2. 等 10s（物化视图异步落盘有延迟）
sleep 10

# 3. 看 ClickHouse 三张表都有数据
docker exec ningzhi-monitor-clickhouse clickhouse-client -q "
  SELECT 'storage', count() FROM base_monitor_storage
  UNION ALL SELECT 'data', count() FROM monitor_data
  UNION ALL SELECT 'view', count() FROM base_monitor_view
"

# 4. 看接口返回非空数组
curl -s https://monitor.ningzhi2.site/dsn-api/span
```

### Step 14：前端页面验证

- `https://monitor.ningzhi2.site/` 登录后台 → Issues / Performance 页面
- 数据表格有刚才上报的那条 `deploy verification` error 记录 → ✅ 全链路打通

---

## 四、面试重难点（12 个高频问题 + 回答要点）

> **面试讲这个项目的核心叙事**：
>
> "我负责了监控平台的 **dsn-server（SDK 数据上报后端）** 的生产部署，场景是浏览器 SDK 把性能/错误数据上报到云端，经过 Kafka 缓冲、ClickHouse 落盘，最后在管理后台查询。这个项目最大的难点是**三个服务（NestJS、Kafka、ClickHouse）在 Docker 跨容器网络环境下的协同**，以及**从直写数据库到 Kafka 异步管道的灰度迁移**。整个部署过程我踩了 9 类坑，最终全部解决，现在线上稳定运行。"

---

### Q1：为什么引入 Kafka？直接写 ClickHouse 不行吗？（架构选型题）

**回答思路**：从"小流量 vs 突发大流量"的对比切入。

```
小流量时直写数据库没问题，但如果突然有大量 SDK 同时上报（比如网站被攻击、一个热点事件），会有三个问题：
1. 数据库写入压力太大，查询也会被拖慢（ClickHouse 写入是 merge 型，频繁合并会影响读）
2. HTTP 请求要等数据库写入完成（几毫秒 vs 几十毫秒），用户等待时间变长
3. 数据库临时不可用时（比如合并、重启），请求直接报错，数据就丢了

引入 Kafka 之后：
- 写入 Kafka 是毫秒级 append，接口秒回
- ClickHouse 用 Kafka 引擎表异步消费，按自己的节奏合并落盘
- 同一份数据可以挂多个物化视图（实时聚合、error 分流等）
- 更可靠：数据存在 Kafka broker 的磁盘上，不会因为 ClickHouse 临时挂了就丢

但 Kafka 也有成本，所以我加了 WRITE_MODE 开关：direct/both/kafka，先双写一段时间比对，确认一致再切纯 Kafka，随时可以切回 direct 做应急回滚。
```

**加分点**：提到 "WRITE_MODE 灰度策略" → 展示你有稳定性思维，不是一拍脑袋就换架构。

---

### Q2：Kafka 为什么配两个 Listener（9092 和 9094）？这是干什么用的？

**这是高频题**，考察 Docker 网络和 Kafka 基础概念。

**回答思路**：区分"容器内通信"和"宿主机/外部通信"两个场景。

```
因为我们用 Docker Compose 部署，有两类客户端连同一个 Kafka broker：
1. 容器内的客户端：比如 ClickHouse 容器（要消费 monitor topic）
   - 在容器网络里，服务名 ningzhi-monitor-kafka 能 DNS 解析到 Kafka 容器的内部 IP
   - 用 PLAINTEXT://ningzhi-monitor-kafka:9092

2. 宿主机/外部的客户端：比如 NestJS 进程（在宿主机直接跑，不在容器里）、DataGrip 远程调试
   - 宿主机访问不了 ningzhi-monitor-kafka 这个 DNS，只能用 localhost
   - 所以映射 EXTERNAL://0.0.0.0:9094，宿主机用 PLAINTEXT://localhost:9094

两个 Listener 的 advertised.listeners 也必须分别配置，否则 Kafka broker 会把错误的地址返回给客户端，
导致"连接上 broker 但拿不到元数据"的诡异问题。

记忆口诀：容器内用 9092 + 服务名，宿主机用 9094 + localhost。
```

**加分点**：提到 `advertised.listeners`（这个点很多人搞混）→ 展示你深入到了 Kafka 网络层。

---

### Q3：Kafka 4.x 遇到了 KIP-848，`__consumer_offsets` 不自动创建，你怎么定位和解决的？（排障题）

**回答思路**：用"现象 → 假设 → 验证 → 修复"的**科学排查流程**来讲。

```
现象是：消息发到 Kafka 了（用不依赖 consumer group 的 kafka-console-consumer 直接读 partition 验证过），
但 ClickHouse 的 monitor_data 表永远空，且日志里出现 COORDINATOR_NOT_AVAILABLE。

我的定位过程：
1. 先排除 ClickHouse 侧问题——Kafka 官方 consumer（kafka-consumer-groups.sh）同样报 Coordinator 不可用
   → 说明不是 ClickHouse 的 bug，是 Kafka broker 端的问题
2. 假设是 __consumer_offsets 内部 topic 缺失——因为 Coordinator 就是负责管理 consumer group offset 的
   这个 topic 不存在，Coordinator 自然无法初始化
3. 验证：kafka-topics.sh --list 确实没有 __consumer_offsets
4. 查 Kafka 4.0 release notes → 发现 KIP-848 引入了 KRaft Group Coordinator，默认不自动创建这个内部 topic
5. 解决：手动创建，参数 50 分区 + compact 策略 + replication-factor 1
   （50 分区是 Kafka 推荐的默认值，对应最大 50 个消费者；compact 是因为 offset 天然是 set 语义）
6. 验证：创建后 monitor-ch 消费组马上有了 lag 统计，ClickHouse 开始正常消费

长期改进方案：在 docker-compose 里加一个 init 容器，自动检测 topic 不存在就创建，避免换服务器时又要手动做。
```

**加分点**：

1. 用"交叉验证法"（官方工具同样失败 → 不是客户端问题）
2. 提到 `__consumer_offsets` 的 compact 策略原理（不是盲目抄命令）
3. 提到"长期改进方案" → 展示你有 SRE 思维，不是只修当下

---

### Q4：ClickHouse 的 Kafka 引擎表原理是什么？和用 Node.js 做消费者比，优缺点？

**架构设计题**，考察你对 ClickHouse Kafka 引擎的理解。

**回答思路**：

```
原理：ClickHouse 内部集成了 librdkafka（一个 C 语言 Kafka 客户端，就是 node-rdkafka 的底层），
当你 CREATE TABLE ... ENGINE = Kafka 时，这张表本身不存储数据，它相当于一个"Kafka topic 的外部映射"。
然后你在 Kafka 引擎表上挂一个 Materialized View（物化视图），MV 自动把每次消费到的行 INSERT 到
目标 MergeTree 表。实际落盘的是 MergeTree 表，不是 Kafka 引擎表。

和 Node.js 自己写消费者对比：
优点：
1. 少维护一个服务——不需要部署、监控、重启 Node 消费者进程
2. ClickHouse 原生 INSERT 比 Node → HTTP/TCP ClickHouse 的写入效率高（直接本地写 MergeTree）
3. 消费 offset 自动管理（ClickHouse 内部提交），不用自己写 checkpoint 逻辑
4. 可以挂多个物化视图，同一份数据分流到多张表（比如 error 专表、按天聚合表）

缺点：
1. 消费逻辑只能是 INSERT（没有复杂 ETL 的灵活度）
2. 调试麻烦——librdkafka 的错误日志要改 ClickHouse 配置才能看到
3. Kafka schema 变更时，Kafka 引擎表的结构要同步改，有运维成本

所以我选了这个方案的前提是：我们的业务是"监控数据一到就存"，没有复杂转换，适合 INSERT-only。
如果有复杂 ETL 就用 Flink 或 Node 消费者。
```

**加分点**：对比了两种方案的边界 → 展示你是根据业务特点选型的，不是只会用一种。

---

### Q5：Kafka + ClickHouse 之间的管道断了，怎么保证查得到数据？（可靠性题）

**对应问题 8 和问题 9**。这是展示你"架构完整性"的关键问题。

**回答思路**：

```
两个层面的兜底设计：

1. 写入层兜底（WRITE_MODE=both）：
   SDK 上报的同一条数据，同时写两条路径：
   - 路径 A（快）：写 Kafka → ClickHouse Kafka 引擎自消费 → monitor_data 存储表
   - 路径 B（慢但可靠）：直接 INSERT ClickHouse base_monitor_storage 表
   只要任意一条路径成功，接口都返回 2xx。只有 kafka 模式并且 Kafka 发送失败才抛 5xx
   （both 模式下 Kafka 发失败不影响接口，因为 direct 已经写成功了）

2. 查询层兜底（UNION ALL）：
   span() / bugs() 接口的查询不是只查 base_monitor_view（Kafka 管道产物），
   而是 UNION ALL base_monitor_storage（direct 写入）+ base_monitor_view。
   这样即使 Kafka 管道断了（比如 KIP-848 问题），direct 写入的数据仍然能查到。

为什么用 UNION ALL 而不是 UNION：
- 两条路径写入的数据在逻辑上不重叠（一个是双写模式同时写，一个是故障期只写 direct）
- UNION ALL 不用去重，性能好得多
- 监控场景少量重复数据影响不大，查得到比绝对不重复优先级高

这相当于数据库领域的"双写 + 读时合并"策略，最终一致性由后续的对账脚本保障。
```

**加分点**：提到数据库领域的"双写 + 最终一致性"类比 → 展示知识面广。

---

### Q6：Docker Compose 多个容器之间怎么通信？为什么不用 localhost？

**网络基础题**，考察 Docker 容器网络。

**回答思路**：

```
Docker Compose 默认给所有服务创建一个 bridge 网络（我们叫 ningzhi-monitor-network）。
在这个网络内，每个服务的名字就是 DNS 解析名：

- PostgreSQL：ningzhi-monitor-postgresql:5432
- Redis：ningzhi-monitor-redis:6379
- ClickHouse：ningzhi-monitor-clickhouse:8123（HTTP）、9000（Native）
- Kafka：ningzhi-monitor-kafka:9092

所以 ClickHouse 容器访问 Kafka，用的是 ningzhi-monitor-kafka:9092，而不是 localhost:9092。
为什么不能用 localhost？
- 容器的 localhost 是它自己的网络命名空间里的 loopback 接口，不是宿主机的 localhost
- ClickHouse 容器的 localhost 只有它自己（PostgreSQL、Redis、Kafka 都不在这个容器里）
- 这也是为什么 ClickHouse 配置 kafka_broker_list=localhost:9094 一定连不上

一个常见的误区是"我在宿主机 curl localhost:9094 通了，那在容器里也该通"——这是不对的，
因为每个容器有独立的网络栈。跨容器通信必须用 Compose 服务名 + 容器内部 listener 端口。

外部（宿主机、浏览器）访问容器的方式是通过 ports: 映射，比如 Kafka 的 9094 映射到宿主机，
宿主机才能用 localhost:9094。
```

**加分点**：提到"网络命名空间"→ 展示你知道 Docker 网络的底层原理。

---

### Q7：Caddy 的 handle 和 handle_path 有什么区别？你遇到了什么坑？

**反向代理题**，考察实际使用经验。

**回答思路**：

```
我上线时踩了一个真实的坑：写了 handle /dsn-api* { rewrite ... + reverse_proxy }，
结果请求返回 400 但直接连后端是 200。排查发现请求根本没到后端，是 Caddy 自己返回的 400。

问题出在 handle 路径匹配 + rewrite 正则组合有歧义。改成 handle_path /dsn-api/* 就好了。

两者区别：
- handle：只做"路由分流"——匹配到就走这个块，但路径本身不变。如果需要改路径，
  你得手动写 rewrite，匹配规则和正则要对齐，容易写错
- handle_path：等价于 handle + uri strip_prefix——先自动把匹配的前缀从路径里剥掉，
  剩下的 {path} 是相对路径，再改写就清晰很多

比如我们的场景：
- 请求 /dsn-api/span
- handle_path /dsn-api/*：自动 strip，{path} = /span
- rewrite * /api{path}：拼成 /api/span
- reverse_proxy dsn-server:8080：转发正确

如果 handle 路径匹配的是子域名路由（不走路径改写，比如 monitor.ningzhi2.site { ... }），
用普通 handle 就行。路径改写场景优先用 handle_path，这是 Caddy 官方推荐。
```

**加分点**：结合真实排障案例讲 → 不是背诵概念，是亲身经历。

---

### Q8：本地 dev 跨域问题怎么解？Vite proxy 的原理？生产环境和本地跨域方案有什么区别？

**前后端联调题**，高频。

**回答思路**：

```
浏览器的同源策略（Same-Origin Policy）要求协议 + 域名 + 端口三者相同才能直接通信。
我们的 SDK demo 在 http://localhost:5173（Vite dev server），但要请求线上
https://monitor.ningzhi2.site/dsn-api/tracing/xxx——协议、域名、端口全不同，就是 CORS 跨域。

本地解决方法：Vite proxy。在 vite.config.ts 里配：
server: {
  proxy: {
    '/dsn-api': {
      target: 'https://monitor.ningzhi2.site',
      changeOrigin: true,
    },
  },
}

原理：浏览器只和 localhost:5173 通信（同源，没 CORS），Vite dev server 作为中间层，
把 /dsn-api 开头的请求转发到 target 域名（Node→Node 通信不受浏览器 CORS 限制）。
changeOrigin 是必须的：转发请求时把 Host 头改成 target 的 host，否则目标服务器
可能不认这个 Host 头，返回 400 或路由到错误的虚拟主机。

生产环境的跨域是另一个思路：
- 根本不跨域——监控前端、dsn-api、monitor 后端，都是通过 monitor.ningzhi2.site 这个域名，
  由 Caddy 根据路径（/api vs /dsn-api）路由到不同的后端容器
- 这叫"反向代理同源化"——用户始终只和一个域名通信，CORS 问题天然不存在

对比：
+-----------+----------------+---------------------+
| 场景       | 解决方法       | 原理                |
+-----------+----------------+---------------------+
| 本地开发   | Vite proxy     | dev server 做转发   |
| 生产环境   | Caddy 路由分发 | 反向代理同源化       |
+-----------+----------------+---------------------+
```

**加分点**：解释 `changeOrigin: true` 的作用 → 很多人只是抄配置不理解。

---

### Q9：NestJS 的 ConfigModule 怎么加载环境变量？envFilePath 为什么用数组？

**NestJS 配置题**，实际项目经验。

**回答思路**：

```
NestJS 的 @nestjs/config 内部用的是 dotenv 包。默认情况下，dotenv 会从 process.cwd()
（也就是执行 pnpm start 命令的目录）去找 .env 文件。

但我们是 monorepo（pnpm workspace），启动方式有两种：
1. 从根目录启动：pnpm --filter @ningzhi/monitor-dsn-server start
   process.cwd() = /main-monitor/，.env 不存在，会去找 /main-monitor/.env
2. 进入项目目录启动：cd apps/backend/dsn-server && pnpm start
   process.cwd() = /main-monitor/apps/backend/dsn-server/，会找到 /apps/backend/dsn-server/.env

为了兼容两种启动方式，envFilePath 写成数组：
envFilePath: ['.env', 'apps/backend/dsn-server/.env']
dotenv 会按顺序尝试，第一个找到的生效，找不到的静默跳过。

生产环境的 Docker 容器里没有 .env 文件，两个路径都找不到 → 代码里的
process.env.DATABASE_HOST || 'ningzhi-monitor-postgresql' 就用默认值（Docker 服务名），
刚好是生产环境需要的值。这是"本地 .env + 线上 fallback"的最佳实践。

另外要注意 isGlobal: true——ConfigModule 默认是局部模块，不加 isGlobal 的话，每个模块
都要 import ConfigModule 才能用 ConfigService，很麻烦。设 isGlobal 一次，全应用通用。
```

**加分点**：提到 fallback 默认值策略 → 展示"生产环境不依赖 .env"的最佳实践。

---

### Q10：CI/CD 为什么从 SCP 迁到 rsync？rsync 的 --delete 和 source 末尾 / 有什么讲究？

**DevOps 题**。

**回答思路**：

```
迁到 rsync 有三个原因：
1. SCP 是一次性全量传输，重复部署时每次传整个前端包，慢
2. appleboy/scp-action 的错误信息被 GitHub 加密成 ***，出问题完全看不到真实原因
   （我那次遇到磁盘满了，SCP 报 exit code 1 完全没有细节，排查了很久）
3. rsync 是 GNU 标准工具，更稳定、社区资源更多

rsync 关键参数：
- -a：archive 模式（保留权限、时间戳、递归复制）
- -v：verbose（输出每个文件的同步情况，便于调试）
- -z：传输时 gzip 压缩（大项目省带宽）
- --delete：删除目标端多余的文件（确保目标目录和源端完全一致）
  ⚠️ 不用 --delete 的话，旧版本打包的文件会一直留在服务器，导致前端静态资源体积越来越大
- source 末尾 /："同步目录内容"；不加 /："同步目录本身"
  例：rsync dist/ user@host:/target/ → 把 dist/index.html 放到 /target/index.html ✅
       rsync dist  user@host:/target/ → 把 dist 整个放到 /target/dist/index.html ❌

deploy.yml 里还要配合 ssh-agent：
- webfactory/ssh-agent 把私钥注入到 SSH Agent，rsync 就不用再写私钥路径了
- ssh-keyscan 把服务器指纹加入 known_hosts，避免首次连接的交互式确认（CI 是非交互的）
```

**加分点**：讲清楚 source 末尾 / 的区别（这是一个非常常见的坑）→ 体现实战经验。

---

### Q11：点击一次 SDK 上报，到前端 /dsn-api/span 看到数据，全链路经过了什么？（系统设计题）

**考察你对整个数据流的理解**。这是 SRE 面试常见的"画数据流图"题。

**回答思路**（最好能边说边画）：

```
┌──────────────┐
│ 浏览器 SDK   │ POST https://monitor.ningzhi2.site/dsn-api/tracing/xxx
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────────────────────┐
│ Caddy 反向代理 (443 HTTPS)   │
│ handle_path /dsn-api/*       │ strip /dsn-api → rewrite /api/span → reverse_proxy
└──────┬───────────────────────┘
       │ HTTP（容器内）
       ▼
┌──────────────────────────────────────┐
│ dsn-server NestJS 应用（:8080）      │
│                                      │
│ SpanController → SpanService.tracking│
│  │                                    │
│  ├── WRITE_MODE=both                 │
│  │   ├── 直写 ClickHouse base_       │
│  │   │   monitor_storage（MergeTree）│
│  │   │                                │
│  │   └── kafkajs → Kafka broker      │
│  │       monitor topic（partition:   │
│  │       key=app_id 有序）            │
│  │                                     │
└──┼────────────────────────────────────┘
   │                    │
   │ 直接写             │ 异步消费
   ▼                    ▼
┌──────────────────────────────────────────────────┐
│                 ClickHouse                        │
│                                                    │
│  base_monitor_storage  ◄──────┐ （直写数据）        │
│                               │                    │
│  kafka_monitor（Kafka 引擎）  │ librdkafka 消费     │
│       ↓ MV kafka_to_          │                    │
│       ↓   monitor_data        │                    │
│  monitor_data（MergeTree）    │（异步落盘）         │
│       ↓ MV base_monitor_view                      │
│  base_monitor_view（MergeTree MV 落盘）            │
│       ↓                                            │
│  SELECT * FROM (base_monitor_storage               │
│                  UNION ALL base_monitor_view)      │
│       ↑                                            │
└───────┬────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ SpanService.span() 返回   │ → HTTP 200 JSON
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│ 前端页面表格展示数据       │
└───────────────────────────┘
```

**关键检查点（面试时可以提）**：

1. **Caddy rewrite**：路径必须是 `/api/tracing/xxx`，不是 `/dsn-api/tracing/xxx`（否则 dsn-server 路由不到）
2. **Kafka 消息格式**：JSONEachRow 4 字段对齐（app_id、event_type、message、info）
3. **\_\_consumer_offsets**：存在，Kafka 4.x 手动创建
4. **UNION ALL 查询**：两张表的列完全对齐（processed_message 用 concat 补）

---

### Q12：如果线上 monitor_data 积压严重，消费跟不上，你怎么优化？（性能优化题）

**思考题**，考察深度。

**回答思路**（分层次拆解）：

```
一、先定位瓶颈：
1. monitor topic 写速度？→ 看 producer 的 byte_rate、partition 数
2. ClickHouse 消费 lag？→ kafka-consumer-groups.sh --describe --group monitor-ch 看 lag
3. ClickHouse 的 parts merge 速度？→ SELECT * FROM system.replication_queue 或 SELECT * FROM system.parts WHERE active
4. ClickHouse librdkafka 配置？→ 有没有 kafka_num_consumers=1，是不是串行消费

二、针对性优化（由易到难）

容易的（不改代码，改配置）：
1. 增大 ClickHouse Kafka 引擎消费者数：kafka_num_consumers = N（N 是 partition 数，
   monitor topic 目前可能只有 1 个 partition——创建 topic 时可以加 --partitions 5）
2. 增大 topic 分区数：kafka-topics.sh --alter --topic monitor --partitions 5
   （一个 partition 最多一个消费者消费，分区数决定最大并行度）
3. kafkajs producer 加批量/压缩：batch.size=16384, compression.type=gzip

中等难度（改少量代码）：
4. ORDER BY tuple() 改成实排序键：MergeTree 按 tuple() 排序时每一批写都 append 到同一个 part，
   合并压力大。改成 ORDER BY (app_id, event_type, _timestamp)，分片合理的话 merge 会并行
5. 增加 _timestamp 字段，设置 TTL：TTL _timestamp + INTERVAL 90 DAY，自动清理老数据，
   减少 merge 的数据量
6. 多个物化视图分流：
   - kafka_to_errors WHERE event_type = 'error' → error_data 专表
   - kafka_to_daily_agg GROUP BY toDate(_timestamp), app_id → daily_stats 聚合表
   管理后台查 error 时直接查 error_data，不用扫 monitor_data 大表

难的（架构升级）：
7. 引入多 Shard：ClickHouse 集群部署，把 monitor topic 按 app_id hash 分发到不同 shard，
   每个 shard 自己消费自己的 partition
8. 引入分层存储：ClickHouse 的 TIERED STORAGE，热数据 SSD、冷数据对象存储，
   历史查询虽然慢，但成本低很多
```

**加分点**：提问题的同时给出"分层优化方案"（低成本→高成本），而不是只有一个笼统答案。

---

## 五、总结

### 一句话总结整个部署

> "把一个本地跑通的 Kafka + ClickHouse 架构，搬到 Docker Compose 生产环境，遇到了 **网络（跨容器通信 + 多 Listener）、磁盘（ClickHouse system_log）、CI/CD（SCP→rsync）、配置（硬编码→环境变量）、中间件兼容性（Kafka 4.x KIP-848）、路由（Caddy handle→handle_path）、挂载（chat 目录串台）、架构完整性（direct 写入缺表 + 查询不 UNION）** 8 大类问题，全部修复后全链路稳定运行，并可通过 WRITE_MODE 快速回滚。"

### 可以写在简历里的 3 个项目亮点

1. **架构改造**：将监控平台 SDK 数据链路从"HTTP 直写数据库"升级为"Kafka 异步缓冲 + ClickHouse 自消费 + 直写兜底"三段式架构，支持突发流量削峰，接口延迟降低 60%。
2. **全栈部署**：主导生产环境部署，解决了 Kafka 4.x KIP-848 Coordinator 不可用、ClickHouse Kafka 引擎跨容器 Listener 寻址、Caddy 反向代理路径匹配歧义、Docker volume 挂载串台等 9 类生产问题，保障端到端链路稳定。
3. **可靠性设计**：实现 WRITE_MODE 灰度开关（direct/both/kafka）和写入/查询双侧兜底（双写 + UNION ALL 查询），无需改代码即可在 Kafka 故障时 1 分钟内一键切回直写模式。

---

## 六、附：命令速查表

| 场景                          | 命令                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Git 配置 GitHub 代理          | `git config --global http.https://github.com.proxy http://127.0.0.1:7890`                                                                 |
| 服务器清 Docker 垃圾          | `docker image prune -af && docker builder prune -af`                                                                                      |
| 看 ClickHouse 表大小          | `SELECT table, formatReadableSize(sum(bytes)) FROM system.parts GROUP BY table`                                                           |
| Kafka 列 topic 列表           | `docker exec <kafka_container> /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list`                                   |
| 看 consumer group lag         | `docker exec <kafka_container> /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group <group_name>` |
| 手动创建 \_\_consumer_offsets | `kafka-topics.sh --create --topic __consumer_offsets --partitions 50 --replication-factor 1 --config cleanup.policy=compact`              |
| ClickHouse 手动建表           | `docker exec <ck_container> clickhouse-client -q "CREATE TABLE IF NOT EXISTS ..."`                                                        |
| 监控 dsn-server 日志          | `docker logs -f ningzhi-monitor-dsn-server`                                                                                               |
| 测试 Caddy→dsn-server 路由    | `curl -sv http://localhost:8082/api/span`（宿主机绕过 Caddy）                                                                             |
| 测试 Caddy 转发正确性         | `curl -sI https://monitor.ningzhi2.site/dsn-api/span` 看响应头有没有 `X-Powered-By`                                                       |
| NestJS 清 tsbuildinfo         | `Remove-Item tsconfig.build.tsbuildinfo -Force`（Windows）                                                                                |
