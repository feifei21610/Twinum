# Twinum 开发与发布手册

日常改代码 → 上线的完整流程与命令清单。

---

## 🔁 最常用：改代码 → 自动发布（3 条命令）

每次你改完代码，验证本地通过后，执行：

```bash
git add .
git commit -m "描述你的改动"
git push
```

推送后会发生：

1. GitHub Actions 自动触发 `.github/workflows/deploy.yml`
2. 流水线执行：`npm ci` → `npm run test` → `npm run build` → 上传到 GitHub Pages
3. **2-3 分钟后**新版本自动生效：https://feifei21610.github.io/Twinum/

### 查看部署进度

- 📊 Actions 列表：https://github.com/feifei21610/Twinum/actions
- 🟢 全绿 = 部署完成
- 🔴 红叉 = 失败（点进去看日志）

---

## 📝 Commit Message 规范（推荐 Conventional Commits）

格式：`<type>(<scope>): <description>`

常用 type：

| type | 含义 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(ui): 增加对局日志抽屉` |
| `fix` | 修 bug | `fix(bot): L0 强制 Show 时禁用 mistakeRate` |
| `refactor` | 重构不改行为 | `refactor(engine): 抽取出牌代价评估到独立函数` |
| `docs` | 只改文档 | `docs: 更新 README 部署说明` |
| `style` | 样式/排版 | `style(card): 调整选中态阴影` |
| `test` | 只改测试 | `test(bot): 增加 L0 4 人局用例` |
| `chore` | 构建/配置 | `chore: 升级 vite 到 5.4` |

**尽量一次 commit 只改一件事**，这样 log 清晰。

---

## 🛠️ 本地验证清单（推 push 前）

每次 push 前建议跑一遍（避免 CI 挂掉被邮件骚扰）：

```bash
npm run build     # 构建能过
npm run test      # 单测全通过
# 不需要改 Tailwind 配置时可以跳过 lint，否则：
# npm run lint
```

---

## ⚙️ 特殊场景

### 1. 推失败说"rejected"（远端有新提交）

```bash
git pull --rebase
# 解决冲突（如果有）
git push
```

### 2. 想回滚到之前某个版本

```bash
# 看历史
git log --oneline | head -10

# 回滚到某个 commit（危险！会覆盖历史，仅自己独占仓库时用）
git reset --hard <commit-hash>
git push --force-with-lease
```

### 3. 临时分支试验新功能

```bash
git checkout -b feat/xxx    # 创建并切到新分支
# 改代码...
git push -u origin feat/xxx # 推上去但不触发 Pages 部署（workflow 只监听 main）

# 满意后合并回 main
git checkout main
git merge feat/xxx
git push                    # 这次推 main 触发部署
```

### 4. 手动触发部署（不改代码也想重跑一次）

- 打开 https://github.com/feifei21610/Twinum/actions/workflows/deploy.yml
- 右上角 **Run workflow** → 选 main → Run

---

## 🌐 域名与环境

| 环境 | URL | 说明 |
|---|---|---|
| 生产 | https://feifei21610.github.io/Twinum/ | main 分支推送后自动部署 |
| 本地 dev | http://localhost:5173 | `npm run dev` |
| 本地 preview | http://localhost:4173 | `npm run preview`（跑 dist/） |

> ⚠️ 注意仓库名 `Twinum` 首字母**大写**。URL 和 `vite.config.ts` 的 `base: '/Twinum/'` 必须匹配，否则线上资源 404。

---

## 📋 CI Workflow 结构

`.github/workflows/deploy.yml` 做的事：

```
push to main
    ↓
build job (ubuntu-latest)
    ├─ checkout
    ├─ setup Node 20 (缓存 npm)
    ├─ npm ci
    ├─ npm run test (vitest)
    ├─ npm run build (vite → dist/)
    └─ upload dist/ as Pages artifact
    ↓
deploy job
    └─ publish artifact → GitHub Pages
```

**测试失败 = 部署中止**，保证线上永远是绿的版本。

---

## 🆘 常见问题

### Q: 推了代码但线上没更新
1. 看 Actions 是不是绿了：https://github.com/feifei21610/Twinum/actions
2. 浏览器强制刷新：`Cmd+Shift+R`（清缓存）
3. 如果是 Service Worker 缓存，访问 `chrome://serviceworker-internals` 注销

### Q: Actions 报 "Get Pages site failed"
→ 仓库 Settings → Pages → Source 没选 "GitHub Actions"。改过去再重跑 workflow。

### Q: Actions 报 "npm test exit 1"
→ 本地先跑 `npm run test` 修好测试再 push。

### Q: 改了 `vite.config.ts` 的 base 但线上 404
→ base 必须与 URL 大小写完全一致：`'/Twinum/'`（大写 T）。

---

## 🚀 Fly.io 服务端部署

### 首次部署（只需做一次）

**前提：** 已安装 `flyctl`（`brew install flyctl`）并登录（`flyctl auth login`）

```bash
cd /Users/tangni/Documents/CodeBuddy_Workspace/twinum

# 1. 在 Fly.io 创建 app（首次）
fly launch --no-deploy --name twinum-server --region nrt

# 2. fly.toml 在 twinum/ 根目录，无需 --config 参数

# 3. 首次部署
fly deploy

# 4. 验证
curl https://twinum-server.fly.dev/health
# 应返回 {"status":"ok","time":"..."}
```

### 日常更新

有两种方式：

**方式 A（自动）：** push 到 main 且改动含 `packages/server/**` 或 `packages/shared/**`，`deploy-server.yml` 自动触发。

**方式 B（手动）：**
```bash
fly deploy
```

### Secrets 配置

```bash
# GitHub repo Settings → Secrets and variables → Actions 添加：
# 1. FLY_API_TOKEN（服务端 CI 部署用）
flyctl tokens create deploy -a twinum-server
# 把输出的 token 填入 GitHub Secrets "FLY_API_TOKEN"

# 2. VITE_SERVER_URL（前端构建注入用）
# 值：wss://twinum-server.fly.dev
# 在 GitHub Secrets 添加 "VITE_SERVER_URL"
```

### 常用 fly 命令

```bash
# 查看实时日志
fly logs --app twinum-server

# 查看机器状态（running/stopped）
fly status --app twinum-server

# 查看 Metrics（内存/CPU 占用）
fly dashboard --app twinum-server

# 回滚到上一个版本
fly releases --app twinum-server   # 看 release 列表
fly deploy --image <image-id> --app twinum-server

# SSH 进入容器调试
fly ssh console --app twinum-server
```

### 冷启动说明

`min_machines_running = 0` 表示无人访问时机器会 auto-stop，节省成本。
- 冷启动时间：约 2-5 秒
- 前端 `networkClient.init()` 已有重试逻辑，用户看到"短暂 Loading"而非白屏
- 如果冷启动体验不满意，可将 `min_machines_running = 1`（约 $2/月）

### 上线前 Checklist

- [ ] `npm run test` 全通过
- [ ] 本地 4 人局回归（含断线重连、Bot 接管）
- [ ] `docker build -f packages/server/Dockerfile -t twinum-server . && docker run -p 2567:2567 twinum-server` 镜像能跑起来
- [ ] `curl http://localhost:2567/health` 返回 `{"status":"ok",...}`
- [ ] `fly deploy` 成功，`curl https://twinum-server.fly.dev/health` 返回 ok
- [ ] GitHub Secrets 添加 `FLY_API_TOKEN` 和 `VITE_SERVER_URL`
- [ ] push main 触发前端 deploy.yml，DevTools Network 确认连接 `wss://twinum-server.fly.dev`
- [ ] 手机 4G + 电脑 WiFi 跨网真机测一局
- [ ] `fly logs` 观察 1 小时，无 uncaught exception，房间创建/释放数量匹配

### 成本控制

- 当前配置：shared-cpu-1x 256MB + min_machines=0 → **免费额度内**
- 建议在 Fly dashboard 设置 Spend Limit（$5/月），防意外超出
- `fly dashboard billing` 可查看用量

### 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 监听端口 | `2567` |
| `NODE_ENV` | 环境 | `production` |
| `ALLOWED_ORIGINS` | CORS 白名单（逗号分隔）| `https://feifei21610.github.io` |

如需添加新 origin（例如自定义域名）：
```bash
fly secrets set ALLOWED_ORIGINS="https://feifei21610.github.io,https://yourdomain.com" --app twinum-server
```
