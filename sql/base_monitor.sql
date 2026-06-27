-- 创建存储表
-- 删除已有的表（如果存在）
DROP TABLE IF EXISTS base_monitor_storage;
-- 创建新的表
CREATE TABLE base_monitor_storage (
    event_type String, -- 事件类型，存储为字符串
    message String -- 消息内容，存储为 JSON 格式
) ENGINE = MergeTree() -- 合并树引擎，用于存储和查询数据, MergeTree 是 ClickHouse 的默认引擎，用于存储和查询数据
ORDER BY tuple(); -- 按元组排序，用于优化查询性能


-- 创建物化视图
-- 删除已有的物化视图（如果存在）
DROP MATERIALIZED VIEW IF EXISTS base_monitor_view;

-- 创建新的物化视图, 作用是可以对存储表进行预处理，例如添加计算字段、1筛选数据等，以提高查询效率
-- 和存储表有什么区别？ 
-- 存储表是原始数据的存储表，而物化视图是基于存储表进行预处理后的视图，用于提高查询效率
CREATE MATERIALIZED VIEW base_monitor_view ENGINE = MergeTree() 
ORDER BY 
    tuple() -- 按元组排序，用于优化查询性能
    POPULATE -- 初始化时填充视图数据
    AS
SELECT
    event_type,
    message,
    concat('Ningzhi ==> ', event_type) AS processed_message
FROM
    base_monitor_storage


SELECT * FROM base_monitor_view
