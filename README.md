# Lume

> 一套活泼、精致、面向长文深阅读与高对比可访问性的 Hexo 贴纸手账主题。

Lume 用「贴纸手账」重塑个人博客的秩序感与人情味：奶油纸底、深紫葡萄墨字、取自站点 logo 的活力橙，结合 2px 清晰描边、硬朗纸片投影与克制分层的弹簧微动效。

在鲜明美学之外，Lume 坚持**零前端构建依赖、零运行时框架开销**的设计原则：全站采用单一 8 层原生样式表 [lume.css](./source/css/lume.css) 与双文件轻量原生脚本，同时提供 PJAX + 渐进 View Transitions 路由、Search 2.0、代码块 2.0、原生 `<dialog>` 图片灯箱与专注阅读、按需懒加载 KaTeX / Mermaid、Twikoo / Giscus / Waline 三端评论、音乐胶囊、友链钓鱼与 100% 中英双语支持。

- **版本**：`1.1.0`（从旧版迁移请查阅 [UPGRADE.md](./UPGRADE.md)）
- **适配**：Hexo 7.x / 8.x，Node.js 18+
- **预览**：`hexo clean && hexo server` 后访问 `http://localhost:4000`
- **许可证**：[MIT](./LICENSE)

---

## 设计系统与视觉架构

- **单一 8 层原生样式表（[source/css/lume.css](./source/css/lume.css)）**：按 `Tokens → Reset & Base → Layout Shell → Components → Pages → Motion → Dark Theme → Responsive & Print` 严格分层，消除双层样式覆盖冗余。
- **WCAG AA 对比度校准**：明暗双主题下的辅助文字（`--ink-soft`）、强调色文字（`--accent-text`）、主色前景（`--on-accent`）与高饱和黄/薄荷/粉胶囊前景（`--on-bright`）均经过对比度校准（≥ 4.5:1），并全面启用 `tabular-nums` 等宽数字排版。
- **三层动效令牌**：
  - `--ease-snap` / `--dur-snap`（`0.14s`）：用于搜索条目、代码块按钮、工具栏、选项卡、右键菜单等高频微交互，干脆不粘滞；
  - `--ease-smooth` / `--dur-smooth`（`0.28s`）：用于面板抽屉、阅读进度条、侧边目录滑块与跨页 View Transitions；
  - `--ease-spring` / `--dur-spring`（`0.42s`）：保留给顶部导航橙色胶囊与标志性手账卡片、贴纸的物理微弹。
- **统一内联矢量图标**：通过 `lume_icon` 辅助函数渲染统一 24×24 圆角描边 SVG 图标，功能 UI 与手账装饰贴纸语义分离。

---

## 核心特性

### 阅读体验与富文本
- **文章页面功能**：顶部阅读进度条（`.read-progress`）、可跨页记忆的「专注阅读 / 退出专注」宽屏单栏切换、一键复制文章短链、系列专栏折叠导航（`series` / `series_order`）、同标签/分类加权延伸阅读推荐（`post.related`）、文章置顶角标（`sticky`）以及可配置过时提醒（`post.outdatedDays`）。
- **代码块 2.0**：完整兼容 Hexo 原生 `highlight.js` 与 `PrismJS`，内建明暗双套语法高亮 Token；支持 `figcaption` 文件名胶囊、`换行 / 取消换行` 切换、CSS Counter 无漂移行号、超长代码块平滑折叠/展开（`code.collapseLines` / `code.collapseHeight`）与「复制中 → 已复制」状态回执。
- **原生 `<dialog>` 图片灯箱与多图画廊**：支持 `{% gallery [cols] %}` 标签与连续多图段落自动网格化，点击图片通过 FLIP 动画飞入原生灯箱，支持页码、图注、键盘 `←`/`→`/`Esc`、双击/按钮 2× 缩放与拖拽平移。
- **按需公式与图表**：文章出现 LaTeX 分隔符或声明 `math: true` 时懒加载 KaTeX；存在 `mermaid` 代码块时懒加载 Mermaid 并随明暗主题自动重绘，普通文章 0 KB 额外开销。
- **更多富文本扩展**：GitHub 风格 Callouts（`> [!TIP]` / `[!NOTE]` / `[!WARNING]` / `[!IMPORTANT]` / `[!CAUTION]` / `[!INFO]` / `[!SUCCESS]` / `[!DANGER]`）、支持组间同步的 `{% tabs [syncGroup] %}` 标签页、任务列表复选框、注脚返回高亮与斑马纹表格。

### 交互逻辑、路由与性能
- **PJAX + View Transitions 渐进增强**：使用 `AbortController` 与请求序号并发调度悬停预取与无刷跳转；支持浏览器原生 `document.startViewTransition` 独立命名区域过渡（顶栏导航与音乐胶囊稳定不动），并在与主题切换圆形波纹同时触发时安全清理冲突；顶栏橙色胶囊（`.site-nav__pill`）与侧边目录滑块（`.toc__indicator`）均随状态平滑滑行跟随。
- **防闪烁智能 Reveal 与离屏节能**：首屏与视口上方元素同步就位，滚动中通过兜底扫漏确保零透明滞留；借助 `IntersectionObserver`、`visibilitychange` 与面板展开门控自动暂停视口外及后台标签页的无限循环动画。
- **零布局偏移（CLS < 0.02）**：构建期通过 [filters.js](./scripts/filters.js) 自动解析站内本地图片（PNG / JPEG / GIF / WebP / SVG）固有宽高并注入 `width`/`height`，配合封面 `16 / 9` 固定比例与纸面微光占位消除加载跳变。
- **Search 2.0**：构建期生成 `/search.json`，支持 `Ctrl / Cmd + K` 与 `/` 快捷键唤起居中浮层，提供关键词上下文摘要高亮（KWIC）、最近搜索历史（可清空）与 `?q=` 深链直达（对齐首页 JSON-LD `SearchAction`）。
- **克制人因边界**：整屏滚轮吸附（`motion.heroSnap`）与自定义右键菜单（`contextMenu.enable`，支持按住 `Shift + 右键` 穿透原生菜单）默认关闭、按需开启；纸屑动效通过 `motion.confettiScope` 默认收束为仅庆祝动作（钓鱼、复制、打赏）触发；明暗切换贴合 `auto` 跟随系统状态并弹出轻提示（Toast）。

### 完整页面与生态
- **内置页面与组件**：首页、文章详情、年份归档、分类、标签云、关于页、音乐胶囊与音乐页（Meting API 主备切换 + `localStorage` 缓存）、友链与钓鱼/朋友圈（Friend-Circle-Lite）、开往、随机文章、全局 Toast 与自动生成的 `/404.html`。
- **评论三强兼容**：支持 **Twikoo**、**Giscus** 与 **Waline**（按视口懒加载、适配站点明暗主题与样式变量，支持 Twikoo 评论/阅读数读取）。
- **SEO 与 100% 双语国际化**：完整的 `canonical`、`Open Graph`、`Twitter Card`、`JSON-LD`（`BlogPosting`、`BreadcrumbList`、`WebSite` + `SearchAction`）、`theme-color` 随明暗切换实时同步；内置完整的简体中文（`zh-CN`）与英文（`en`）语言包，模板与脚本无硬编码 UI 中文。

---

## 快速开始

1. 将主题放入站点 `themes/lume/` 目录：

   ```bash
   git clone https://github.com/xiaoming-crypto/hexo-theme-lume.git themes/lume
   ```

2. 修改站点根目录 `_config.yml`：

   ```yaml
   theme: lume
   language: zh-CN   # 可选 zh-CN 或 en
   ```

3. 安装必备渲染器与推荐插件：

   ```bash
   npm install hexo-renderer-ejs hexo-renderer-marked hexo-generator-archive --save
   ```

4. 在站点根目录创建 `_config.lume.yml` 覆盖默认配置（**不要直接修改 `themes/lume/_config.yml`**，以便后续平滑升级）。注意 Hexo 对 YAML 中的数组会拼接而非覆盖，配置 `menu`、`hero.lines`、`social` 等数组时请写完整列表。

5. 洁净构建并本地预览：

   ```bash
   npx hexo clean
   npx hexo server
   ```

---

## 页面准备

| 页面 | 路径 | Front-matter 配置 |
| --- | --- | --- |
| 归档 | `/archives/` | 安装 `hexo-generator-archive` 即可自动生成 |
| 分类 | `source/categories/index.md` | `title: 分类`、`type: categories` |
| 标签 | `source/tags/index.md` | `title: 标签`、`type: tags` |
| 关于 | `source/about/index.md` | `title: 关于`、`type: about`（支持 `avatar`/`name`/`role`/`bio`/`facts`/`skills`） |
| 音乐 | `source/music/index.md` | `title: 音乐`、`type: music` |
| 友链 | `source/link/index.md` | `title: 友链`、`type: link`（数据放在 `source/_data/link.yml`） |
| 搜索 / 404 | `/search.json`、`/404.html` | 由主题 [generators.js](./scripts/generators.js) 自动生成（如站点已有 `source/404.md` 则不覆盖） |

---

## 配置速览

完整配置项与中文注释请参阅 [`_config.yml`](./_config.yml)。核心新特性摘要如下：

### 代码块、公式与图表

```yaml
code:
  lineNumbers: true
  wrap: false
  collapseLines: 22      # 超过 22 行自动折叠，设 0 关闭
  collapseHeight: 360    # 折叠最大高度（px）

math:
  enable: true
  katexCss: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
  katexJs: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
  autoRenderJs: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"

mermaid:
  enable: true
  js: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
```

### 评论（Twikoo / Giscus / Waline）

```yaml
comments:
  enable: true
  provider: waline       # twikoo / giscus / waline
  lazyload: true
  waline:
    serverURL: "https://waline.example.com"
    lang: "zh-CN"
    css: "https://cdn.jsdelivr.net/npm/@waline/client@3/dist/waline.css"
    js: "https://cdn.jsdelivr.net/npm/@waline/client@3/dist/waline.umd.js"
    reaction: false
    pageview: false
    comment: false
```

### 动效与交互边界

```yaml
contextMenu:
  enable: false          # 开启后按住 Shift + 右键可穿透使用浏览器原生菜单

motion:
  pageTransitions: true
  viewTransitions: true  # 渐进增强 View Transitions API
  reveal: true
  heroParallax: true
  heroSnap: false        # 默认关闭；按需开启整屏滚轮吸附
  peek: true
  themeRipple: true
  confetti: true
  confettiScope: celebrate  # celebrate（仅庆祝动作）/ all（全站点击）/ off（关闭）
```

### 文章 Front-matter 与短代码

文章支持以下常用字段：`title`、`date`、`updated`、`tags`、`categories`、`cover`、`coverCaption`、`description`、`keywords`、`sticky: 1`、`series: "专栏名"`、`series_order: 1`、`outdated: false`、`math: true`、`main_color: "#f5822a"`。

标签短代码：

```markdown
{% gallery 2 %}
![图注一](/img/a.png)
![图注二](/img/b.png)
{% endgallery %}

{% tabs pkg %}
<!-- tab npm -->
npm install hexo-theme-lume
<!-- endtab -->
<!-- tab pnpm -->
pnpm add hexo-theme-lume
<!-- endtab -->
{% endtabs %}
```

---

## 工程化与自动化自检

主题内置零依赖 Node.js（18+）自检与同步脚本，升级主题或二次开发前可直接运行：

```bash
# 1. 仅校验主题自身：JS 语法、CSS 括号平衡与令牌、i18n 双语对齐、硬编码中文清零、CHANGELOG 版本对齐
node tools/qa.mjs

# 2. 联动博客构建产物做全量回归校验（需先执行 hexo generate）
node tools/qa.mjs --site path/to/your-blog

# 3. 将主题仓安全镜像同步至博客站点的 themes/lume 并执行全量 SHA-256 校验（支持 --dry-run）
node tools/sync.mjs path/to/your-blog/themes/lume --dry-run
node tools/sync.mjs path/to/your-blog/themes/lume
```

也可在主题目录通过 `npm run qa` / `npm run sync -- <target>` 调用。

---

## 目录结构

```text
themes/lume/
├── _config.yml              # 主题默认配置
├── package.json             # 版本号与 qa / sync 脚本入口
├── README.md                # 使用文档
├── UPGRADE.md               # 版本升级迁移指南
├── CHANGELOG.md             # 版本更新日志
├── LICENSE
├── languages/
│   ├── zh-CN.yml            # 简体中文语言包
│   └── en.yml               # 英文语言包
├── layout/
│   ├── layout.ejs           # 全局壳、主题初始化、进度条、灯箱、目录抽屉、Toast
│   ├── index.ejs            # 首页
│   ├── post.ejs             # 文章详情（系列、延伸阅读、专注阅读、打赏、评论）
│   ├── page.ejs             # 通用页 / 分类 / 标签 / 关于 / 音乐 / 友链
│   ├── archive.ejs          # 年份归档
│   ├── category.ejs         # 分类列表
│   ├── tag.ejs              # 标签列表
│   ├── 404.ejs
│   └── _partial/
│       ├── head.ejs         # Meta / Canonical / OG / Twitter / JSON-LD
│       ├── header.ejs       # Logo、导航滑动胶囊、工具按钮与移动抽屉
│       ├── footer.ejs       # 统计、探索链接、备案、社交、RSS
│       ├── entry.ejs        # 文章列表卡片
│       ├── pagination.ejs
│       ├── about.ejs
│       ├── capsule.ejs      # 全局音乐胶囊
│       ├── music.ejs        # 音乐页
│       ├── links.ejs        # 友链 / 钓鱼 / 朋友圈
│       ├── search.ejs       # Search 2.0 居中浮层
│       └── comments.ejs     # Twikoo / Giscus / Waline 挂载器
├── scripts/
│   ├── helpers.js           # 字数、阅读时长、摘要、相关文章、系列专栏、矢量图标
│   ├── filters.js           # Callouts、本地图片固有宽高注入、多图自动网格、外链安全、标题锚点
│   ├── generators.js        # search.json / posts.json / 404.html
│   └── tags.js              # {% gallery %} 与 {% tabs %} 标签插件
├── source/
│   ├── css/
│   │   └── lume.css         # 单一 8 层原生样式表（Tokens 至 Responsive/Print）
│   └── js/
│       ├── app.js           # 路由与 VT、动效控制、搜索、目录滑块、灯箱、代码块、评论
│       └── extras.js        # 音乐播放器、友链钓鱼、朋友圈、封面取色、纸屑、右键菜单
└── tools/
    ├── qa.mjs               # 自动化质量与构建产物回归脚本
    └── sync.mjs             # 双仓安全同步与 SHA-256 校验脚本
```

---

## 浏览器支持与降级

- 完整支持现代 Chrome / Edge / Firefox / Safari。
- `document.startViewTransition`、`<dialog>`、`IntersectionObserver` 与外部 CDN 脚本（KaTeX / Mermaid / 评论）均提供渐进降级路径。
- 始终优先尊重系统级 `prefers-reduced-motion: reduce`；禁用 JavaScript 时正文、归档与基础导航仍保持完全可用。

---

## 致谢与许可证

感谢 Hexo、KaTeX、Mermaid、Meting、Twikoo、Giscus、Waline 与 Friend-Circle-Lite 等开源项目。

本项目以 [MIT](./LICENSE) 协议开源。
