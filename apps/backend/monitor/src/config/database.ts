import { join } from 'node:path'

export default () => ({
  database: {
    type: 'postgres',
    // host: 'localhost',
    // host: '192.168.1.103',
    host: 'ningzhi-monitor-postgresql',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: 'ningzhiPostgresql',
    // 实体是数据库表的映射类， 用于定义数据库表的字段和关系
    entities: [join(__dirname, '../**/*.entity{.ts,.js}')], // 实体类的路径
    synchronize: true, // 是否自动同步数据库
  },
})
