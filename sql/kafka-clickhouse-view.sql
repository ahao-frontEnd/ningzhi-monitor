-- ==============================================
-- Kafka-ClickHouse 实时数据接入配置（方案B：ClickHouse 自消费 Kafka）
-- 数据流向：
--   Node 端 KafkaProducerService → Kafka Topic 'monitor'
--       ↓ (ClickHouse Kafka 引擎消费)
--   kafka_monitor 表（虚拟表，不存储数据）
--       ↓ (物化视图 kafka_to_monitor_data 自动同步)
--   monitor_data 表（真实存储，4 业务字段，与 base_monitor_storage 同结构）
--       ↓ (物化视图 base_monitor_view 追加 processed_message)
--   用户通过 SELECT 查询 base_monitor_view 获取数据
-- ==============================================
-- ⚠️ 重要警告：
--   不要直接用 SELECT 查询 kafka_monitor 表！
--   Kafka 引擎表是"消费即删除"模式，查询会消费消息并丢弃，导致数据丢失。
--   正确做法是查询 monitor_data 表或 base_monitor_view。
-- ==============================================

-- 1. 创建 Kafka 引擎表（Kafka 消费者，虚拟表）
--    Kafka 消息 value 格式要求：JSON 对象，含 app_id / event_type / message / info 四个字段
--    例如：{"app_id":"xxx","event_type":"error","message":"oops","info":{"page":"/"}}
CREATE TABLE IF NOT EXISTS kafka_monitor
(
    app_id     String,
    event_type String,
    message    String,
    info       JSON
) ENGINE = Kafka
      SETTINGS
          kafka_broker_list = 'ningzhi-monitor-kafka:9092',  -- ClickHouse 在容器内，用 Kafka 服务名+PLAINTEXT 端口（kafkajs 在宿主机用 localhost:9094）
          kafka_topic_list = 'monitor',           -- 要消费的 Kafka 主题名称
          kafka_group_name = 'monitor-ch',        -- 消费者组名称（用来协调多个消费者）
          kafka_format = 'JSONEachRow',           -- 数据格式：每行一条 JSON
          kafka_num_consumers = 1,                -- 消费者数量（建议等于 CPU 核数）
          kafka_handle_error_mode = 'stream';     -- 错误处理模式：流式（写入 kafka_errors 系统虚拟表）

-- 2. 创建目标数据表（真实存储，字段结构与原 base_monitor_storage 一致）
CREATE TABLE IF NOT EXISTS monitor_data
(
    app_id     String,
    event_type String,
    message    String,
    info       JSON
) ENGINE = MergeTree()  -- 使用 MergeTree 引擎（ClickHouse 默认的高性能引擎）
ORDER BY tuple();       -- 排序键（这里为空，实际使用时应根据业务设置）

-- 3. 创建物化视图：从 Kafka 引擎表消费 → 写入 monitor_data
CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_to_monitor_data
TO monitor_data  -- 指定数据写入的目标表
AS
SELECT
    app_id,
    event_type,
    message,
    info
FROM kafka_monitor;

-- 4. 基于 monitor_data 重新定义查询视图（追加 processed_message）
--    注意：首次上线时若存在老版本的 base_monitor_view（指向 base_monitor_storage），
--    需要先 DROP MATERIALIZED VIEW IF EXISTS base_monitor_view;
--    初始化器里会自动处理这一逻辑，避免版本冲突。
--    这里定义的版本不含 POPULATE，避免后续重复跑造成重复数据。
CREATE MATERIALIZED VIEW IF NOT EXISTS base_monitor_view
ENGINE = MergeTree()
ORDER BY tuple()
AS
SELECT
    app_id,
    event_type,
    message,
    info,
    concat('Ningzhi ==> ', event_type) AS processed_message
FROM
    monitor_data;

-- ==============================================
-- 查询示例
-- ==============================================
-- SELECT * FROM base_monitor_view;
-- SELECT count() FROM monitor_data;
-- SELECT * FROM kafka_errors; -- 查看 Kafka 解析错误（kafka_handle_error_mode=stream 时可用）

-- ==============================================
-- 数据流向说明：
--   Node SpanService.tracking()
--       ↓ (kafkajs 生产消息)
--   Kafka Topic 'monitor'
--       ↓ (Kafka引擎消费)
--   kafka_monitor 表（虚拟表，不存储数据）
--       ↓ (物化视图自动同步)
--   monitor_data 表（真实存储，可查询）
--       ↓ (物化视图 base_monitor_view)
--   用户通过 SELECT 查询获取数据
-- ==============================================

-- ==============================================
-- 为什么要创建物化视图？
--   1. 直接查询 kafka_monitor 表会导致数据丢失，因为 Kafka 引擎表是"消费即删除"模式。
--   2. 物化视图可以提供实时数据查询，而无需等待数据同步完成。
--   3. 可以根据需要创建多个物化视图，每个视图对应不同的查询场景。
--   4. 物化视图可以确保数据在 ClickHouse 中的实时性，避免数据延迟。

-- 物化视图和普通的表的区别？
--   1. 物化视图是自动同步数据的视图，而普通的表是手动触发数据同步。
--   2. 物化视图可以提供实时数据查询，而普通的表需要等待数据同步完成。
--   3. 物化视图可以支持复杂的查询操作，而普通的表只能支持简单的查询。

-- 物化视图本质上是一个特殊的表，它会自动同步数据到目标表。
-- ==============================================
