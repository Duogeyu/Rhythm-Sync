# Rhythm_Sync API 文档

音游歌单匹配工具 API，支持 maimai、CHUNITHM、ONGEKI、太鼓の達人 等游戏。

**Base URL**: `http://你的服务器:3002`

---

## 📋 目录

- [基础 API](#基础-api)
- [机器人全流程 API](#-机器人全流程-api-推荐)
- [随机歌曲 API](#随机歌曲-api)
- [曲库查询 API](#曲库查询-api)
- [跨游戏搜索 API](#跨游戏搜索-api)
- [歌曲检查 API](#歌曲检查-api)
- [平台歌单获取 API](#平台歌单获取-api)
- [流式匹配 API](#流式匹配-api)
- [分享功能 API](#分享功能-api)

---

## 支持的游戏

| ID | 名称 | 简称 |
|----|------|------|
| `maimai` | maimai DX (国际) | maimai 国际 |
| `maimai-jp` | maimai DX (日服) | maimai 日服 |
| `maimai-cn` | maimai DX (国服) | maimai 国服 |
| `chunithm` | CHUNITHM (国际) | CHUNITHM 国际 |
| `chunithm-jp` | CHUNITHM (日服) | CHUNITHM 日服 |
| `ongeki` | ONGEKI (日服) | ONGEKI 日服 |
| `taiko` | 太鼓の達人 | 太鼓 |

---

## 基础 API

### 健康检查

```http
GET /api/health
```

**响应**:
```json
{
    "status": "ok",
    "timestamp": "2026-01-12T12:00:00.000Z"
}
```

### 获取游戏列表

```http
GET /api/games
```

**响应**:
```json
{
    "success": true,
    "games": [
        { "id": "maimai", "name": "maimai DX (国际)", "shortName": "maimai 国际", "color": "#22d3ee" },
        ...
    ]
}
```

### API 文档

```http
GET /api/docs
```

返回完整的 API 端点列表。

---

## 🤖 机器人全流程 API (推荐)

适用于 QQ 机器人、Discord Bot 等场景，一个请求完成全部流程。

### 一站式歌单查询

```http
POST /api/bot/query
Content-Type: application/json
```

**请求体**:
```json
{
    "input": "https://music.163.com/playlist?id=123456789",
    "playlistId": "可选，当input是用户ID时需要指定歌单",
    "siteUrl": "https://你的网站.com",
    "generateImage": true
}
```

**支持的输入格式**:

| 格式 | 示例 |
|------|------|
| 网易云歌单链接 | `https://music.163.com/playlist?id=xxx` |
| 网易云歌单短链接 | `https://163cn.tv/xxx` |
| 网易云用户ID | `12345678` (纯数字，需额外指定 playlistId) |
| QQ音乐歌单链接 | `https://y.qq.com/n/ryqq/playlist/xxx` |
| 文本歌曲列表 | 多行文本，每行一首歌名 |

**响应 (成功)**:
```json
{
    "success": true,
    "resultId": "abc12XYZ",
    "resultUrl": "https://你的网站.com/#/result/abc12XYZ",
    "imageUrl": "http://api:3002/api/bot/result/abc12XYZ/image",
    "playlist": {
        "name": "我的歌单",
        "trackCount": 100,
        "creator": "用户名"
    },
    "summary": {
        "totalSongs": 100,
        "maxMatches": 45,
        "coveragePercent": 45,
        "games": {
            "maimai": { "name": "maimai DX (国际)", "shortName": "maimai 国际", "matchCount": 45 },
            "chunithm": { "name": "CHUNITHM (国际)", "shortName": "CHUNITHM 国际", "matchCount": 30 },
            "chunithm-jp": { "name": "CHUNITHM (日服)", "shortName": "CHUNITHM 日服", "matchCount": 28 },
            "ongeki": { "name": "ONGEKI (日服)", "shortName": "ONGEKI 日服", "matchCount": 20 },
            "taiko": { "name": "太鼓の達人", "shortName": "太鼓", "matchCount": 15 }
        }
    },
    "preview": {
        "maimai": {
            "name": "maimai 国际",
            "count": 45,
            "top5": [
                { "title": "FREEDOM DiVE", "artist": "xi" },
                { "title": "Oshama Scramble!", "artist": "t+pazolite" },
                ...
            ]
        },
        ...
    },
    "expiresAt": 1705123456789,
    "queryTime": 2500
}
```

**响应 (需要选择歌单)**:

当输入是网易云用户ID且未指定歌单时：
```json
{
    "success": true,
    "needSelectPlaylist": true,
    "playlists": [
        { "id": "123456", "name": "我喜欢的音乐", "trackCount": 500, "creator": "用户名" },
        { "id": "789012", "name": "音游收藏", "trackCount": 200, "creator": "用户名" },
        ...
    ],
    "message": "请选择一个歌单，然后在请求中添加 playlistId 参数"
}
```

### 获取查询结果

```http
GET /api/bot/result/:id
```

**响应**:
```json
{
    "success": true,
    "data": {
        "id": "abc12XYZ",
        "playlist": { ... },
        "results": {
            "maimai": {
                "config": { "name": "maimai DX (国际)", ... },
                "matches": [
                    {
                        "userSong": { "id": 123, "name": "歌曲名", "artists": "艺术家" },
                        "arcadeSong": { "id": "456", "title": "游戏内曲名", "artist": "艺术家", ... },
                        "score": 100,
                        "matchType": "exact",
                        "tags": ["perfect_match"]
                    },
                    ...
                ]
            },
            ...
        },
        "userSongCount": 100,
        "coveragePercent": 45,
        "createdAt": 1705000000000,
        "expiresAt": 1705604800000
    }
}
```

### 获取结果分享图

```http
GET /api/bot/result/:id/image
```

**响应**: PNG 图片 (Content-Type: image/png)

分享图包含：
- 歌单名称和创建者
- 匹配统计数据
- 各游戏匹配数量柱状图
- **二维码** (扫码进入完整结果页面)

---

## 随机歌曲 API

### 随机获取歌曲

```http
GET /api/random
```

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `game` | string | 游戏ID，不填则随机选择游戏 |
| `count` | number | 返回数量 (1-10，默认1) |
| `difficulty` | string | 难度筛选 (如 "Master", "Expert") |
| `minLevel` | string | 最低等级 (如 "13", "14+") |
| `maxLevel` | string | 最高等级 |
| `image` | boolean | 是否生成分享图 (仅 count=1 时有效) |

**示例**:
```http
# 随机一首并生成分享图
GET /api/random?game=maimai&image=true

# 随机3首 Master 13级以上
GET /api/random?game=maimai&count=3&difficulty=Master&minLevel=13
```

**响应 (带分享图)**:
```json
{
    "success": true,
    "count": 1,
    "totalPool": 450,
    "filters": { "game": "maimai", "difficulty": null, "minLevel": null, "maxLevel": null },
    "songs": {
        "gameId": "maimai",
        "gameName": "maimai DX (国际)",
        "id": "772",
        "title": "FREEDOM DiVE (tpz Overcute Remix)",
        "artist": "t+pazolite",
        "category": "其他游戏",
        "version": "maimai でらっくす",
        "bpm": 222,
        "coverUrl": "https://...",
        "type": "DX",
        "charts": [
            { "difficulty": "Basic", "level": "7", "ds": 7.0 },
            { "difficulty": "Advanced", "level": "9", "ds": 9.5 },
            { "difficulty": "Expert", "level": "12+", "ds": 12.8 },
            { "difficulty": "Master", "level": "14", "ds": 14.1 }
        ],
        "levels": ["7", "9", "12+", "14"]
    },
    "imageUrl": "http://localhost:3002/api/random/image/maimai_772_1705123456789",
    "imageId": "maimai_772_1705123456789"
}
```

**响应 (多首歌曲)**:
```json
{
    "success": true,
    "count": 3,
    "totalPool": 450,
    "filters": { "game": "maimai", "difficulty": "Master", "minLevel": "13" },
    "songs": [
        { "gameId": "maimai", "title": "FREEDOM DiVE", ... },
        { "gameId": "maimai", "title": "Oshama Scramble!", ... },
        { "gameId": "maimai", "title": "怒槌", ... }
    ]
}
```

### 获取单曲分享图

```http
GET /api/random/image/:imageId
```

直接返回 PNG 图片。

**分享图包含**:
- 游戏名称和 Logo 颜色
- 歌曲封面 (自动获取)
- 歌曲标题和艺术家
- 分类和 BPM
- 谱面类型 (DX/SD)
- 各难度等级块 (带颜色)

> ⚠️ 图片有效期 1 小时，过期后会自动清理

---

## 曲库查询 API

### 查询游戏曲库

```http
GET /api/songs/:gameId
```

**路径参数**:
- `gameId`: 游戏ID (如 `maimai`, `chunithm`)

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码 (默认1) |
| `limit` | number | 每页数量 (1-200，默认50) |
| `search` | string | 搜索关键词 (标题/艺术家) |
| `category` | string | 分类筛选 |
| `difficulty` | string | 难度筛选 |
| `minLevel` | string | 最低等级 |
| `maxLevel` | string | 最高等级 |

**示例**:
```http
GET /api/songs/maimai?search=初音&difficulty=Master&page=1&limit=20
```

**响应**:
```json
{
    "success": true,
    "gameId": "maimai",
    "gameName": "maimai DX (国际)",
    "pagination": {
        "page": 1,
        "limit": 20,
        "totalCount": 45,
        "totalPages": 3,
        "hasNext": true,
        "hasPrev": false
    },
    "filters": { "search": "初音", "difficulty": "Master" },
    "songs": [ ... ]
}
```

---

## 跨游戏搜索 API

### 跨游戏搜索歌曲

```http
GET /api/search
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | ✅ | 搜索关键词 |
| `games` | string | | 游戏范围，逗号分隔 (默认全部) |
| `limit` | number | | 每个游戏最大返回数 (默认10，最大50) |

**示例**:
```http
GET /api/search?q=FREEDOM&games=maimai,chunithm&limit=5
```

**响应**:
```json
{
    "success": true,
    "query": "FREEDOM",
    "totalMatches": 12,
    "searchedGames": ["maimai", "chunithm"],
    "results": {
        "maimai": {
            "gameName": "maimai DX (国际)",
            "count": 3,
            "matches": [
                { "score": -500, "song": { "id": "772", "title": "FREEDOM DiVE", ... } },
                ...
            ]
        },
        "chunithm": {
            "gameName": "CHUNITHM (国际)",
            "count": 2,
            "matches": [ ... ]
        }
    }
}
```

---

## 歌曲检查 API

### 检查歌曲在哪些游戏中存在

```http
GET /api/check
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 歌曲标题 |
| `artist` | string | | 艺术家 (提高匹配精度) |

**示例**:
```http
GET /api/check?title=FREEDOM%20DiVE&artist=xi
```

**响应**:
```json
{
    "success": true,
    "query": { "title": "FREEDOM DiVE", "artist": "xi" },
    "foundInGames": 7,
    "totalGames": 7,
    "matches": {
        "maimai": {
            "gameName": "maimai DX (国际)",
            "found": true,
            "song": {
                "id": "772",
                "title": "FREEDOM DiVE (tpz Overcute Remix)",
                "artist": "t+pazolite",
                "charts": [ ... ],
                "levels": ["7", "9", "12+", "14"]
            }
        },
        "chunithm": {
            "gameName": "CHUNITHM (国际)",
            "found": true,
            "song": { ... }
        },
        ...
    }
}
```

---

## 平台歌单获取 API

### 获取网易云用户歌单列表

```http
GET /api/netease/user/:uid/playlists
```

### 获取网易云歌单详情

```http
GET /api/netease/playlist/:id
```

### 获取QQ音乐歌单

```http
GET /api/qqmusic/playlist/:id
```

### 获取B站用户收藏夹

```http
GET /api/bilibili/user/:uid/favlist
```

---

## 流式匹配 API

适用于需要实时显示匹配进度的场景 (网页端使用)。

### 开始匹配任务

```http
POST /api/match/start
Content-Type: application/json
```

**请求体**:
```json
{
    "userSongs": [
        { "id": 1, "name": "歌曲名", "artists": "艺术家", ... },
        ...
    ],
    "neteaseUid": "用户ID",
    "playlistId": "歌单ID",
    "playlistName": "歌单名称"
}
```

**响应**:
```json
{
    "success": true,
    "sessionId": "abc123xyz"
}
```

### 获取匹配结果流 (SSE)

```http
GET /api/match/stream/:sessionId
```

返回 Server-Sent Events 流。

---

## 分享功能 API

### 创建分享

```http
POST /api/share/create
Content-Type: application/json
```

### 获取分享数据

```http
GET /api/share/:shareId
```

### 获取分享图片

```http
GET /api/share/:shareId/image
```

---

## 代码示例

### Python

```python
import requests

BASE_URL = "http://localhost:3002"

# 1. 机器人全流程查询
def query_playlist(playlist_url):
    resp = requests.post(f"{BASE_URL}/api/bot/query", json={
        "input": playlist_url,
        "siteUrl": "https://你的网站.com"
    })
    data = resp.json()
    
    if data.get("needSelectPlaylist"):
        # 需要选择歌单
        print("请选择一个歌单:")
        for p in data["playlists"]:
            print(f"  [{p['id']}] {p['name']} ({p['trackCount']}首)")
        return None
    
    if data["success"]:
        print(f"查询成功！")
        print(f"歌单: {data['playlist']['name']}")
        print(f"覆盖率: {data['summary']['coveragePercent']}%")
        print(f"结果页: {data['resultUrl']}")
        print(f"分享图: {data['imageUrl']}")
        return data
    
    print(f"查询失败: {data.get('error')}")
    return None

# 2. 随机歌曲
def random_song(game="maimai", difficulty="Master"):
    resp = requests.get(f"{BASE_URL}/api/random", params={
        "game": game,
        "difficulty": difficulty
    })
    data = resp.json()
    if data["success"]:
        song = data["songs"]
        print(f"🎵 {song['title']} - {song['artist']}")
        print(f"   难度: {', '.join(song['levels'])}")
        return song
    return None

# 3. 检查歌曲
def check_song(title):
    resp = requests.get(f"{BASE_URL}/api/check", params={"title": title})
    data = resp.json()
    if data["success"]:
        print(f"《{title}》在 {data['foundInGames']}/{data['totalGames']} 个游戏中存在:")
        for game_id, info in data["matches"].items():
            if info["found"]:
                print(f"  ✅ {info['gameName']}: {info['song']['title']}")
    return data

# 使用示例
query_playlist("https://music.163.com/playlist?id=123456")
random_song("maimai", "Master")
check_song("FREEDOM DiVE")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');
const BASE_URL = 'http://localhost:3002';

// 机器人全流程查询
async function queryPlaylist(input) {
    const { data } = await axios.post(`${BASE_URL}/api/bot/query`, {
        input,
        siteUrl: 'https://你的网站.com'
    });
    
    if (data.needSelectPlaylist) {
        console.log('请选择歌单:', data.playlists);
        return null;
    }
    
    console.log(`✅ 查询成功: ${data.playlist.name}`);
    console.log(`📊 覆盖率: ${data.summary.coveragePercent}%`);
    console.log(`🔗 结果页: ${data.resultUrl}`);
    console.log(`🖼️ 分享图: ${data.imageUrl}`);
    
    return data;
}

// 随机歌曲
async function randomSong(game = 'maimai') {
    const { data } = await axios.get(`${BASE_URL}/api/random`, {
        params: { game, count: 1 }
    });
    console.log(`🎵 ${data.songs.title} - ${data.songs.artist}`);
    return data.songs;
}

// 使用示例
(async () => {
    await queryPlaylist('https://music.163.com/playlist?id=123456');
    await randomSong('chunithm');
})();
```

### cURL

```bash
# 机器人查询
curl -X POST http://localhost:3002/api/bot/query \
  -H "Content-Type: application/json" \
  -d '{"input": "https://music.163.com/playlist?id=123456"}'

# 随机歌曲
curl "http://localhost:3002/api/random?game=maimai&count=3"

# 搜索歌曲
curl "http://localhost:3002/api/search?q=FREEDOM"

# 检查歌曲
curl "http://localhost:3002/api/check?title=FREEDOM%20DiVE"
```

---

## 错误处理

所有 API 在失败时返回:

```json
{
    "success": false,
    "error": "错误信息描述"
}
```

HTTP 状态码:
- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 数据有效期

| 类型 | 有效期 |
|------|--------|
| 游戏曲库缓存 | 24小时 |
| 机器人查询结果 | 7天 |
| 分享数据 | 3天 |

---

## 联系方式

- GitHub: [@DuoGeYu](https://github.com/DuoGeYu)

