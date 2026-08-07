# 星径 · 塔罗 手机端 R2 同步代理（Cloudflare Worker）

手机端是纯浏览器 / PWA，没有安全的密钥存放位置。如果让前端直接持有 R2 的
Access Key / Secret，任何人按 F12 就能拿走你桶的权限。这个 Worker 作为**代理**
保管密钥，前端只调你自己的 Worker 域名并带一个 `SYNC_TOKEN` 令牌。

## 为什么用 Worker 而不是前端直连 R2

- 密钥不落地前端（避免泄露）
- 不需要前端配 CORS（请求都打到你自己的 Worker 域名）
- 不需要在前端引入 AWS SDK（Worker 用原生 R2 绑定）
- 对象键布局和桌面端**完全一致**，共用一个桶即可跨设备同步

键布局：`readings/<id>.json`、`folders/<id>.json`（桶根）

## 部署步骤

1. 安装 wrangler（需要 Node）：
   ```bash
   npm i -g wrangler
   wrangler login
   ```

2. 改 `wrangler.toml` 里的 `bucket_name` 为你已有的 R2 桶名（与桌面端同一个桶）。

3. 设置同步令牌（会当作 secret 注入，**不要写进代码**）：
   ```bash
   npx wrangler secret put SYNC_TOKEN
   # 提示输入时，随便设一个强随机串，例如：openssl rand -hex 32
   ```

4. 部署：
   ```bash
   npx wrangler deploy
   ```
   部署完会得到一个域名，形如 `https://tarot-r2-sync.<你的子域>.workers.dev`。

## 在手机端填写

打开手机端 App → 设置 → Cloudflare R2 云同步：

- **Worker URL**：上面得到的 Worker 域名（如 `https://tarot-r2-sync.xxx.workers.dev`）
- **Bucket 名称**：你的桶名
- **Sync Token**：第 3 步设置的同一个 `SYNC_TOKEN`
- 勾选「启用 R2 自动同步」→ 保存 → 测试连接 → 立即同步

## API 速览（浏览器端 `WorkerR2Client` 调用）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/objects?prefix=readings/` | 列出前缀下的对象 |
| GET | `/objects?key=readings/<id>.json` | 读取单个对象（404 表示不存在） |
| PUT | `/objects?key=readings/<id>.json` | 写入 JSON |
| DELETE | `/objects?key=readings/<id>.json` | 删除对象 |

所有 `/objects` 请求必须带 `Authorization: Bearer <SYNC_TOKEN>`，否则返回 401。
