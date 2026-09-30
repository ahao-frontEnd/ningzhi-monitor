############################
# Stage 1: Builder - 安装全量依赖并编译
############################
FROM node:22-bookworm-slim AS builder

# 启用 pnpm(版本与 packageManager 字段一致)
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# ⚠️ 先复制 lockfile，利用 Docker 层缓存
# 只要 lockfile 不变，这一层就会被复用，加速构建
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/backend/dsn-server/package.json apps/backend/dsn-server/

# 安装全量依赖(包含 devDependencies，nest build 需要)
# --frozen-lockfile: 确保 lockfile 与 package.json 一致，不一致则报错
RUN pnpm install --frozen-lockfile --filter @ningzhi/monitor-dsn-server...

# 复制后端源码和配置文件
COPY apps/backend/dsn-server/src apps/backend/dsn-server/src
COPY apps/backend/dsn-server/nest-cli.json apps/backend/dsn-server/nest-cli.json
COPY apps/backend/dsn-server/tsconfig.json apps/backend/dsn-server/tsconfig.json
COPY apps/backend/dsn-server/tsconfig.build.json apps/backend/dsn-server/tsconfig.build.json
COPY tsconfig.server.json tsconfig.server.json

# 切换到后端目录执行构建
WORKDIR /app/apps/backend/dsn-server

# ⚠️ 使用 npx nest build 而非 pnpm build
# 原因：turbo.json 中 build 的 outputs 为空数组 []，会跳过实际编译
RUN npx nest build

############################
# Stage 2: Runtime - 只装生产依赖 + 运行应用
############################
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# 复制 workspace 元信息
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/backend/dsn-server/package.json apps/backend/dsn-server/

# 只安装生产依赖(--prod 跳过 devDependencies，减小镜像体积)
RUN pnpm install --frozen-lockfile --prod --filter @ningzhi/monitor-dsn-server... --ignore-scripts

# 从 builder 阶段拷贝构建产物
# 注意：dsn-server 的 tsconfig rootDir 是 .，编译后入口在 dist/src/main.js（与 monitor 不同）
COPY --from=builder /app/apps/backend/dsn-server/dist apps/backend/dsn-server/dist

WORKDIR /app/apps/backend/dsn-server

# 暴露端口（dsn-server 监听 8080）
EXPOSE 8080

# 容器启动命令（注意 dist/src/main.js 路径，因为 rootDir 是 .）
CMD ["node", "dist/src/main.js"]
