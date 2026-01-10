# 🎨 Rhythm Overlap 前端重构需求文档

> **项目**: 网易云歌单 x 音游曲库重合度检测
> **对接人**: Duogeyu

## 1. 核心功能
这是一个单页应用 (SPA)，用于检测用户的网易云音乐歌单包含多少街机音游（maimai, CHUNITHM, ONGEKI, Taiko）的收录曲。
需要你重新设计并实现 UI，风格不限（偏向 maimai/音游风格更好），**重点是展示以下内容**。

## 2. 页面结构与内容

### A. 首页 (Input Step)
*   **输入框**: 让用户输入网易云音乐用户 ID (数字)。
*   **动作**: 点击“获取歌单”按钮。

### B. 歌单选择页 (Playlist Step)
*   **列表内容**: 展示用户的所有歌单。
    *   封面图 (Img)
    *   歌单名 (Text)
    *   歌曲数 (Number)
    *   创建者 (Text)
*   **动作**: 点击任意歌单开始匹配。

### C. 匹配结果页 (Result Step)
这是核心页面，包含以下模块：

1.  **游戏切换 Tab**:
    *   支持切换查看 5 个游戏的结果：`maimai (国际版)`, `maimai (国服)`, `CHUNITHM`, `ONGEKI`, `Taiko`。
    *   每个 Tab 需要显示：游戏名 + 匹配到的歌曲数量。
2.  **数据概览 (Stats)**:
    *   **重合度百分比**: (匹配数 / 歌单总数)
    *   **匹配数量**: (Count)
    *   **游戏总曲库**: (Count)
3.  **歌曲列表 (Grid/List)**:
    *   **已匹配列表**:
        *   显示封面、曲名、艺术家。
        *   **匹配类型标签**: `精确匹配` 或 `模糊匹配`。
    *   **未匹配列表** (可选显示): 歌单里剩下的歌。

### D. 歌曲详情弹窗 (Modal)
当用户点击某首已匹配的歌曲时弹出。
*   **核心展示**: 高清封面、曲名、艺术家。
*   **游戏信息**:
    *   版本 (Version, e.g. "maimai PLUS")
    *   分类 (Category, e.g. "东方Project")
    *   BPM (速度)
*   **试听播放器**: 播放网易云的试听片段 (URL 已提供)。

## 3. 可用数据字段 (JSON)

前端开发时，你可以直接使用以下数据结构：

```typescript
// 单首匹配结果
interface MatchItem {
  userSong: {
    name: string;      // 网易云曲名
    artists: string;   // 歌手
    coverUrl: string;  // 封面 (支持 ?param=300y300 缩放)
  };
  arcadeSong: {
    title: string;     // 街机曲名
    artist: string;
    coverUrl: string;  // 街机封面 (可能为空，需 fallback 到网易云封面)
    category: string;  // 分类
    version: string;   // 版本
    bpm: number;       // BPM
  };
  score: number;       // 匹配分数 (0-1)
  matchType: 'exact' | 'fuzzy';
}
```

## 4. 补充说明
*   **Icon**: 目前使用 `react-icons`，你可以随意更换。
*   **动画**: 目前使用 `framer-motion`，保留或重写均可。
*   **Logo/素材**: 需要你自行发挥或寻找素材。

---
*Created for Duogeyu*
