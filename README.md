# Harness Engineering Platform（Harness 工程平台）

一个可本地启动的全栈工程平台 MVP：后端使用 Express + Mongoose，前端使用 Vite + React。
控制台围绕用户蓝图中的四个工程域组织：**SPEC 工程**、**Harness Workflow（工作流）**、
**评测/质量工程**、**AI 资产市场**。

> 本仓库是一个 MVP（最小可行产品），用于打通前后端并验证四个工程域的核心交互路径，
> 尚未包含完整的鉴权、权限、审计等生产级能力。请务必阅读下方「鉴权范围与安全说明」。

## 目录

- [架构说明](#架构说明)
- [四个工程域与代码的对应关系](#四个工程域与代码的对应关系)
- [鉴权范围与安全说明（重要）](#鉴权范围与安全说明重要)
- [前置条件](#前置条件)
- [环境变量配置](#环境变量配置-env)
- [安装与运行](#安装与运行)
- [示例数据（seed）](#示例数据seed)
- [验证与测试](#验证与测试)
- [当前 MVP 的已知限制](#当前-mvp-的已知限制)

## 架构说明

```
harness-engineering-platform/
├── index.html                # Vite 入口 HTML
├── vite.config.js            # Vite 配置：开发环境将 /api 代理到 Express (默认 5000 端口)
├── src/
│   ├── client/                # 前端 React 应用（Vite 构建）
│   │   ├── main.jsx           # React 应用入口
│   │   ├── App.jsx            # 路由与登录态管理
│   │   ├── components/        # 侧边栏等公共组件
│   │   └── pages/              # 五个核心页面：总览/工作流/资产市场/SPEC/评测
│   └── server/                 # 后端 Express 应用
│       ├── index.js           # Express 启动入口，挂载路由、连接 MongoDB
│       ├── models/             # Mongoose 数据模型：Asset / Spec / TestingCase / Workflow
│       ├── routes/             # REST API：auth / workflow / asset / spec / testing / dashboard
│       └── utils/jwt.js       # JWT 密钥获取逻辑（开发态 fallback / 生产态强制配置）
├── scripts/seed.js            # 开发环境示例数据脚本（需手动执行，不会自动运行）
└── tests/                      # 基于 Node 内置测试运行器的模型/工具函数测试
```

前端通过 `axios` 调用 `/api/*` 接口；开发模式下 Vite dev server（默认 `3000` 端口）会将
`/api` 请求代理到 Express 后端（默认 `5000` 端口），因此本地开发无需额外配置跨域。

## 四个工程域与代码的对应关系

| 工程域 | 后端 | 前端页面 | 说明 |
| --- | --- | --- | --- |
| **SPEC 工程** | `models/Spec.js`、`routes/spec.js` | `pages/Specs.jsx`（路由 `/specs`） | 管理需求(requirement)、设计(design)、任务(task)、契约(contract)、规则(rule)、标准(standard) 六类 SPEC，支持列出与创建 |
| **Harness Workflow** | `models/Workflow.js`、`routes/workflow.js` | `pages/Workflows.jsx`（路由 `/workflows`） | 工作流按阶段（Command 入口 / 场景理解 / 方案设计 / 任务执行 / 结果验证 / Extension 构建）建模；支持列出、创建、调用 `POST /api/workflow/:id/execute` 执行 |
| **评测/质量工程** | `models/TestingCase.js`、`routes/testing.js` | `pages/Testing.jsx`（路由 `/testing`） | 测试集（评测集）包含用例与质量门禁（qualityGates），支持列出并调用 `POST /api/testing/:id/execute` 执行，展示执行结果与质量分 |
| **AI 资产市场** | `models/Asset.js`、`routes/asset.js` | `pages/Assets.jsx`（路由 `/assets`） | 管理 Agent / Skill / MCP / Extension 四类资产，支持按类型过滤、创建、调用 `POST /api/asset/:id/publish` 发布，展示评分/下载量 |
| **总览（Dashboard）** | `routes/dashboard.js` | `pages/Dashboard.jsx`（路由 `/`） | 聚合以上四域的数量统计与近期活动，展示示例趋势图（基于当前统计数字生成，非真实历史时序） |

## 鉴权范围与安全说明（重要）

- `routes/auth.js` 提供 `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`（受 `verifyToken` 中间件保护），使用 JWT 签发与校验 token。
- **`workflow` / `asset` / `spec` / `testing` / `dashboard` 五个资源路由目前均未挂载 `verifyToken` 中间件**，也就是说：
  - 前端会在请求头带上登录后获得的 token，但后端当前并未校验该 token 是否有效才允许访问这些资源接口。
  - 任何能访问到后端服务的客户端都可以直接读写工作流、资产、SPEC、测试集数据，无需登录。
- 这是 MVP 阶段的已知设计缺口，**不代表已实现基于角色的访问控制（RBAC）或数据隔离**。在将本项目用于生产环境或对外暴露之前，必须：
  1. 在 `workflow` / `asset` / `spec` / `testing` / `dashboard` 路由上挂载 `verifyToken`（或等效）中间件；
  2. 补充基于 `role`（`admin` / `developer` / `reviewer` / `viewer`）的细粒度权限控制；
  3. 补充审计日志、速率限制等安全加固措施。
- JWT 密钥：`src/server/utils/jwt.js` 不再包含可用于生产的硬编码默认密钥。
  - 若配置了 `JWT_SECRET` 环境变量，则始终使用该值。
  - 若 `NODE_ENV=production` 且未配置 `JWT_SECRET`，服务器会在签发/校验 token 时抛出错误，强制要求显式配置。
  - 若处于非生产环境（默认开发模式）且未配置 `JWT_SECRET`，会使用一个**进程启动时随机生成、仅存在于本次进程生命周期内**的密钥，并打印警告日志；服务器重启后此前签发的 token 会全部失效。这只是为了方便本地免配置启动，**不得**用于任何持久化/生产场景。

## 前置条件

- Node.js 18+（本仓库在 Node.js 22 下验证通过；使用了 Node 内置的 `node --test`，需要 Node 18.17+/20+）
- MongoDB 实例（本地或远程均可），默认监听 `mongodb://localhost:27017`
  - 本地启动示例：`mongod --dbpath /path/to/data`，或使用 Docker：`docker run -d -p 27017:27017 --name harness-mongo mongo:6`
  - 若没有 MongoDB，服务器仍可启动（健康检查 `/api/health` 可用），但所有数据类接口会返回连接超时错误

## 环境变量配置（.env）

复制 `.env.example` 为 `.env` 并按需修改：

```bash
cp .env.example .env
```

| 变量 | 说明 |
| --- | --- |
| `PORT` | Express 服务端口，默认 `5000` |
| `NODE_ENV` | `development` / `production`，影响 JWT 密钥 fallback 行为（见上文安全说明） |
| `MONGODB_URI` | MongoDB 连接字符串，默认 `mongodb://localhost:27017/harness-platform` |
| `JWT_SECRET` | JWT 签名密钥。**生产环境必须配置**，开发环境不配置也可运行（见安全说明） |
| `JWT_EXPIRE` | JWT 过期时间，默认 `7d` |
| `CLAUDE_API_KEY` / `OPENAI_API_KEY` | 预留给未来 AI 能力接入，当前 MVP 未实际调用 |
| `UPLOAD_DIR` / `MAX_FILE_SIZE` | 预留给未来文件上传能力，当前 MVP 未实现资产文件上传 |
| `VITE_API_URL` | 预留变量；当前前端通过 Vite 代理直接请求相对路径 `/api/*`，未直接读取该变量 |

## 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3.（可选，推荐）启动本地 MongoDB
# docker run -d -p 27017:27017 --name harness-mongo mongo:6

# 4.（可选）写入示例数据，便于首次演示
npm run seed

# 5. 同时启动后端 (5000) 与前端开发服务器 (3000，代理 /api 到后端)
npm run dev
```

启动后访问 `http://localhost:3000`，使用登录页的“去注册”创建一个账号并登录。

其他常用命令：

```bash
npm run dev:server   # 仅启动 Express 后端（含 --experimental-modules 的 nodemon 热重载）
npm run dev:client   # 仅启动 Vite 前端开发服务器
npm run build        # 构建生产环境前端静态资源到 dist/
npm run preview      # 预览构建产物
npm start            # 以生产模式启动后端（需先自行构建/托管前端静态资源）
npm test             # 运行测试
```

## 示例数据（seed）

`scripts/seed.js` 会清空并写入一批示例 Workflow / Asset / Spec / TestingCase 数据，方便首次打开控制台时看到非空列表、图表与近期活动。

```bash
npm run seed
```

注意：

- 该脚本**不会**在 `npm start` / `npm run dev` 等正常启动路径中自动执行，需要手动运行。
- 该脚本会先清空目标集合的现有数据，**不要在生产数据库上运行**。

## 验证与测试

```bash
npm run build   # 验证前端可正常构建（CI 最小验证项）
npm test        # 运行 Node 内置测试运行器（node --test），覆盖模型 schema 校验与 JWT 密钥 fallback 逻辑
```

`npm test` 使用 Mongoose 的 `validateSync()`，**无需连接真实 MongoDB** 即可校验各模型的必填字段、枚举约束是否符合预期；`JWT_SECRET` 相关的 fallback/强制校验逻辑也有独立测试覆盖。

## 当前 MVP 的已知限制

- 资源路由（工作流/资产/SPEC/评测/总览）未挂载鉴权中间件，详见上文「鉴权范围与安全说明」。
- 未实现基于角色的权限控制、审计日志。
- 工作流的“执行”、测试集的“执行”均为演示性质的模拟执行（例如测试执行结果通过随机数生成通过/失败），并未真正调度 Agent/Skill/MCP 或运行真实用例。
- 总览页的“资产/交付趋势”图表基于当前统计数字线性生成的示意数据，后端暂未提供真实的历史时间序列接口。
- 资产市场暂未实现文件/代码包上传（`multer`、`UPLOAD_DIR` 为预留能力）。
- `CLAUDE_API_KEY` / `OPENAI_API_KEY` 为预留配置项，当前代码未实际调用任何外部 AI 服务。
- 前端构建产物体积较大（单个 JS chunk 约 600KB+），MVP 阶段未做代码分割优化。
