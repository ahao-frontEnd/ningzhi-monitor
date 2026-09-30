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
COPY apps/backend/monitor/package.json apps/backend/monitor/

# 安装全量依赖(包含 devDependencies，nest build 需要)
# --frozen-lockfile: 确保 lockfile 与 package.json 一致，不一致则报错
RUN pnpm install --frozen-lockfile --filter @ningzhi/monitor-server...

# 复制后端源码
COPY apps/backend/monitor/src apps/backend/monitor/src
COPY apps/backend/monitor/nest-cli.json apps/backend/monitor/nest-cli.json
COPY apps/backend/monitor/tsconfig.json apps/backend/monitor/tsconfig.json
COPY apps/backend/monitor/tsconfig.build.json apps/backend/monitor/tsconfig.build.json
COPY tsconfig.server.json tsconfig.server.json

# 切换到后端目录执行构建
WORKDIR /app/apps/backend/monitor

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
COPY apps/backend/monitor/package.json apps/backend/monitor/

# 只安装生产依赖(--prod 跳过 devDependencies，减小镜像体积)
RUN pnpm install --frozen-lockfile --prod --filter @ningzhi/monitor-server... --ignore-scripts

# 从 builder 阶段拷贝构建产物
COPY --from=builder /app/apps/backend/monitor/dist apps/backend/monitor/dist

WORKDIR /app/apps/backend/monitor

# 暴露端口
EXPOSE 8081

# 容器启动命令
CMD ["node", "dist/main.js"]
