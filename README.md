# 🎵 Rhythm_Sync — 歌单音游匹配器

**[English](./README_EN.md)** | 中文

> 看看你的歌单里，有多少歌曲在街机音游里出现过？

**Rhythm_Sync** 是一个音乐歌单与街机音游曲库的匹配工具。粘贴你的网易云音乐、QQ音乐或B站收藏夹链接，即刻发现哪些歌曲出现在了 maimai、CHUNITHM、ONGEKI、太鼓の達人等街机音游中。

## ✨ 功能特色

- 🎮 **多游戏支持** — maimai DX（国际/日服/国服）、CHUNITHM（国际/日服）、ONGEKI、太鼓の達人
- 🔗 **多平台输入** — 支持网易云音乐、QQ音乐、B站收藏夹链接，也可直接粘贴歌曲列表
- 🔍 **智能匹配** — 精确匹配 + 模糊匹配（Fuse.js），自动处理标题变体、翻译差异
- 📊 **音游浓度** — 计算你的歌单与音游曲库的重合度，看看你的"音游浓度"有多高
- 🤖 **AI 锐评** — 基于匹配结果生成趣味评价（可选，需配置 API Key）
- 🖼️ **分享卡片** — 一键生成精美分享图片，含二维码，可直接发送给朋友
- 🌐 **中英双语** — 完整的中文/英文界面
- ⚡ **实时进度** — Worker 多线程匹配 + SSE 流式推送，实时查看匹配进度

## 🎮 支持的游戏

| 游戏 | 版本 |
|------|------|
| maimai DX | 国际服 / 日服 / 国服 |
| CHUNITHM | 国际服 / 日服 |
| ONGEKI | 日服 |
| 太鼓の達人 | — |

## 📖 使用方式

1. 打开网页，粘贴你的 **网易云 / QQ音乐 / B站** 链接（或手动输入歌曲列表）
2. 选择要匹配的歌单
3. 等待匹配完成，浏览各音游的匹配结果
4. 可选：生成分享图片，炫耀你的音游浓度 🎯

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19、TypeScript 5.9、Vite 7、Tailwind CSS 4、Framer Motion、i18next |
| 后端 | Node.js、Express 5、Worker Threads、Fuse.js / fuzzysort |
| 图片生成 | Puppeteer、Sharp、QRCode |
| 音乐平台 | NeteaseCloudMusicApi（网易云）、QQ音乐 / B站 API |

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- npm

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/你的用户名/Rhythm_Sync.git
cd Rhythm_Sync

# --- 后端 ---
cd server
npm install
cp .env.example .env   # 按需编辑 .env
npm run dev             # 默认运行在 http://localhost:3002

# --- 前端（新开一个终端）---
cd ../frontend
npm install
npm run dev             # 默认运行在 http://localhost:5173
```

### 环境变量

复制 `server/.env.example` 为 `server/.env`，按需修改：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_ACCESS_PASSWORD` | 访问密码，留空则无需验证 | — |
| `SILICONFLOW_API_KEY` | AI 锐评 API Key，留空则使用本地文案 | — |
| `SILICONFLOW_API_URL` | AI API 地址 | `https://api.siliconflow.cn/v1/chat/completions` |
| `SILICONFLOW_MODEL` | AI 模型 | `Pro/deepseek-ai/DeepSeek-V3` |
| `PUBLIC_WEB_URL` | 对外网站地址（用于分享图二维码跳转） | 自动推导（如 `http://当前域名:5173`） |

## 📁 项目结构

```
Rhythm_Sync/
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── config/         # 游戏配置
│   │   ├── i18n/           # 国际化文案
│   │   ├── services/       # API 调用
│   │   └── utils/          # 工具函数
│   └── public/             # 静态资源（Logo、背景等）
├── server/                 # Node.js 后端
│   ├── index.js            # Express 主服务
│   ├── match_worker.js     # 匹配 Worker 线程
│   ├── utils.js            # 标题规范化工具
│   ├── config/             # 数据源配置
│   └── public/             # 管理页面
└── API_DOCS.md             # API 文档
```

## 📸 截图

> 将截图放入 `docs/screenshots/` 目录并保持以下文件名。

### 首页
![首页](./docs/screenshots/home.png)

### 歌单选择
![歌单选择](./docs/screenshots/playlist.png)

### 匹配结果
![匹配结果](./docs/screenshots/result.png)

### 分享卡片
![分享卡片](./docs/screenshots/share-card.png)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目基于 [GPL-3.0](./LICENSE) 许可证开源。

## 🙏 致谢

- 曲库数据来源：[Diving-Fish](https://www.diving-fish.com/)、[OTOGE-DB](https://otoge-db.com/)、[Reiwa](https://reiwa.f5.si/)、[Taiko Wiki](https://taiko.wiki/) 等
- 游戏 Logo 和素材版权归各游戏版权方所有，详见 `frontend/public/` 下的 CREDITS.md
