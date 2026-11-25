# Lume

> 一套活泼、可爱、带点调皮的 Hexo 贴纸手账主题。

Lume 用「贴纸手账」的方式重做博客：奶油纸底、葡萄墨字、取自站点 logo 的橙色调，粗描边、硬投影、手绘 doodle 与弹簧式动效。它不是极简杂志，而是一个愿意和读者打招呼的小房间。

在视觉之外，Lume 保留了完整的技术底座：站内无刷路由、内置搜索、明暗双主题、SEO、性能与无障碍降级；并补齐了音乐胶囊、音乐页、友链/钓鱼/朋友圈、开往、随机文章、备案信息、颜色 API 与评论系统。

- 预览：`hexo server` 后访问 `http://localhost:4000`
- 许可证：[MIT](./LICENSE)
- 适配：Hexo 7.x，Node.js 18+

---

## 设计语言

- **奶油纸 + 葡萄墨**：低饱和纸色背景，深紫墨色正文，避免纯黑白的生硬。
- **品牌橙**：主色默认取自项目 logo 的橙色（`#f5822a`），可在配置中替换。
- **贴纸卡片**：2px 描边 + 4px 硬投影 + 轻微旋转，像贴在手账上的纸片。
- **吉祥物**：页头统一使用带透明通道的站点头像/logo；音乐胶囊与音乐页的唱片使用当前专辑封面，不再用 logo 顶替。
- **弹簧动效**：统一的 `cubic-bezier` 弹性曲线，覆盖页面进出、卡片悬停、菜单、播放器与纸屑。
- **深紫暗色**：暗色模式使用深紫底与糖果色点缀，而不是简单反色。

---

## 特性

- **完整页面**：首页、文章、归档、分类、标签、关于、音乐、友链、404；搜索为全局浮层，不单独生成搜索页。
- **贴纸手账外观**：贴纸统计、跑马灯、doodle、纸屑点击动效。
- **站内无刷新路由**：预取 + 缓存 + `history` 管理 + 滚动恢复，页面切换带淡出/淡入。
- **音乐胶囊 + 音乐页**：读取 Meting / 网易云歌单；胶囊与页面唱片显示当前专辑封面；主接口超时自动切换备用接口，歌单缓存到 `localStorage`，路由切换不断播；记忆曲目与音量，不自动播放。
- **友链页**：分组友链卡片、站点截图悬停、钓鱼随机友文、Friend-Circle-Lite 朋友圈。
- **开往与随机文章**：顶部工具按钮直达开往；随机文章从站内索引抽取。
- **颜色系统**：品牌色、选中色、暗色强调色；文章页可按封面颜色调用颜色 API 驱动局部强调色。
- **评论**：Twikoo 或 giscus，进入视口懒加载；Twikoo 支持评论数。
- **内置搜索**：构建时生成 `search.json`，只提供居中浮层搜索（`Ctrl / Cmd + K`）。
- **备案信息**：页脚支持 ICP 与公安备案号。
- **SEO 基础**：canonical、Open Graph、Twitter Card、JSON-LD、RSS autodiscovery、sitemap 兼容。
- **可访问性**：跳转链接、可见焦点、ARIA 状态、键盘可用菜单与播放器，完整尊重 `prefers-reduced-motion`。
- **零依赖**：EJS + 原生 CSS/JS，不需要前端包管理器或打包器。

---

## 快速开始

1. 将主题目录放入站点 `themes/`：

   ```text
   your-blog/
   ├── _config.yml
   ├── source/
   └── themes/
       └── lume/
   ```

2. 修改站点根目录 `_config.yml`：

   ```yaml
   theme: lume
   ```

3. 在站点根目录创建 `_config.lume.yml`（推荐），只写需要覆盖的项：

   ```yaml
   accent: "#f5822a"
   accentDark: "#ffa45c"

   menu:
     - label: 首页
       path: /
     - label: 文章
       path: /archives/
     - label: 友链
       path: /link/
     - label: 音乐
       path: /music/
     - label: 关于
       path: /about/
     - label: 我的网盘
       path: https://example.com/
   ```

   `path` 以 `http://`、`https://` 或 `//` 开头时会自动按外链渲染（`target="_blank"` + `rel="noopener noreferrer"`，并带一个 ↗ 角标），其余按站内地址处理。

4. 安装模板渲染器（若尚未安装）：

   ```bash
   npm install hexo-renderer-ejs hexo-renderer-marked --save
   ```

5. 启动：

   ```bash
   hexo clean
   hexo server
   ```

> 主题默认配置位于 `themes/lume/_config.yml`，请通过站点根目录的 `_config.lume.yml` 覆盖。
>
> Hexo 会深度合并两份配置，但**数组会拼接**。因此主题默认把 `menu`、`hero.lines`、`social` 等数组留空；覆盖时请一次性写完整列表，不要只追加一项。

---

## 页面准备

Lume 为每种页面提供完整模板，但索引页与自定义页需要站点自身存在对应文件。

### 归档

安装并启用 `hexo-generator-archive` 即可自动生成 `/archives/`、按年/月归档与分页：

```yaml
archive_generator:
  per_page: 10
  yearly: true
  monthly: true
  daily: false
```

### 分类与标签

`source/categories/index.md`

```yaml
---
title: 分类
type: categories
---
```

`source/tags/index.md`

```yaml
---
title: 标签
type: tags
---
```

### 关于

`source/about/index.md`

```yaml
---
title: 关于
type: about
---
```

关于页的姓名、头像、简介、Facts、Skills 可在 `_config.lume.yml` 的 `about` 中统一配置，也可在页面 front-matter 中逐项覆盖：

```yaml
---
title: 关于
type: about
name: 你的名字
role: 开发者 · 写作者
bio: 一句话介绍。
avatar: /images/avatar.jpg
facts:
  - label: 坐标
    value: 中国 · 山西
skills:
  - 前端
  - 运维
---
```

### 音乐页

`source/music/index.md`

```yaml
---
title: 音乐馆
type: music
description: 一边听歌，一边逛逛。
---
```

页面会显示当前播放卡、进度与全部歌单。音乐页与左下角音乐胶囊共用同一个 `<audio>`，跳转页面不会中断播放。

### 友链页

`source/link/index.md`

```yaml
---
title: 友情链接
type: link
description: 互联网上的邻居们，都是有趣的人。
---
```

页面正文会显示在友链分组与朋友圈之后，适合放申请说明和免责声明。

### 搜索与 404

无需创建页面。主题的 generator 会自动生成：

- `/search.json` —— 搜索索引（配合页头浮层搜索）
- `/404.html` —— 404 页面（若站点已有 `source/404.md` 则不会覆盖）

---

## 配置说明

完整默认值见 [`_config.yml`](./_config.yml)。

### 基础

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `scheme` | `auto` | `auto` 跟随系统；`light` / `dark` 强制模式 |
| `accent` | `#f5822a` | 品牌主色，默认取自 logo 橙 |
| `accentDark` | `#ffa45c` | 暗色模式下的品牌主色 |
| `menu` | 空 | 顶部导航，`label` + `path`；留空使用内置精简导航 |
| `brand.logo` | 空 | 页头 logo；请使用带透明通道的图片（如 `android-chrome-192x192.png`），每页只出现一次 |
| `brand.mark` | 空 | 无 logo 时显示的印章单字 |
| `brand.showTitle` | `true` | 是否在 logo 旁显示站点标题 |

```yaml
scheme: auto

brand:
  logo: /images/logo.png
  mark: 你
  showTitle: true
```

### 首页

```yaml
hero:
  eyebrow: 欢迎来到我的小站
  lines:
    - 把折腾，
    - 写成教程。
  intro: 记录技术、分享与一些值得留下的片段。
```

- `lines` 为空时使用站点标题；每行一项，建议不超过两行。

### 列表与文章

```yaml
list:
  showExcerpt: true
  excerptLength: 128
  showCoverPeek: true   # 桌面端悬停跟随光标的封面浮窗
  showReadingTime: true
  showThumb: true       # 列表卡片中始终显示封面缩略图

post:
  showCover: true
  showToc: true
  showReadingTime: true
  showWordCount: true
  showUpdated: true
  prevNext: true
  license: 本文采用 CC BY-NC-SA 4.0 许可协议，转载请注明出处。
```

`post.license` 留空则不显示版权框。

### 打赏

文章底部可显示一个贴纸风打赏入口，弹层里提供微信 / 支付宝切换与收款码展示。

> **重要：这里只展示收款码图片，不包含任何支付接口，不会产生真实扣款，也不会收集支付信息。**

```yaml
reward:
  enable: true
  title: 请我喝杯咖啡
  intro: 如果这篇内容帮到了你，可以请我喝杯咖啡。
  note: 扫码仅用于展示收款码，本站不会发起扣款，也不会收集任何支付信息。
  methods:
    wechat:
      label: 微信
      image: /images/reward/wechat.png
    alipay:
      label: 支付宝
      image: /images/reward/alipay.jpg
```

- 主题**不内置任何收款码**；请把你自己的收款码图片放进站点 `source/images/reward/`，再按上面的路径填写。
- `image` 也可以填完整 https 地址；没有配置图片的方式不会出现在弹层里。
- 弹层只做支付方式切换与收款码展示，不提供金额选择、不发起支付请求。
- 只有 `enable: true` 且至少配置了一个支付方式时才显示入口。默认关闭。

### 搜索

```yaml
search:
  enable: true
  maxResults: 12
```

顶部搜索按钮会打开居中浮层，也支持 `Ctrl / Cmd + K`。

### 音乐胶囊与音乐页

```yaml
music:
  enable: true
  id: "your-playlist-id"
  server: netease
  volume: 0.7
  api: "https://meting.example.com/api"
  # 主接口超过 12s 未返回时自动尝试的备用 Meting 地址
  fallbackApi: ""
  playlistUrl: "https://music.163.com/#/playlist?id=your-playlist-id"
  capsule: true
```

- 主题请求 `{api}?server={server}&type=playlist&id={id}`，按 Meting 歌单接口返回数组，读取 `name`、`artist`、`url`、`pic`。
- `api` 可替换为自建 Meting 地址；`server` 支持 `netease` / `tencent` / `kugou` 等 Meting 后端。
- `fallbackApi` 在主接口超时或返回空歌单时自动接管，留空则只请求主接口。
- 成功拉取的歌单会缓存到 `localStorage`（10 分钟内直接复用，之后后台刷新），胶囊与音乐页的唱片使用 `pic` 专辑封面。
- `capsule: false` 会隐藏左下角胶囊，但音乐页仍可使用。
- 播放器不会自动播放；曲目索引与音量保存在 `localStorage`。
- 歌单接口不可达时，音乐页显示失败提示与「重新加载」按钮；胶囊只显示黑胶底，不会回退成 logo。

### 友链、钓鱼与朋友圈

```yaml
friends:
  # Friend-Circle-Lite 后端根地址
  api: "https://fc.example.com/"
  # 朋友圈每次展示的文章数
  pageSize: 12
  # 钓鱼玩法
  fishing: true
  tips:
    - 钓到了绝世好文！
    - 你击败了巨龙，在巢穴中发现了
    - 今日双色球中了两千万，预测全靠
```

- 主题会请求 `{api}/all.json`，读取 `article_data` 数组中的 `title`、`link`、`author`、`avatar`、`created`。
- 若 `api` 本身以 `.json` 结尾，则直接作为数据地址，不再拼接 `all.json`。
- 钓鱼从全部友链文章中随机抽取一篇；`tips` 为空时只显示文章标题。
- 朋友圈每次随机展示 `pageSize` 篇文章，点击「换一批」重新抽取。
- 建议自行部署 [Friend-Circle-Lite](https://github.com/Rock-Candy-Tea/hexo-circle-of-friends)，或确认公共实例允许跨域访问。

### 友链数据文件

友链卡片读取站点 `source/_data/link.yml`：

```yaml
- class_name: 朋友们
  class_desc: 互联网上的邻居
  flink_style: flexcard   # flexcard / telescopic / anzhiyu
  link_list:
    - name: Hexo
      link: https://hexo.io/zh-tw/
      avatar: https://hexo.io/logo.svg
      descr: 快速、简洁且高效的博客框架
      siteshot: https://s0.wp.com/mshots/v1/https://hexo.io/?w=800&h=600
      color: "#0e83cd"
      tag: 框架
      recommend: true
      lost_contact: false
    - name: 一位朋友
      link: https://example.com/
      avatar: https://example.com/avatar.png
      descr: 随便写写
```

- `siteshot` 存在时，卡片悬停会显示站点截图。
- `recommend` 显示星标；`lost_contact: true` 会让卡片置灰。
- `flink_style` 会作为分组容器的修饰类，方便自定义布局。

### 开往与随机文章

```yaml
travelling:
  enable: true
  url: "https://www.travellings.cn/go.html"

randomPost:
  enable: true
```

- 开往按钮出现在页头工具区与移动端菜单，直接新窗口打开。
- 随机文章会读取 `/search.json`，从站内文章中等概率抽取一篇，再走站内无刷路由。

### 页脚与备案

```yaml
footer:
  note: 感谢阅读。保持好奇，继续建造。
  since: ""          # 留空自动取最早文章年份
  poweredBy: true
  license: ""
  icp:
    text: 京ICP备00000000号-1
    link: https://beian.miit.gov.cn/
  police:
    text: ""
    link: ""
```

- `since` 留空时，从最早一篇文章的年份开始显示版权区间。
- `icp` / `police` 留空则不渲染对应备案信息。
- `social`、`rss` 同样在页脚展示：

```yaml
social:
  - name: GitHub
    url: https://github.com/yourname
  - name: 邮箱
    url: mailto:you@example.com

rss: /atom.xml
```

### 颜色

```yaml
accent: "#f5822a"
accentDark: "#ffa45c"

color:
  textSelection: "#ffd166"
  mainTone:
    enable: true
    mode: api
    api: "https://color.example.com/api?img="
    coverChange: true
```

- `accent` / `accentDark` 驱动按钮、链接、进度条与高亮。
- `textSelection` 是文本选中背景色。
- `mainTone` 开启后，文章页会用封面图请求颜色 API：`{api}{URL 编码后的封面地址}`，读取返回的 `RGB` 字段（如 `{"RGB":"#4e5351"}`），把该颜色写为文章局部的 `--accent`。
- API 请求失败、封面缺失或 `coverChange: false` 时，自动保留全局品牌色。
- 也可在文章 front-matter 写 `main_color: "#d9afaf"` 跳过请求。

### 评论

```yaml
comments:
  enable: true
  provider: twikoo        # twikoo / giscus
  lazyload: true          # 进入视口再加载

  twikoo:
    envId: "https://twikoo.example.com"   # Twikoo 部署地址
    region: "ap-shanghai"
    lang: "zh-CN"
    cdn: ""               # 留空使用主题内置 CDN 列表
    count: true           # 在文章 meta 显示评论数
    visitor: false

  giscus:
    repo: username/repo
    repoId: R_xxx
    category: Announcements
    categoryId: DIC_xxx
    mapping: pathname
    strict: "0"
    reactionsEnabled: "1"
    inputPosition: top
    theme: preferred_color_scheme
    lang: zh-CN
```

- Twikoo 的 `envId` 填完整部署地址；主题会自动加载脚本、初始化并读取评论数。
- giscus 需要仓库开启 Discussions，并填写 `repoId` 与 `categoryId`。
- 未配置对应字段时评论区不会输出，页面其余部分不受影响。

### 图标与 SEO

```yaml
favicon: /images/favicon-32x32.png
appleTouchIcon: /images/apple-touch-icon.png

seo:
  ogImage: https://example.com/share.jpg
  twitter: "@yourname"
  keywords: 前端, 教程
  robots: "index, follow"
```

### 统计

留空则不注入任何脚本：

```yaml
analytics:
  google: ""            # G-XXXXXXX
  umami:
    src: ""             # https://umami.example.com/script.js
    websiteId: ""
```

### 动效

```yaml
motion:
  pageTransitions: true
  reveal: true
  heroParallax: true
  peek: true
  themeRipple: true
  confetti: true        # 点击链接/按钮时的纸屑
```

无论开关如何，系统级 `prefers-reduced-motion: reduce` 始终优先；纸屑、视差与位移动画会被关闭。

---

## 文章 Front-matter

```yaml
---
title: 文章标题
date: 2026-01-01 10:00:00
tags:
  - 教程
categories:
  - 技术
cover: https://example.com/cover.jpg
description: 列表与分享卡片使用的摘要。
keywords: 关键词1, 关键词2
main_color: "#d9afaf"   # 可选，跳过颜色 API
---
```

- `cover`：列表缩略图、悬停浮窗、文章封面、分享图与颜色 API 的取色依据。
- `description`：优先用于列表摘要、SEO 描述与分享文案。
- 正文中的 `> [!TIP]`、`> [!WARNING]` 等块引用会转换为 Callout。
- 独立图片段落会自动加 `loading="lazy"`，`alt` 会作为图注。

---

## 外部服务与降级

| 能力 | 默认依赖 | 失败时的表现 |
| --- | --- | --- |
| 音乐 | Meting 歌单接口 | 胶囊/音乐页显示加载失败，不阻塞页面 |
| 朋友圈 / 钓鱼 | Friend-Circle-Lite `all.json` | 显示「今日鱼塘有点安静」 |
| 文章取色 | 颜色 API | 保留全局品牌色 |
| 评论 | Twikoo / giscus | 显示加载失败提示 |
| 随机文章 | 主题生成的 `search.json` | 回退到归档页 |
| 友链截图 | 外部截图服务 | 仅不显示悬停截图 |

所有能力都是渐进增强：脚本不可用或接口失败时，正文、导航与搜索仍可正常使用。

---

## 目录结构

```text
themes/lume/
├── _config.yml              # 主题默认配置
├── package.json
├── LICENSE
├── README.md
├── languages/
│   ├── zh-CN.yml
│   └── en.yml
├── layout/
│   ├── layout.ejs           # 全局壳、主题初始化、页脚/搜索/浮窗
│   ├── index.ejs            # 首页
│   ├── post.ejs             # 文章详情
│   ├── page.ejs             # 通用页 / 分类 / 标签 / 关于 / 音乐 / 友链
│   ├── archive.ejs          # 归档
│   ├── category.ejs         # 分类文章列表
│   ├── tag.ejs              # 标签文章列表
│   ├── 404.ejs
│   └── _partial/
│       ├── head.ejs         # meta / OG / JSON-LD
│       ├── header.ejs       # logo、导航、工具按钮
│       ├── footer.ejs       # 备案、社交、订阅
│       ├── entry.ejs        # 列表卡片
│       ├── pagination.ejs
│       ├── about.ejs
│       ├── capsule.ejs      # 全局音乐胶囊
│       ├── music.ejs        # 音乐页
│       ├── links.ejs        # 友链 / 钓鱼 / 朋友圈
│       └── search.ejs       # 搜索浮层
├── scripts/
│   ├── helpers.js           # 摘要、阅读时长、字数
│   ├── filters.js           # Callout、图片、外链
│   └── generators.js        # search.json / 404
└── source/
    ├── css/main.css         # 基础布局与既有组件
    ├── css/pop.css          # 贴纸手账皮肤与全部新动效
    └── js/
        ├── app.js           # 路由、主题、搜索、目录、代码块、滚动、评论
        └── extras.js        # 音乐、随机文章、钓鱼、朋友圈、取色、纸屑
```

---

## 定制

### 颜色与圆角

基础 token 在 `source/css/main.css` 顶部，贴纸皮肤在 `source/css/pop.css` 顶部：

```css
:root {
  --paper: #fffaf0;
  --ink: #2e2745;
  --accent: #f5822a;
  --yellow: #ffd166;
  --pink: #ff8fab;
  --mint: #7ee0c0;
  --radius: 18px;
  --shadow-hard: 4px 4px 0 var(--line);
}
```

修改 `_config.lume.yml` 的 `accent` / `accentDark` 会同步浏览器 `theme-color`、按钮与高亮。

### 文案与多语言

- 界面文案：`languages/zh-CN.yml`、`languages/en.yml`
- 站点语言：根目录 `_config.yml` 的 `language`
- 新增语言：复制语言文件并翻译，文件名与 `language` 一致

### 关闭某类动效

在 `_config.lume.yml` 的 `motion` 中关闭对应项；也可在自定义 CSS 中覆盖 `--dur-*` 为 `0s`。

---

## 性能与 SEO

- 无 Web Font、无 CSS/JS 框架、无运行时渲染依赖。
- 图片进入视口才淡入；非首屏图片默认 `loading="lazy"`。
- 站内链接悬停/聚焦时预取，返回时使用缓存。
- 音乐、评论、朋友圈按需请求，不阻塞首屏。
- 文章页输出 `BlogPosting` 与 `BreadcrumbList`，首页输出 `WebSite` + `SearchAction`。
- 404 页面输出 `noindex, follow`。
- 建议搭配 `hexo-generator-sitemap`、`hexo-generator-feed` 使用。

---

## 浏览器支持

- 现代 Chrome / Edge / Firefox / Safari
- View Transitions、`dialog`、`IntersectionObserver` 均有降级路径
- 不支持 JavaScript 时，页面仍可正常阅读与导航

---

## 许可证

[MIT](./LICENSE) © Lume contributors

你可以自由使用、修改与分发，保留版权声明即可。若用于商业项目，建议在站点页脚保留主题署名（非强制）。

---

## 致谢

贴纸手账的视觉方向、音乐胶囊、友链钓鱼与朋友圈玩法，灵感来自个人博客社区里那些真正好玩的角落；实现与文案均为 Lume 重新编写。感谢 Hexo、Meting、Twikoo、giscus 与 Friend-Circle-Lite。
