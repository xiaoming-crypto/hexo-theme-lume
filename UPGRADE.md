# Lume 升级指南（0.13.x – 0.21.x → 1.0.0）

本文档用于帮助正在使用早期 `0.x` 版本的站点平滑升级到 `Lume 1.0.0`。

---

## 升级前检查清单

1. 确保你始终通过站点根目录的 `_config.lume.yml` 覆写配置，而没有直接改动 `themes/lume/` 内部文件；若曾直接修改主题源码，请先备份自定义补丁。
2. 确保 Node.js 版本 ≥ `18`，Hexo 版本 ≥ `7.0.0`。
3. 如使用主题源码同步工作流，可在替换或拉取新版主题后先执行 `npx hexo clean` 清除 Hexo 旧缓存（`db.json` 与 `public/`）。

---

## 破坏性变更与重要调整

### 1. 样式文件合并为单一 `lume.css`（`0.20.0` 起）

- 原先分拆加载的 `source/css/main.css` 与 `source/css/pop.css` 已合并并重构为单一 8 层原生样式表 [source/css/lume.css](./source/css/lume.css)，同时清除了废弃选择器。
- **迁移影响**：
  - 模板中只再加载 `/css/lume.css?v=<version>`，不要再注入对 `main.css` 或 `pop.css` 的自定义 preload/引用或覆盖脚本。
  - 如果你通过 Hexo Injector 注入自定义样式覆盖 Lume 默认变量，请将选择器挂载于 `:root` / `html[data-theme="dark"]` 并在 `lume.css` 之后加载。
  - 若站点部署了 CDN / Nginx 强缓存或 Service Worker，发布 `1.0.0` 后请确保刷新旧版 CSS/JS 缓存（主题默认使用 `?v=1.0.0` 查询参数自动破坏浏览器缓存）。

### 2. 人因交互边界收紧（`0.18.0` 起）

以下原本默认全局生效的强干预交互改为默认关闭或收束触发范围：

- **首屏滚轮吸附（`motion.heroSnap`）**：默认值由开启调整为 `false`。若习惯保留轻滑自动吸附到 `#latest` 的行为，请在 `_config.lume.yml` 中显式设置：

  ```yaml
  motion:
    heroSnap: true
  ```

- **自定义右键菜单（`contextMenu.enable`）**：默认值调整为 `false`（恢复浏览器原生右键菜单）。若需要开启，请显式设置 `contextMenu.enable: true`（桌面端按住 `Shift + 右键` 可临时穿透回原生菜单）。
- **点击纸屑范围（`motion.confettiScope`）**：新增开关，默认值为 `celebrate`（仅在友链钓鱼成功、复制代码/短链与打开打赏时触发）。如需恢复全站每次点击都撒纸屑，可设为 `confettiScope: all`。

### 3. 100% 国际化与自定义语言包（`1.0.0`）

- 模板与 `source/js/*.js` 中全部界面文案均已抽取至 `languages/zh-CN.yml` 与 `languages/en.yml`。
- 如果你在主题之外维护了第三方语言文件（如 `ja.yml` / `zh-TW.yml`），请对照最新的 [languages/zh-CN.yml](./languages/zh-CN.yml) 补齐 `nav.*`、`a11y.*`、`theme.*`、`home.*`、`stats.*`、`pager.*`、`reward.*`、`ctx.*` 等新增键。

---

## 新增可选配置项（按需添加到 `_config.lume.yml`）

```yaml
# 1. 代码块 2.0
code:
  lineNumbers: true
  wrap: false
  collapseLines: 22
  collapseHeight: 360

# 2. 按需数学公式与流程图（普通文章 0 KB 额外加载）
math:
  enable: true
mermaid:
  enable: true

# 3. 系列专栏、时效提醒与延伸阅读
post:
  related:
    enable: true
    count: 3
  outdatedDays: 365

# 4. 渐进增强 View Transitions
motion:
  viewTransitions: true

# 5. 新增 Waline 评论支持（可选 twikoo / giscus / waline）
comments:
  provider: waline
  waline:
    serverURL: "https://waline.example.com"
    lang: "zh-CN"
```

---

## 升级后验证步骤

1. 更新主题代码至 `v1.0.0`（或通过 `node tools/sync.mjs <blog>/themes/lume` 同步）。
2. 在博客根目录执行洁净构建：

   ```bash
   npx hexo clean
   npx hexo generate
   ```

3. 运行自动化 QA 脚本确认站点产物完整、双语词条对称且无旧样式残留：

   ```bash
   node themes/lume/tools/qa.mjs --site .
   ```

4. 本地运行 `npx hexo server` 抽检首页、归档、友链、关于、文章长文（含代码块/灯箱/目录）的明暗双色显示后即可部署上线。
