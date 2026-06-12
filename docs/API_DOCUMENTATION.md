# API 接口文档

## 概述

本服务提供游戏好友系统与成就服务的 RESTful API，采用 JSON 格式进行数据交互。所有 API 均以 `/api/v1` 为前缀。

**基础信息：**
- Base URL: `http://localhost:3000/api/v1`
- 数据格式: JSON
- 字符编码: UTF-8
- 文档在线地址: `http://localhost:3000/api/v1/docs`

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "cached": true
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": { ... }
  }
}
```

## 认证方式

### JWT Token

除公开接口外，所有请求需在 Header 中携带 Bearer Token：

```
Authorization: Bearer <your-jwt-token>
```

### 管理员 API Key

管理员接口支持两种认证方式：

1. 通过 JWT Token（登录用户需为管理员）
2. 通过 Header 中的 API Key：

```
X-Admin-API-Key: <admin-api-key>
```

## 错误码说明

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| UNAUTHORIZED | 401 | 未授权访问 |
| FORBIDDEN | 403 | 禁止访问 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| RATE_LIMIT_EXCEEDED | 429 | 请求过于频繁 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| PLAYER_NOT_FOUND | 404 | 玩家不存在 |
| PLAYER_BANNED | 403 | 玩家已被封禁 |
| USERNAME_EXISTS | 409 | 用户名已存在 |
| EMAIL_EXISTS | 409 | 邮箱已存在 |
| INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| FRIEND_REQUEST_EXISTS | 409 | 好友请求已存在 |
| FRIEND_REQUEST_NOT_FOUND | 404 | 好友请求不存在 |
| FRIEND_REQUEST_EXPIRED | 400 | 好友请求已过期 |
| ALREADY_FRIENDS | 409 | 已经是好友了 |
| CANNOT_ADD_SELF | 400 | 不能添加自己为好友 |
| FRIEND_NOT_FOUND | 404 | 好友不存在 |
| ACHIEVEMENT_NOT_FOUND | 404 | 成就不存在 |
| ACHIEVEMENT_ALREADY_UNLOCKED | 409 | 成就已解锁 |
| ACHIEVEMENT_CODE_EXISTS | 409 | 成就代码已存在 |
| SHARE_NOT_FOUND | 404 | 分享不存在 |
| SHARE_EXPIRED | 400 | 分享已过期 |
| SHARE_NOT_AUTHORIZED | 403 | 无权限查看此分享 |
| ADMIN_REQUIRED | 403 | 需要管理员权限 |
| FRIEND_REQUESTS_DISABLED | 403 | 对方拒绝接收好友请求 |

---

## 1. 认证接口 (Auth)

### 1.1 注册

**POST** `/auth/register`

**请求体：**
```json
{
  "username": "player001",
  "email": "player@game.com",
  "password": "password123",
  "nickname": "玩家一号"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "player": {
      "id": 1,
      "username": "player001",
      "nickname": "玩家一号",
      "level": 1,
      "status": "offline",
      ...
    }
  }
}
```

### 1.2 登录

**POST** `/auth/login`

**限流：** 15分钟内最多5次尝试

**请求体：**
```json
{
  "username": "player001",
  "password": "password123"
}
```

### 1.3 登出

**POST** `/auth/logout`

**认证：** 需要登录

### 1.4 获取当前用户信息

**GET** `/auth/me`

**认证：** 需要登录

---

## 2. 玩家接口 (Players)

### 2.1 搜索玩家

**GET** `/players/search?q=关键词&page=1&limit=20`

**认证：** 可选

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词（用户名、昵称、ID） |
| page | integer | 否 | 页码，默认1 |
| limit | integer | 否 | 每页数量，默认20，最大100 |

### 2.2 获取玩家档案

**GET** `/players/:id`

**认证：** 可选（已登录可查看更多信息）

### 2.3 更新玩家资料

**PUT** `/players/:id`

**认证：** 需要登录（只能更新自己的资料，管理员除外）

**请求体：**
```json
{
  "nickname": "新昵称",
  "avatar": "https://example.com/avatar.png",
  "bio": "这是我的简介",
  "location": "北京",
  "birthday": "1990-01-01",
  "gender": "male",
  "status": "online",
  "preferences": {
    "showOnlineStatus": true,
    "allowFriendRequests": true,
    "showAchievements": true
  }
}
```

### 2.4 更新在线状态

**PATCH** `/players/:id/status`

**认证：** 需要登录

---

## 3. 好友接口 (Friends)

### 3.1 获取好友列表

**GET** `/friends?page=1&limit=50&status=accepted&groupName=&searchQuery=`

**认证：** 需要登录

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| limit | integer | 否 | 每页数量，默认50 |
| status | string | 否 | 筛选状态：accepted/pending/blocked |
| groupName | string | 否 | 按分组筛选 |
| searchQuery | string | 否 | 搜索好友用户名/昵称 |

### 3.2 发送好友请求

**POST** `/friends/requests`

**认证：** 需要登录

**限流：** 1小时内最多10次

**请求体：**
```json
{
  "toPlayerId": 2,
  "message": "你好，一起玩游戏吧！"
}
```

### 3.3 获取好友请求列表

**GET** `/friends/requests?type=received&page=1&limit=20`

**认证：** 需要登录

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | received: 收到的请求, sent: 发出的请求，默认received |

### 3.4 接受好友请求

**POST** `/friends/requests/:id/accept`

**认证：** 需要登录

### 3.5 拒绝好友请求

**POST** `/friends/requests/:id/reject`

**认证：** 需要登录

### 3.6 取消好友请求

**POST** `/friends/requests/:id/cancel`

**认证：** 需要登录

### 3.7 删除好友

**DELETE** `/friends/:friendId`

**认证：** 需要登录

### 3.8 更新好友备注/分组

**PUT** `/friends/:friendId`

**认证：** 需要登录

**请求体：**
```json
{
  "remark": "好兄弟",
  "groupName": "游戏队友"
}
```

### 3.9 获取与目标玩家的关系

**GET** `/friends/relation/:targetId`

**认证：** 需要登录

**响应：**
```json
{
  "success": true,
  "data": {
    "level": 0,
    "name": "direct",
    "friendship": { ... }
  }
}
```

**关系级别：**
- `-1`: self（自己）
- `0`: direct（直接好友）
- `1`: friend_of_friend（好友的好友）
- `2`: stranger（陌生人）

### 3.10 获取好友推荐（好友的好友）

**GET** `/friends/suggestions?page=1&limit=50`

**认证：** 需要登录

### 3.11 获取共同好友

**GET** `/friends/mutual/:targetId`

**认证：** 需要登录

### 3.12 拉黑玩家

**POST** `/friends/block/:targetId`

**认证：** 需要登录

### 3.13 取消拉黑

**POST** `/friends/unblock/:targetId`

**认证：** 需要登录

### 3.14 获取黑名单

**GET** `/friends/blocked?page=1&limit=50`

**认证：** 需要登录

---

## 4. 成就接口 (Achievements)

### 4.1 获取成就列表

**GET** `/achievements?category=&rarity=&page=1&limit=50`

**认证：** 可选

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 否 | combat/exploration/social/collection/progression/special |
| rarity | string | 否 | common/uncommon/rare/epic/legendary |

### 4.2 获取成就详情（ID）

**GET** `/achievements/:id`

**认证：** 可选

### 4.3 获取成就详情（Code）

**GET** `/achievements/code/:code`

**认证：** 可选

### 4.4 创建成就

**POST** `/achievements`

**认证：** 需要管理员权限

### 4.5 更新成就

**PUT** `/achievements/:id`

**认证：** 需要管理员权限

### 4.6 删除成就

**DELETE** `/achievements/:id`

**认证：** 需要管理员权限

### 4.7 上报游戏事件（自动检测成就）

**POST** `/achievements/track`

**认证：** 需要登录

**限流：** 每分钟最多100次

**请求体：**
```json
{
  "event": "game_won",
  "value": 1,
  "metadata": {
    "gameMode": "ranked",
    "map": "forest"
  }
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "unlocked": [
      {
        "achievementId": 1,
        "achievementCode": "first_win",
        "achievementName": "首胜",
        "progress": 100,
        "currentValue": 1,
        "targetValue": 1,
        "isUnlocked": true,
        "unlockedAt": "2024-01-01T12:00:00.000Z",
        "points": 15,
        "rewards": { "experience": 100, "items": [], "currency": 0 }
      }
    ],
    "progress": [ ... ]
  }
}
```

**已支持的事件类型：**
- `game_played`: 完成游戏
- `game_won`: 赢得游戏
- `win_streak`: 连胜场次
- `friend_added`: 添加好友
- `level_up`: 升级
- `achievement_unlocked`: 解锁成就
- `explore_maps`: 探索地图
- `playtime`: 游戏时长（秒）

### 4.8 手动解锁成就

**POST** `/achievements/unlock/:code`

**认证：** 需要管理员权限

### 4.9 获取当前玩家成就列表

**GET** `/achievements/player/me?isUnlocked=&category=&rarity=&page=1&limit=50`

**认证：** 需要登录

### 4.10 获取指定玩家成就列表

**GET** `/achievements/player/:playerId`

**认证：** 可选

### 4.11 获取当前玩家成就统计

**GET** `/achievements/player/me/stats`

**认证：** 需要登录

### 4.12 获取指定玩家成就统计

**GET** `/achievements/player/:playerId/stats`

**认证：** 可选

### 4.13 获取未查看的解锁成就

**GET** `/achievements/player/me/unseen`

**认证：** 需要登录

### 4.14 标记成就为已查看

**POST** `/achievements/:id/seen`

**认证：** 需要登录

### 4.15 与好友对比成就

**GET** `/achievements/compare/:friendId`

**认证：** 需要登录（必须是好友）

**响应：**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": 1,
        "code": "first_win",
        "name": "首胜",
        "player": { "isUnlocked": true, "progress": 100, ... },
        "friend": { "isUnlocked": false, "progress": 50, ... },
        "status": "player_only"
      }
    ],
    "stats": {
      "player": { "unlocked": 10, "total": 15, "points": 500, "completionRate": 67 },
      "friend": { "unlocked": 8, "total": 15, "points": 350, "completionRate": 53 },
      "comparison": {
        "playerAdvantage": 2,
        "pointsDifference": 150,
        "bothUnlocked": 7,
        "playerOnly": 3,
        "friendOnly": 1,
        "noneUnlocked": 4
      }
    }
  }
}
```

### 4.16 获取成就排行榜

**GET** `/achievements/:id/leaderboard?page=1&limit=20`

**认证：** 可选

### 4.17 获取玩家成就排名

**GET** `/achievements/player/me/rank`

**认证：** 需要登录

---

## 5. 成就分享接口 (Shares)

### 5.1 创建成就分享

**POST** `/achievements/:id/share`

**认证：** 需要登录

**请求体：**
```json
{
  "platform": "internal",
  "message": "终于解锁了这个成就！",
  "visibility": "friends",
  "expiresInDays": 30
}
```

### 5.2 通过令牌查看分享

**GET** `/shares/token/:token`

**认证：** 可选（根据分享可见性）

### 5.3 获取当前玩家的分享列表

**GET** `/shares/player/me?visibility=&platform=&page=1&limit=20`

**认证：** 需要登录

### 5.4 获取指定玩家的分享列表

**GET** `/shares/player/:playerId`

**认证：** 可选（仅返回公开的分享）

### 5.5 点赞分享

**POST** `/shares/token/:token/like`

**认证：** 需要登录

---

## 6. 管理员接口 (Admin)

所有管理员接口需要管理员权限认证。

### 6.1 获取玩家列表

**GET** `/admin/players?page=1&limit=50&status=&isBanned=&minLevel=&maxLevel=`

### 6.2 获取玩家详情

**GET** `/admin/players/:id`

### 6.3 封禁玩家

**POST** `/admin/players/:id/ban`

**请求体：**
```json
{
  "reason": "违反游戏规则"
}
```

### 6.4 解封玩家

**POST** `/admin/players/:id/unban`

### 6.5 清理过期好友请求

**POST** `/admin/cleanup/friend-requests`

### 6.6 获取系统统计

**GET** `/admin/stats`

**响应：**
```json
{
  "success": true,
  "data": {
    "totalPlayers": 1000,
    "totalFriendships": 5000,
    "totalAchievements": 15,
    "totalUnlocks": 25000
  }
}
```

---

## 7. 系统接口

### 7.1 健康检查

**GET** `/health`

**响应：**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "uptime": 3600.5
  }
}
```

### 7.2 API 文档

**GET** `/docs`

Swagger UI 在线文档页面。

**GET** `/docs.json`

OpenAPI 3.0 规范 JSON 文档。

---

## 分页说明

所有列表接口均支持分页，统一分页响应格式：

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

## 缓存说明

部分 GET 接口启用了 Redis 缓存，响应中会包含 `cached: true` 标识。可以通过在查询参数中添加 `noCache=true` 来绕过缓存。

缓存时间：
- 成就列表/详情：5分钟
- 玩家资料：1分钟
- 好友列表：1分钟
- 排行榜：5分钟
- 玩家成就：1分钟

## 限流说明

| 接口 | 限制 | 窗口 |
|------|------|------|
| 登录 | 5次 | 15分钟 |
| 好友请求 | 10次 | 1小时 |
| 成就事件上报 | 100次 | 1分钟 |
| 其他API | 100次 | 15分钟 |

响应头中会包含限流信息：
- `X-RateLimit-Limit`: 窗口内最大请求数
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 窗口重置时间戳
