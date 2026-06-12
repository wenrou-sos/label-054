# 数据库设计文档

## 概述

本项目使用 PostgreSQL 作为关系型数据库，通过 Sequelize ORM 进行数据操作。数据库设计遵循第三范式，同时针对查询性能做了适当的反范式优化和索引设计。

## ER 图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Player    │       │   Friendship │       │ FriendRequest│
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │    ┌──│ id (PK)      │
│ username     │  │    │ playerId(FK) │◄───┘  │ fromPlayerId │
│ email        │  └───►│ friendId(FK) │◄──────│  (FK)        │
│ password     │       │ status       │       │ toPlayerId   │
│ nickname     │       │ relationLevel│       │  (FK)        │
│ avatar       │       │ remark       │       │ status       │
│ level        │       │ groupName    │       │ message      │
│ experience   │       │ closeScore   │       │ expiresAt    │
│ status       │       └──────────────┘       └──────────────┘
│ bio          │
│ stats(JSONB) │       ┌──────────────┐       ┌──────────────────┐
│ preferences  │       │  Achievement │       │ PlayerAchievement│
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ isAdmin      │       │ id (PK)      │       │ id (PK)          │
│ lastActiveAt │       │ code         │       │ playerId (FK)    │
│ bannedAt     │       │ name         │       │ achievementId(FK)│
└──────────────┘       │ description  │       │ progress         │
                       │ category     │       │ currentValue     │
                       │ rarity       │       │ targetValue      │
                       │ points       │       │ isUnlocked       │
                       │ conditionType│       │ unlockedAt       │
                       │ conditionCfg │       │ isSeen           │
                       │ rewards(JSON)│       └──────────────────┘
                       │ parentId(FK) │
                       │ isActive     │       ┌──────────────────┐
                       │ isHidden     │       │ AchievementShare │
                       │ unlockCount  │       ├──────────────────┤
                       └──────────────┘       │ id (PK)          │
                         ▲                    │ shareToken       │
                         │                    │ playerId (FK)    │
                         └────────────────────│ achievementId(FK)│
                                              │ platform         │
                                              │ message          │
                                              │ visibility       │
                                              │ viewCount        │
                                              │ likeCount        │
                                              │ expiresAt        │
                                              └──────────────────┘
```

## 表结构详解

### 1. Player（玩家表）

存储玩家基本信息、统计数据和偏好设置。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 玩家唯一标识 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名（字母数字） |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱地址 |
| password | VARCHAR(255) | NOT NULL | 加密后的密码（bcrypt） |
| nickname | VARCHAR(50) | NULL | 昵称/显示名 |
| avatar | VARCHAR(255) | NULL | 头像 URL |
| level | INTEGER | DEFAULT 1 | 玩家等级 |
| experience | BIGINT | DEFAULT 0 | 经验值 |
| status | ENUM | DEFAULT 'offline' | 在线状态 |
| bio | TEXT | NULL | 个人简介 |
| location | VARCHAR(100) | NULL | 地区 |
| birthday | DATEONLY | NULL | 生日 |
| gender | ENUM | DEFAULT 'unknown' | 性别 |
| stats | JSONB | DEFAULT {...} | 游戏统计数据 |
| preferences | JSONB | DEFAULT {...} | 用户偏好设置 |
| isAdmin | BOOLEAN | DEFAULT FALSE | 是否管理员 |
| lastActiveAt | DATETIME | DEFAULT NOW() | 最后活跃时间 |
| bannedAt | DATETIME | NULL | 封禁时间 |
| banReason | TEXT | NULL | 封禁原因 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**索引：**
- `idx_player_username` (username) UNIQUE
- `idx_player_email` (email) UNIQUE
- `idx_player_status` (status)
- `idx_player_level` (level)
- `idx_player_username_search` (lower(username)) GIN
- `idx_player_nickname_search` (lower(nickname)) GIN

### 2. Friendship（好友关系表）

存储玩家之间的好友关系，采用双向存储设计。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 关系唯一标识 |
| playerId | BIGINT | FK, NOT NULL | 玩家ID |
| friendId | BIGINT | FK, NOT NULL | 好友ID |
| status | ENUM | DEFAULT 'pending' | 关系状态 |
| relationLevel | INTEGER | DEFAULT 0 | 关系级别 |
| remark | VARCHAR(50) | NULL | 好友备注 |
| groupName | VARCHAR(50) | DEFAULT '默认分组' | 好友分组 |
| mutualFriendsCount | INTEGER | DEFAULT 0 | 共同好友数量 |
| closeScore | INTEGER | DEFAULT 0 | 亲密值（0-100） |
| lastInteractedAt | DATETIME | DEFAULT NOW() | 最后互动时间 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**关系级别（relationLevel）：**
- `0`: 直接好友
- `1`: 好友的好友
- `2`: 陌生人

**状态（status）：**
- `pending`: 待确认
- `accepted`: 已接受
- `rejected`: 已拒绝
- `blocked`: 已拉黑

**索引：**
- `idx_friendship_player_friend` (player_id, friend_id) UNIQUE
- `idx_friendship_friend_player` (friend_id, player_id)
- `idx_friendship_status` (status)
- `idx_friendship_relation_level` (relation_level)
- `idx_friendship_close_score` (close_score)
- `idx_friendship_group` (player_id, group_name)

### 3. FriendRequest（好友请求表）

存储好友添加请求记录。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 请求唯一标识 |
| fromPlayerId | BIGINT | FK, NOT NULL | 发送方ID |
| toPlayerId | BIGINT | FK, NOT NULL | 接收方ID |
| status | ENUM | DEFAULT 'pending' | 请求状态 |
| message | TEXT | NULL | 请求附带消息 |
| expiresAt | DATETIME | DEFAULT +30天 | 过期时间 |
| respondedAt | DATETIME | NULL | 响应时间 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**状态（status）：**
- `pending`: 待处理
- `accepted`: 已接受
- `rejected`: 已拒绝
- `cancelled`: 已取消

**索引：**
- `idx_friend_request_from_to` (from_player_id, to_player_id) UNIQUE
- `idx_friend_request_to` (to_player_id, status)
- `idx_friend_request_from` (from_player_id, status)
- `idx_friend_request_status` (status)
- `idx_friend_request_expires` (expires_at)

### 4. Achievement（成就表）

存储成就定义，由管理员配置。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 成就唯一标识 |
| code | VARCHAR(100) | UNIQUE, NOT NULL | 成就代码（唯一） |
| name | VARCHAR(100) | NOT NULL | 成就名称 |
| description | TEXT | NOT NULL | 成就描述 |
| category | ENUM | DEFAULT 'progression' | 成就分类 |
| rarity | ENUM | DEFAULT 'common' | 稀有度 |
| icon | VARCHAR(255) | NULL | 图标 URL |
| points | INTEGER | DEFAULT 10 | 成就点数 |
| conditionType | ENUM | DEFAULT 'counter' | 条件类型 |
| conditionConfig | JSONB | DEFAULT {} | 条件配置 |
| rewards | JSONB | DEFAULT {...} | 奖励配置 |
| isActive | BOOLEAN | DEFAULT TRUE | 是否启用 |
| isHidden | BOOLEAN | DEFAULT FALSE | 是否隐藏 |
| order | INTEGER | DEFAULT 0 | 排序权重 |
| parentId | BIGINT | FK, NULL | 父成就ID（成就链） |
| startsAt | DATETIME | NULL | 开始时间 |
| expiresAt | DATETIME | NULL | 结束时间 |
| unlockCount | INTEGER | DEFAULT 0 | 解锁总次数 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**分类（category）：**
- `combat`: 战斗类
- `exploration`: 探索类
- `social`: 社交类
- `collection`: 收集类
- `progression`: 进度类
- `special`: 特殊类

**稀有度（rarity）：**
- `common`: 普通
- `uncommon`:  uncommon
- `rare`: 稀有
- `epic`: 史诗
- `legendary`: 传说

**条件类型（conditionType）：**
- `counter`: 计数器（累加）
- `milestone`: 里程碑（取最大值）
- `boolean`: 布尔型
- `progressive`: 进度型

**条件配置（conditionConfig）示例：**
```json
{
  "event": "game_won",
  "target": 100,
  "interval": "lifetime"
}
```

**奖励配置（rewards）示例：**
```json
{
  "experience": 500,
  "items": [{"id": 101, "name": "传说之剑", "count": 1}],
  "currency": 10000
}
```

**索引：**
- `idx_achievement_code` (code) UNIQUE
- `idx_achievement_category` (category)
- `idx_achievement_rarity` (rarity)
- `idx_achievement_active` (is_active, is_hidden)
- `idx_achievement_parent` (parent_id)
- `idx_achievement_event` (condition_config->'event') GIN

### 5. PlayerAchievement（玩家成就表）

存储玩家的成就进度和解锁状态。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 记录唯一标识 |
| playerId | BIGINT | FK, NOT NULL | 玩家ID |
| achievementId | BIGINT | FK, NOT NULL | 成就ID |
| progress | DOUBLE | DEFAULT 0 | 完成进度（0-100） |
| currentValue | BIGINT | DEFAULT 0 | 当前值 |
| targetValue | BIGINT | DEFAULT 1 | 目标值 |
| isUnlocked | BOOLEAN | DEFAULT FALSE | 是否已解锁 |
| unlockedAt | DATETIME | NULL | 解锁时间 |
| isSeen | BOOLEAN | DEFAULT FALSE | 是否已查看 |
| seenAt | DATETIME | NULL | 查看时间 |
| metadata | JSONB | DEFAULT {} | 额外数据 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**索引：**
- `idx_player_achievement_unique` (player_id, achievement_id) UNIQUE
- `idx_player_achievement_player` (player_id, is_unlocked)
- `idx_player_achievement_unlocked` (is_unlocked, unlocked_at)
- `idx_player_achievement_achievement` (achievement_id, is_unlocked)

### 6. AchievementShare（成就分享表）

存储玩家的成就分享记录。

| 字段名 | 类型 | 约束 | 描述 |
|--------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 分享唯一标识 |
| shareToken | UUID | UNIQUE, NOT NULL | 分享令牌（UUID） |
| playerId | BIGINT | FK, NOT NULL | 分享者ID |
| achievementId | BIGINT | FK, NOT NULL | 成就ID |
| platform | ENUM | DEFAULT 'internal' | 分享平台 |
| message | TEXT | NULL | 分享留言 |
| visibility | ENUM | DEFAULT 'friends' | 可见性 |
| viewCount | INTEGER | DEFAULT 0 | 浏览次数 |
| likeCount | INTEGER | DEFAULT 0 | 点赞次数 |
| expiresAt | DATETIME | NULL | 过期时间 |
| metadata | JSONB | DEFAULT {} | 额外数据 |
| createdAt | DATETIME | DEFAULT NOW() | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW() | 更新时间 |

**平台（platform）：**
- `internal`: 站内
- `facebook`: Facebook
- `twitter`: Twitter
- `wechat`: 微信
- `weibo`: 微博
- `discord`: Discord
- `other`: 其他

**可见性（visibility）：**
- `public`: 公开
- `friends`: 仅好友可见
- `private`: 仅自己可见

**索引：**
- `idx_achievement_share_token` (share_token) UNIQUE
- `idx_achievement_share_player` (player_id, visibility)
- `idx_achievement_share_achievement` (achievement_id)
- `idx_achievement_share_platform` (platform, created_at)

## PostgreSQL 扩展

系统使用以下 PostgreSQL 扩展：

- **pg_trgm**: 提供 trigram 模糊搜索支持，用于玩家搜索
- **uuid-ossp**: 提供 UUID 生成函数

## 查询优化策略

1. **索引优化**：所有高频查询字段均建立了 B-Tree 索引
2. **全文搜索**：玩家用户名/昵称使用 GIN 索引 + trigram 实现高效模糊搜索
3. **JSONB 查询**：成就条件配置使用 GIN 索引提升 JSON 字段查询性能
4. **复合索引**：针对常用查询组合设计复合索引
5. **缓存层**：Redis 缓存热点数据，减少数据库压力
6. **连接池**：配置数据库连接池，管理连接复用

## 数据安全

1. **密码加密**：使用 bcrypt (12轮) 加密存储用户密码
2. **敏感字段过滤**：API 返回数据自动过滤密码、邮箱等敏感字段
3. **权限控制**：管理员接口需特殊认证
4. **数据隔离**：用户只能访问自己的数据和已授权的数据
