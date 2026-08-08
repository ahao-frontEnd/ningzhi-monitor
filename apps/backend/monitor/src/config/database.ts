import { join } from 'node:path'

export default () => ({
  database: {
    type: 'postgres',
    // 从环境变量读取，默认用 Docker 服务名（生产环境）
    // 本地开发时在 .env 设置 DATABASE_HOST=localhost
    host: process.env.DATABASE_HOST || 'ningzhi-monitor-postgresql',
    port: Number(process.env.DATABASE_PORT) || 5432,
    database: process.env.DATABASE_NAME || 'postgres',
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'ningzhiPostgresql',
    // 实体是数据库表的映射类， 用于定义数据库表的字段和关系
    entities: [join(__dirname, '../**/*.entity{.ts,.js}')], // 实体类的路径
    synchronize: true, // 是否自动同步数据库
  },
})
