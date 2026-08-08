# SDK 发布到 npm 完整流程与踩坑记录

> 记录 `@ningzhi/monitor-sdk-*` 三个包发布到 npm 的完整流程，以及在发布过程中遇到的所有问题与解决方案。
> 适用于后续版本迭代发布、新成员接手、面试复盘。

---

## 一、包结构与依赖关系

SDK 采用 monorepo 架构（pnpm workspace），位于 `packages/` 目录下，共 3 个包：

```
@ningzhi/monitor-sdk-core          (无依赖)         ← 第 1 步发布
@ningzhi/monitor-sdk-browser-utils (依赖 core)      ← 第 2 步发布
@ningzhi/monitor-sdk-browser       (依赖 core+utils)← 第 3 步发布（用户实际 import 的）
```

- `core`：核心抽象层，定义 BaseClient、transport、captures 等
- `browser-utils`：浏览器侧工具与 Web Vitals 采集（FCP / LCP / CLS / INP / TTFB）
- `browser`：面向用户的入口包，`import { init } from '@ningzhi/monitor-sdk-browser'`

三个包之间用 `workspace:*` 声明依赖，pnpm publish 时会**自动替换为真实版本号**（如 `1.0.0`）。

> ⚠️ 因此必须按依赖拓扑顺序发布：core → browser-utils → browser。用 `npm publish` 不会替换 `workspace:*`，所以 browser-utils / browser 必须用 `pnpm publish`。

---

## 二、发布前必须修改的 package.json 配置

### 1. `files` 字段（最关键）

**问题**：项目 `.gitignore` 里排除了 `build/`，而 npm 发布时**默认遵循 `.gitignore`**，导致构建产物 `build/` 不会被打进 tarball —— 别人 `npm install` 后找不到入口文件直接报错。

**解决**：在每个 package.json 加 `files` 白名单字段（优先级高于 `.gitignore`）：

```json
"files": [
  "build",
  "README.md"
]
```

### 2. `publishConfig` 字段

**问题**：`@ningzhi/*` 是 scope 包，npm 默认把 scope 包当作 **restricted（私有，需付费）**，首次发布会报错。

**解决**：声明公开访问：

```json
"publishConfig": {
  "access": "public"
}
```

加上后发布命令就不需要再带 `--access public`。

### 3. `repository` 字段（可选但推荐）

npm 页面会显示 GitHub 仓库链接，方便用户溯源与提 issue：

```json
"repository": {
  "type": "git",
  "url": "https://github.com/ahao-frontEnd/ningzhi-monitor.git",
  "directory": "packages/core"
}
```

> 三个包的 `directory` 分别填 `packages/core`、`packages/browser-utils`、`packages/browser`。

### 验证配置是否生效

```powershell
# 构建三个包
pnpm --filter "@ningzhi/monitor-sdk-core" --filter "@ningzhi/monitor-sdk-browser-utils" --filter "@ningzhi/monitor-sdk-browser" build

# 用 dry-run 检查实际会发布的文件清单（确认 build/ 被包含）
cd packages\core
npm pack --dry-run
```

tarball contents 里能看到 `build/cjs/index.js`、`build/esm/index.mjs`、`build/types/index.d.ts` 即配置正确。

---

## 三、npm 账号与 scope 准备

1. 去 [npmjs.com](https://www.npmjs.com/signup) 注册账号
2. **验证邮箱**（必须验证，否则无法发布）
3. 确认 `@ningzhi` scope 归属：
   - 若 npm 用户名就是 `ningzhi`，个人 scope 自动可用，无需建 org
   - 否则去 `https://www.npmjs.com/org/create` 创建名为 `ningzhi` 的 organization（免费）
4. 本地登录：

```powershell
npm login          # 输入 username / password / email / OTP
npm whoami         # 验证登录，应输出用户名
```

---

## 四、构建与发布命令

```powershell
# 1. 构建三个包（turbo 会按依赖拓扑顺序）
pnpm --filter "@ningzhi/monitor-sdk-core" --filter "@ningzhi/monitor-sdk-browser-utils" --filter "@ningzhi/monitor-sdk-browser" build

# 2. 按依赖顺序发布（token 已配置好后不需要 --otp）
pnpm --filter @ningzhi/monitor-sdk-core publish --no-git-checks
pnpm --filter @ningzhi/monitor-sdk-browser-utils publish --no-git-checks
pnpm --filter @ningzhi/monitor-sdk-browser publish --no-git-checks

# 3. 验证发布成功
npm view @ningzhi/monitor-sdk-browser
```

参数说明：

- `--no-git-checks`：跳过 git 工作区是否干净的检查（有未提交改动也能发）
- 也可用 `pnpm -r publish --no-git-checks` 一次性按拓扑顺序发布全部 3 个包

---

## 五、踩坑全记录

### 坑 1：`.gitignore` 排除 `build/` → 发出空包

- **现象**：发布的包里没有 `build/` 目录，用户安装后报 "Cannot find module"
- **根因**：npm 默认遵循 `.gitignore`，而项目 `.gitignore` 里有 `build`
- **解决**：package.json 加 `files: ["build", "README.md"]` 白名单

### 坑 2：scope 包默认私有 → 403

- **现象**：发布报 `403 Forbidden`
- **根因**：`@ningzhi/*` scope 包默认 restricted（需付费订阅）
- **解决**：package.json 加 `publishConfig: { access: "public" }`

### 坑 3：2FA 双因素认证 → `Two-factor authentication required`

- **现象**：
  ```
  403 Forbidden - Two-factor authentication or granular access token
  with bypass 2fa enabled is required to publish packages.
  ```
- **根因**：npm 账号开启了 2FA，发布时需要 OTP（动态验证码）

### 坑 4：`pnpm publish --otp` 不生效

- **现象**：加了 `--otp=747704` 仍然报坑 3 的 2FA 错误
- **根因**：pnpm 10.x 的 `publish` 命令**没有把 `--otp` 参数透传给 npm registry 的请求头**，等于没传
- **验证**：对 core 包（无 workspace 依赖）改用 `npm publish --otp=xxx` 能成功，证实是 pnpm 的问题
- **结论**：browser-utils / browser 有 `workspace:*` 依赖，必须用 `pnpm publish`（才能替换版本号），但 pnpm 的 OTP 又传不上去 —— 必须改用 access token 方案

### 坑 5：Granular Token 权限不足 → `You may not perform that action with these credentials`

- **现象**：配置了 automation token 后，2FA 错误消失，但变成：
  ```
  403 Forbidden - You may not perform that action with these credentials.
  ```
- **根因**：创建的是 **Granular Access Token**，但没有正确配置 packages 的 scope 与写权限
- **解决**：见下方「正确的 Token 配置」

### 坑 6：pnpm 缓存了 404 元数据 → 包已发布仍报 404

- **现象**：三个包都能 `npm view` 查到（已成功发布），但 monorepo 内 demos 项目写固定版本 `1.0.0` 后 `pnpm i` 仍然报：
  ```
  ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/@ningzhi%2Fmonitor-sdk-browser Not Found - 404
  An authorization header was used: Bearer npm_[hidden]
  ```
- **根因**：发布之前 demos 已经把依赖从 `workspace:*` 改成了 `1.0.0` 并跑过一次 `pnpm i`，当时包还没发布，pnpm 请求 registry 得到 404 并把 **not-found 响应缓存**进了 store metadata（`pnpm store prune` 时输出 "Removed all cached metadata files" 证实了这点）。之后包发布了，但 pnpm 还在用旧的 404 缓存。
- **解决**：清空 pnpm store 元数据 + 包缓存后重新安装：
  ```powershell
  # 清所有 pnpm 缓存（包 + 元数据）
  pnpm store prune
  # 清掉 demos 的 node_modules（可选，保险起见）
  Remove-Item -Recurse -Force demos\vanilla\node_modules
  # 重新安装，强制重新走 registry 查询不走缓存
  pnpm i --no-frozen-lockfile
  ```

### 坑 7：lockfile 与 package.json 版本号不匹配 → `ERR_PNPM_OUTDATED_LOCKFILE`

- **现象**：把 demos 依赖从 `workspace:*` 改成 `1.0.0` 后 `pnpm i` 报错：
  ```
  ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date
  specifiers in the lockfile don't match specifiers in package.json:
  * @ningzhi/monitor-sdk-browser (lockfile: workspace:*, manifest: 1.0.0)
  ```
- **根因**：之前写 `workspace:*` 时生成的 pnpm-lock.yaml 与现在写固定版本 `1.0.0` 的 package.json 不一致，而当前 shell 或 CI 环境下 pnpm 用了 frozen-lockfile 模式（不允许修改 lockfile）
- **解决**：加 `--no-frozen-lockfile` 让 pnpm 重新解析依赖并更新 lockfile：
  ```powershell
  pnpm i --no-frozen-lockfile
  ```

---

## 六、正确的 Token 配置（核心解决方案）

由于 pnpm 的 `--otp` 不生效，最可靠的方案是创建一个 **bypass 2FA 的 access token**，写入 `~/.npmrc`，之后 `pnpm publish` 不再需要 OTP。

### 创建 Granular Access Token

登录 [npmjs.com](https://www.npmjs.com) → 头像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**：

| 字段                              | 配置                    | 说明                                                           |
| --------------------------------- | ----------------------- | -------------------------------------------------------------- |
| Token name                        | `local-publish`（随意） | 标识用                                                         |
| Expiration                        | 90 days / 1 year        | 按需                                                           |
| **Packages and scopes**           | ⬅️ 关键                 | 见下                                                           |
| └ 权限                            | **Read and write**      | ⚠️ 默认可能是 Read-only，必须改                                |
| └ 范围                            | **All public packages** | 最省事；或选 "Only select packages and scopes" 添加 `@ningzhi` |
| Organizations                     | No access               | 无关                                                           |
| **Allow access by bypassing 2FA** | ✅ **勾选**             | ⚠️ 不勾又会回到 2FA 错误                                       |

### 容易漏的两个关键项

1. **权限必须 `Read and write`** —— 默认 Read-only 会报 `may not perform that action`
2. **必须勾选 `Bypass 2FA`** —— 不勾会报 `Two-factor authentication required`

> npm 会提示「Trusted Publishing 更适合 CI/CD」—— 这个警告针对 GitHub Actions 场景，本地手动发布可安全忽略，Trusted Publishing 只能从 CI 调用，本地命令行用不了。

### 写入 token 并发布

```powershell
# 1. 写入用户主目录的 .npmrc（不在项目里，不会被 git 跟踪，安全）
npm config set //registry.npmjs.org/:_authToken npm_xxx

# 2. 发布三个包（不需要 --otp）
pnpm --filter @ningzhi/monitor-sdk-core publish --no-git-checks
pnpm --filter @ningzhi/monitor-sdk-browser-utils publish --no-git-checks
pnpm --filter @ningzhi/monitor-sdk-browser publish --no-git-checks
```

### 关于 Classic Automation Token

npm 目前主推 Granular Access Token，Classic Token 的创建入口可能已折叠或下线。若能找到 Classic Token 入口，选 **Automation** 类型即可（自动继承账户全部权限 + 绕过 2FA，无需单独配 scope，最省事）。

---

## 七、后续版本更新流程

```powershell
# 1. 改完代码后，递归升版本号
pnpm -r version patch      # 1.0.0 → 1.0.1（修复）
# 或 minor: 1.0.0 → 1.1.0（新功能）
# 或 major: 1.0.0 → 2.0.0（破坏性变更）

# 2. 重新构建
pnpm --filter "@ningzhi/monitor-sdk-core" --filter "@ningzhi/monitor-sdk-browser-utils" --filter "@ningzhi/monitor-sdk-browser" build

# 3. 发布（token 已配置，无需 OTP）
pnpm -r publish --no-git-checks
```

---

## 八、安全注意事项

1. **token 不要明文分享 / 提交到 git**
   - `npm config set` 写入的是 `C:\Users\<用户名>\.npmrc`（用户主目录），不在项目内，不会被 git 跟踪
   - 切勿把 token 写进项目根目录的 `.npmrc` 并提交

2. **token 一旦泄露立即吊销**
   - 去 npm 网站 → Access Tokens → 删除对应 token
   - 重新生成或用 `npm login` 恢复

3. **发布完成后可吊销 token**
   - 如果只是偶尔手动发布，用完可删除 token，下次发布时 `npm login` 用 OTP 即可（但 pnpm publish 的 OTP 问题仍在，建议保留一个 bypass 2FA 的 token）

4. **CI/CD 场景用 Trusted Publishing**
   - 如果将来要从 GitHub Actions 自动发版，配置 npm 的 Trusted Publishing（OIDC），无需 token，最安全

---

## 九、面试可说的重难点

1. **monorepo 多包发布的依赖拓扑处理**：用 `workspace:*` 声明内部依赖，pnpm publish 自动替换版本号，必须按拓扑顺序发布（core → utils → browser）

2. **`.gitignore` 与 npm 发布的冲突**：npm 默认遵循 `.gitignore`，导致构建产物被排除，用 `files` 白名单字段解决（优先级高于 `.gitignore`）

3. **scope 包的权限与可见性**：`@scope/name` 默认私有需付费，用 `publishConfig.access: "public"` 声明免费公开

4. **2FA 与 CI/CD 的冲突**：账号开启 2FA 后，命令行 / CI 环境无法输入 OTP，通过 bypass 2FA 的 access token 解决

5. **pnpm publish 的 OTP 透传缺陷**：pnpm 10.x 的 `--otp` 参数未透传给 registry 请求头，是一个实际踩到的工具链坑，最终用 token 方案绕过

6. **Granular Token 的最小权限原则**：新版 npm 推荐细粒度 token，需精确配置 scope 范围与读写权限，体现对发布凭据的安全管控

7. **发布后包的缓存一致性问题**：pnpm 会缓存 registry 的 404 元数据，即使包后来发布成功，命中缓存的项目仍会报 Not Found —— 必须 `pnpm store prune` 清缓存后重装

8. **workspace 协议与固定版本号的适用边界**：monorepo 内成员对另一个成员的依赖，`workspace:*` 链接本地源码（实时生效，适合本地开发），固定版本 `1.0.0` 从 registry 下载（验证线上包发布效果，但每次改动需重新 build+publish）

---

## 十、发布后验证：在 monorepo 内部 demos 验证线上包 vs 本地开发

### `workspace:*` vs 固定版本 `1.0.0` 的取舍

demos/vanilla 与 packages/browser 都是 workspace 成员，两种写法效果完全不同：

| 依赖写法                                        | 解析来源                         | node_modules 链接 Target                                        | 适用场景                                                     |
| ----------------------------------------------- | -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `"@ningzhi/monitor-sdk-browser": "workspace:*"` | 链接本地 `packages/browser` 源码 | `.../packages/browser`                                          | 日常开发：改 SDK 代码 demos 即时生效，免重新发布 ✅ 推荐默认 |
| `"@ningzhi/monitor-sdk-browser": "1.0.0"`       | 从 npm registry 下载 tarball     | `.../node_modules/.pnpm/@ningzhi+monitor-sdk-browser@1.0.0/...` | 发布后验证：确认线上包真能被正常下载、import、运行           |

> ⚠️ 注意：写固定版本时不要使用 `link-workspace-packages`（pnpm 默认仅对 `workspace:` 协议链接本地，普通版本号会走 registry，因此能验证线上包）。

### 验证线上发布包的完整步骤

```powershell
# Step 1：把 demos 依赖从 workspace:* 改成固定版本 1.0.0
# demos/vanilla/package.json:
#   "@ningzhi/monitor-sdk-core": "1.0.0",
#   "@ningzhi/monitor-sdk-browser": "1.0.0"

# Step 2：清 pnpm 缓存（关键！否则命中旧的 404 缓存）
pnpm store prune

# Step 3：重新安装（允许更新 lockfile）
pnpm i --no-frozen-lockfile
```

### 验证成功的证据（三条全中才算真的用了线上包）

1. **node_modules 链接 Target**：指向 `.pnpm/@ningzhi+monitor-sdk-browser@1.0.0/...`，而非 `packages/browser` 本地源码
   ```powershell
   (Get-Item demos/vanilla/node_modules/@ningzhi/monitor-sdk-browser).Target
   # 应输出包含 ".pnpm/@ningzhi+monitor-sdk-browser@1.0.0" 的路径
   ```
2. **pnpm-lock.yaml**：有独立的 `resolution: {integrity: sha512-...}`（与发布时 npm 返回的 integrity 一致），而非 workspace 引用
   ```powershell
   Select-String pnpm-lock.yaml -Pattern "monitor-sdk-browser@1\.0\.0" -Context 0,2
   # 应看到 resolution: {integrity: sha512-...}
   ```
3. **构建产物存在**：`build/` 目录（cjs / esm / types 三套）齐全，package.json 版本为 `1.0.0`

### 验证完建议改回 workspace:\*

线上包验证无误后，建议把 demos 依赖改回 `workspace:*`，否则每次改 SDK 都要重新发布 npm 才能看到效果，调试效率极低。

---

## 十一、快速发布清单（每次发布对照）

- [ ] 代码改动已提交
- [ ] `package.json` 的 `version` 已升级（或用 `pnpm -r version patch`）
- [ ] `files` / `publishConfig` / `repository` 字段齐全
- [ ] 执行 `pnpm build` 构建成功
- [ ] `npm pack --dry-run` 确认 `build/` 在 tarball 内
- [ ] `~/.npmrc` 中有有效的 bypass 2FA token（`npm whoami` 正常）
- [ ] 按顺序发布：core → browser-utils → browser
- [ ] `npm view @ningzhi/monitor-sdk-browser` 验证版本号已更新
- [ ] **（可选）demos 改固定版本 + `pnpm store prune` + `pnpm i --no-frozen-lockfile`，验证线上包可被正常下载使用**
- [ ] 验证完毕 demos 改回 `workspace:*`
