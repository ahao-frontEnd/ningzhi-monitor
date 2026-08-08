export default () => ({
  redis: {
    // 从环境变量读取，默认用 Docker 服务名（生产环境）
    // 本地开发时在 .env 设置 REDIS_HOST=localhost
    host: process.env.REDIS_HOST || 'ningzhi-monitor-redis',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || 'ningzhiRedis',
  },
})
