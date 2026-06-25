-- ==============================================
-- Kafka-ClickHouse 实时数据接入配置
-- 功能：从 Kafka 消费数据并自动写入 ClickHouse
-- ==============================================
-- ⚠️ 重要警告：
--   不要直接用 SELECT 查询 kafka_monitor 表！
--   Kafka 引擎表是"消费即删除"模式，查询会消费消息并丢弃，导致数据丢失。
--   正确做法是查询 monitor_data 表或物化视图。

-- 1. 创建 Kafka 引擎表（Kafka 消费者）
-- 这是一个特殊的表引擎，它不会存储数据，而是直接从 Kafka 读取
CREATE TABLE kafka_monitor
(
    key   String,  -- Kafka 消息的 Key（字符串类型）
    value String   -- Kafka 消息的 Value（字符串类型，这里是 JSON 格式）
) ENGINE = Kafka  -- 使用 Kafka 引擎，让 ClickHouse 成为 Kafka 消费者
      SETTINGS 
          kafka_broker_list = 'localhost:9092',  -- Kafka 服务器地址和端口
          kafka_topic_list = 'monitor',           -- 要消费的 Kafka 主题名称
          kafka_group_name = 'monitor',           -- 消费者组名称（用来协调多个消费者）
          kafka_format = 'JSONEachRow',           -- 数据格式：每行一条 JSON
          kafka_num_consumers = 1;                -- 消费者数量（建议等于 CPU 核数）

-- 2. 创建目标数据表（真正存储数据的表）
-- 这是一个普通的 ClickHouse 表，用于持久化存储从 Kafka 消费的数据
CREATE TABLE monitor_data 
AS kafka_monitor  -- 复制 kafka_monitor 表的结构
ENGINE = MergeTree()  -- 使用 MergeTree 引擎（ClickHouse 默认的高性能引擎）
ORDER BY tuple();     -- 排序键（这里为空，实际使用时应根据业务设置）

-- 3. 创建物化视图（自动数据同步管道）
-- 物化视图会自动将 kafka_monitor 中的数据同步到 monitor_data
CREATE MATERIALIZED VIEW kafka_to_monitor_data 
TO monitor_data  -- 指定数据写入的目标表
AS
SELECT *         -- 选择所有字段
FROM kafka_monitor;  -- 从 Kafka 引擎表读取数据

-- 4. 查询示例
-- 查询物化视图（等同于查询 monitor_data 表）
-- SELECT *
-- FROM kafka_to_monitor_data;

-- ==============================================
-- 数据流向说明：
-- Kafka Topic 'monitor' 
--       ↓ (Kafka引擎消费)
-- kafka_monitor 表（虚拟表，不存储数据）
--       ↓ (物化视图自动同步)
-- monitor_data 表（真实存储，可查询）
--       ↓ (用户查询)
-- 用户通过 SELECT 查询获取数据
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
