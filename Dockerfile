# syntax=docker/dockerfile:1

# ============ 阶段一：依赖与构建 ============
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html playwright.config.ts ./
COPY src ./src
COPY e2e ./e2e

# 类型检查 + 生产构建（纯静态产物，无业务后端）
RUN npm run build

# ============ 阶段二：运行镜像（零运行时外部请求） ============
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173
# 只保留静态产物与自写零依赖服务器，不含任何 npm 依赖
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 4173
CMD ["node", "server/static-server.mjs", "dist", "4173"]

# ============ 阶段三：一次性验收（Vitest + Playwright） ============
FROM node:20-bookworm-slim AS verify
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci
# Chromium 系统依赖由 Playwright 自行安装；另加中文字体与基础字体
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-noto-cjk fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
RUN npx playwright install --with-deps chromium

COPY tsconfig.json vite.config.ts index.html playwright.config.ts ./
COPY src ./src
COPY e2e ./e2e
COPY server ./server

# 一次性：单元测试 → 构建 → E2E（webServer 由 playwright.config 自动拉起预览）
CMD ["sh", "-c", "npm run test && npm run build && npx playwright test"]
