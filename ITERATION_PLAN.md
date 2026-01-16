# 功能迭代计划 - Anti-AI Reader

**制定日期**: 2025-01-13
**当前版本**: v1.0.0
**规划周期**: 8周

---

## 📊 当前API完成度评估

### ✅ 已完成 (70%)

**认证模块** - 100%
- ✅ `/api/auth/github` - GitHub OAuth登录
- ✅ `/api/auth/signin` - 邮箱密码登录
- ✅ `/api/auth/signup` - 注册
- ✅ `/api/auth/signout` - 登出
- ✅ `/api/auth/session` - 会话检查
- ✅ `/api/auth/user` - 用户信息

**概念卡片模块** - 95%
- ✅ `/api/concepts` - CRUD完整 (GET, POST, PUT, DELETE)
- ✅ `/api/concepts/review` - 提交复习评分
- ✅ `/api/concepts/batch` - 批量导入
- ✅ 支持SRS算法和复习历史记录

**文章模块** - 95%
- ✅ `/api/articles` - CRUD完整 (GET, POST, PUT, DELETE)
- ✅ `/api/articles/batch` - 批量导入
- ✅ `/api/fetch` - URL抓取转换

**数据迁移模块** - 80%
- ✅ `/api/migration/status` - 迁移状态检查
- ⚠️ 缺少迁移执行API (前端有工具但后端未完整)

### ❌ 缺失功能 (30%)

**统计数据模块** - 0%
- ❌ 学习时长统计
- ❌ 复习统计
- ❌ 热力图数据
- ❌ 概念掌握度分布
- ❌ 阅读进度分析

**搜索功能** - 0%
- ❌ 全文搜索
- ❌ 标签过滤
- ❌ 高级筛选

**数据导出** - 0%
- ❌ Anki格式导出
- ❌ JSON/CSV导出
- ❌ PDF报告生成

**通知系统** - 0%
- ❌ 复习提醒设置
- ❌ Email通知
- ❌ Push通知

**用户设置** - 0%
- ❌ 偏好设置API
- ❌ 头像上传
- ❌ 主题设置

**阅读会话** - 0%
- ❌ 阅读时长记录
- ❌ 阅读会话追踪

---

## 🎯 迭代策略

### 设计原则

1. **用户价值优先**: 每个迭代都能为用户带来可感知的价值
2. **快速交付**: 2周一个迭代，快速验证
3. **数据驱动**: 基于用户反馈调整优先级
4. **技术债务平衡**: 新功能与重构并重

### 优先级框架

**P0 - 紧急且重要** (本周完成)
- 影响核心用户体验
- 阻塞用户使用
- 安全/稳定性问题

**P1 - 重要不紧急** (2-4周)
- 提升用户留存
- 增强核心功能
- 商业化基础

**P2 - 不重要但紧急** (4-8周)
- 锦上添花功能
- 性能优化
- 体验改进

---

## 📅 Phase 1: 统计数据与可视化 (Week 1-2)

### 目标
让用户看到学习成果，提升成就感和留存率

### API开发任务

#### 1.1 学习统计API
**文件**: `app/api/stats/learning/route.ts`

```typescript
GET /api/stats/learning

Response:
{
  "totalReadingTime": 125000, // 毫秒
  "totalConcepts": 45,
  "totalArticles": 12,
  "totalReviews": 120,
  "avgSessionDuration": 15000,
  "longestStreak": 7, // 天数
  "currentStreak": 3
}
```

#### 1.2 复习热力图数据API
**文件**: `app/api/stats/heatmap/route.ts`

```typescript
GET /api/stats/heatmap?days=30

Response:
{
  "heatmap": [
    { "date": "2025-01-01", "count": 5 },
    { "date": "2025-01-02", "count": 8 },
    // ...
  ],
  "totalDays": 30,
  "activeDays": 18,
  "avgReviewsPerDay": 4.2
}
```

#### 1.3 概念掌握度分布API
**文件**: `app/api/stats/mastery/route.ts`

```typescript
GET /api/stats/mastery

Response:
{
  "distribution": {
    "new": 15,        // 从未复习
    "learning": 20,   // interval < 7天
    "mature": 8,      // interval >= 7天
    "lapsed": 2       // 需要重新学习
  },
  "totalCards": 45,
  "masteryRate": 17.8 // %
}
```

#### 1.4 阅读进度分析API
**文件**: `app/api/stats/reading/route.ts`

```typescript
GET /api/stats/reading?period=7d

Response:
{
  "period": "7d",
  "articlesCompleted": 5,
  "pagesRead": 120,
  "avgReadingSpeed": 250, // 字/分钟
  "dailyBreakdown": [
    { "date": "2025-01-07", "minutes": 15, "articles": 1 },
    { "date": "2025-01-08", "minutes": 25, "articles": 2 }
  ]
}
```

### 前端开发任务

#### 1.5 统计仪表盘页面
**文件**: `app/stats/page.tsx`

**功能**:
- 展示核心学习指标
- GitHub风格热力图
- 概念掌握度饼图
- 阅读进度折线图

#### 1.6 集成到首页
**文件**: `app/page.tsx` (修改)

**改动**:
- 在右侧面板添加统计卡片
- 显示今日复习数
- 显示学习连续天数

### 技术依赖
- 图表库: `recharts` 或 `chart.js`
- 日期处理: `date-fns`

### 成功指标
- 用户访问统计页面: >60% DAU
- 用户查看热力图: >40% DAU
- 用户反馈正面率: >80%

---

## 📅 Phase 2: 搜索与过滤功能 (Week 3-4)

### 目标
让用户快速找到需要的内容，提升效率

### API开发任务

#### 2.1 全文搜索API
**文件**: `app/api/search/route.ts`

```typescript
GET /api/search?q=机器学习&type=concepts

Response:
{
  "concepts": [
    {
      "id": "uuid",
      "term": "机器学习",
      "definition": "...",
      "relevanceScore": 0.95,
      "highlightedSnippet": "..."
    }
  ],
  "articles": [...],
  "total": 15
}
```

**实现方案**:
- 使用PostgreSQL全文搜索 (`tsvector`)
- 或使用简单的LIKE查询 (MVP)
- 未来可升级到Elasticsearch

#### 2.2 标签过滤API
**文件**: `app/api/concepts/filter/route.ts`

```typescript
GET /api/concepts/filter?tags=AI,深度学习&mastered=false

Response:
{
  "concepts": [...],
  "appliedFilters": {
    "tags": ["AI", "深度学习"],
    "mastered": false,
    "dueForReview": true
  }
}
```

#### 2.3 高级搜索API
**文件**: `app/api/search/advanced/route.ts`

```typescript
POST /api/search/advanced

Body:
{
  "query": "神经网络",
  "filters": {
    "tags": ["AI"],
    "dateRange": { "start": "2025-01-01", "end": "2025-01-13" },
    "masteryLevel": ["learning", "mature"],
    "minReviewCount": 3
  },
  "sortBy": "relevance",
  "limit": 20
}
```

### 前端开发任务

#### 2.4 搜索页面
**文件**: `app/search/page.tsx`

**功能**:
- 搜索输入框 (实时搜索)
- 搜索结果列表
- 高亮显示关键词
- 筛选侧边栏

#### 2.5 搜索组件集成
**文件**: `app/components/SearchBar.tsx`

**功能**:
- 全局搜索快捷键 (Cmd+K)
- 搜索建议
- 最近搜索历史

### 技术依赖
- 数据库索引优化
- 防抖输入 (`lodash.debounce`)

### 成功指标
- 搜索使用率: >30% DAU
- 搜索结果点击率: >50%
- 平均搜索时间: <2秒

---

## 📅 Phase 3: 数据导出功能 (Week 5-6)

### 目标
让用户拥有自己的数据，建立信任，促进分享

### API开发任务

#### 3.1 Anki导出API
**文件**: `app/api/export/anki/route.ts`

```typescript
POST /api/export/anki

Body:
{
  "conceptIds": ["uuid1", "uuid2"], // 可选，不传则导出全部
  "includeMedia": false
}

Response:
{
  "downloadUrl": "/exports/anki/user123-deck.apkg",
  "cardCount": 45,
  "expiresAt": "2025-01-14T12:00:00Z"
}
```

**实现方案**:
- 使用 `node-anki-apkg-export` 库
- 生成.apkg文件
- 临时存储并返回下载链接

#### 3.2 JSON导出API
**文件**: `app/api/export/json/route.ts`

```typescript
GET /api/export/json

Response:
{
  "concepts": [...],
  "articles": [...],
  "reviewHistory": [...],
  "exportedAt": "2025-01-13T10:00:00Z"
}
```

#### 3.3 CSV导出API
**文件**: `app/api/export/csv/route.ts`

```typescript
GET /api/export/csv?type=concepts

Response: CSV file download
```

#### 3.4 PDF报告生成API (可选)
**文件**: `app/api/export/report/route.ts`

```typescript
GET /api/export/report?period=month

Response: PDF file download
```

**实现方案**:
- 使用 `puppeteer` 生成PDF
- 或使用 `jsPDF` 客户端生成

### 前端开发任务

#### 3.5 导出页面
**文件**: `app/export/page.tsx`

**功能**:
- 选择导出格式
- 选择导出范围
- 预览导出内容
- 一键下载

#### 3.6 设置页面集成导出
**文件**: `app/options/page.tsx` (修改)

**改动**:
- 添加"数据导出"卡片
- 快速导出按钮

### 技术依赖
- Anki导出库: `@anks/anki-apkg-export`
- 文件存储: Supabase Storage或本地临时目录
- PDF生成: `puppeteer` 或 `jsPDF`

### 成功指标
- 导出功能使用率: >20% DAU
- Anki导出占比: >40%
- 用户分享率: >10%

---

## 📅 Phase 4: 复习提醒系统 (Week 7-8)

### 目标
提升用户留存，建立学习习惯

### API开发任务

#### 4.1 提醒设置API
**文件**: `app/api/reminders/settings/route.ts`

```typescript
GET /api/reminders/settings
Response: { settings }

POST /api/reminders/settings
Body: {
  "enabled": true,
  "time": "09:00",
  "timezone": "Asia/Shanghai",
  "days": ["mon", "tue", "wed", "thu", "fri"],
  "onlyIfDue": true
}
```

#### 4.2 复习任务API
**文件**: `app/api/reminders/due/route.ts`

```typescript
GET /api/reminders/due

Response:
{
  "dueCount": 12,
  "overdueCount": 5,
  "concepts": [...],
  "estimatedTime": 15 // 分钟
}
```

#### 4.3 Email通知发送
**文��**: `lib/email/reminders.ts`

**功能**:
- 使用Resend或SendGrid发送邮件
- 每日定时任务检查待复习卡片
- 发送个性化提醒邮件

#### 4.4 Push通知 (可选)
**文件**: `lib/push/notifications.ts`

**功能**:
- 集成OneSignal或自建
- Web Push API
- 移动端Push

### 前端开发任务

#### 4.5 提醒设置页面
**文件**: `app/reminders/page.tsx`

**功能**:
- 启用/禁用提醒
- 设置提醒时间
- 选择提醒频率
- 预览提醒邮件

#### 4.6 首页提醒卡片
**文件**: `app/page.tsx` (修改)

**改动**:
- 显示今日待复习数
- "开始复习"快捷按钮
- 复习进度条

### 后台任务

#### 4.7 Cron Job
**文件**: `lib/cron/daily-reminder.ts`

**功能**:
- 每日定时检查
- 发送提醒邮件
- 记录发送日志

**实现方案**:
- 使用Vercel Cron Jobs
- 或node-cron自托管

### 技术依赖
- Email服务: Resend ($20/月, 3000封/天)
- Cron服务: Vercel Cron (免费) 或 cron-job.org
- Push服务: OneSignal (免费层)

### 成功指标
- 提醒开启率: >40%
- 复习完成率提升: >25%
- 7日留存率提升: >30%

---

## 🚀 Phase 5+: 未来功能规划

### Phase 5: 社交化功能 (Week 9-12)
- 公开概念卡片库
- 学习小组功能
- 学习成果分享
- 排行榜和挑战

### Phase 6: 移动端优化 (Week 13-16)
- PWA支持
- 移动端UI优化
- 离线模式
- React Native App

### Phase 7: AI增强 (Week 17-20)
- AI对话复习
- 个性化学习路径
- 智能难度调整
- AI生成测验题

### Phase 8: 商业化功能 (Week 21-24)
- 付费订阅API
- 使用限额检查
- Stripe集成
- 企业版功能

---

## 📝 开发规范

### API设计原则

1. **RESTful风格**
   - 使用标准HTTP方法
   - 清晰的资源命名
   - 一致的响应格式

2. **错误处理**
   ```typescript
   // 统一错误响应格式
   {
     "error": "Error message",
     "code": "ERROR_CODE",
     "details": { ... }
   }
   ```

3. **响应格式**
   ```typescript
   // 成功响应
   {
     "data": { ... },
     "meta": {
       "total": 100,
       "page": 1,
       "limit": 20
     }
   }
   ```

4. **认证检查**
   - 所有API必须验证用户身份
   - 使用RLS确保数据隔离
   - 统一使用 `createClient()` 获取用户

### 代码规范

1. **TypeScript严格模式**
   - 所有类型明确定义
   - 避免any类型
   - 使用接口定义API响应

2. **Prisma使用**
   - 使用select优化查询
   - 批量查询使用Promise.all
   - 添加必要的索引

3. **错误日志**
   ```typescript
   console.error('API Error:', {
     endpoint: '/api/concepts',
     error: error.message,
     userId: user.id,
     timestamp: new Date()
   })
   ```

### 测试要求

1. **单元测试**
   - 核心工具函数 (SRS算法等)
   - API路由测试
   - 覆盖率目标: >70%

2. **集成测试**
   - API端到端测试
   - 数据库操作测试
   - 认证流程测试

---

## 📊 进度跟踪

### 里程碑

| 里程碑 | 目标日期 | 状态 | 备注 |
|--------|---------|------|------|
| Phase 1完成 | Week 2 | 🔲 待开始 | 统计可视化 |
| Phase 2完成 | Week 4 | 🔲 待开始 | 搜索功能 |
| Phase 3完成 | Week 6 | 🔲 待开始 | 数据导出 |
| Phase 4完成 | Week 8 | 🔲 待开始 | 复习提醒 |

### 每周检查点

**Week 1**: Phase 1.1-1.3 (统计API)
**Week 2**: Phase 1.4-1.6 (前端集成)
**Week 3**: Phase 2.1-2.3 (搜索API)
**Week 4**: Phase 2.4-2.5 (前端集成)
**Week 5**: Phase 3.1-3.3 (导出API)
**Week 6**: Phase 3.4-3.6 (前端集成)
**Week 7**: Phase 4.1-4.4 (提醒API)
**Week 8**: Phase 4.5-4.7 (前端+Cron)

---

## 🎯 成功指标总结

### 用户增长
- 注册用户: +50% (8周内)
- DAU增长: +30%
- 用户留存: 7日留存 >40%

### 功能使用
- 统计页面访问: >60% DAU
- 搜索使用率: >30% DAU
- 导出功能: >20% DAU
- 复习提醒: >40% 开启率

### 技术质量
- API响应时间: P95 <200ms
- 错误率: <1%
- 测试覆盖率: >70%

---

## 🚦 风险与应对

### 风险1: 开发速度不及预期
**应对**:
- 缩小范围，MVP优先
- 降低非关键功能优先级
- 增加开发资源

### 风险2: 用户需求变化
**应对**:
- 每两周用户调研
- A/B测试验证
- 快速迭代调整

### 风险3: 第三方服务问题
**应对**:
- Email服务有备份方案
- 文件存储支持多云
- 关键功能降级策略

---

## 📋 下一步行动

### 本周 (Week 1)
1. ✅ 完成迭代计划制定
2. 🔲 创建Phase 1的API路由文件
3. 🔲 实现学习统计API
4. 🔲 编写API单元测试

### 下周 (Week 2)
1. 🔲 实现热力图和掌握度API
2. 🔲 创建统计仪表盘页面
3. 🔲 集成图表库
4. 🔴 部署到生产环境

### 持续
1. 每日站会同步进度
2. 每周代码review
3. 每两周发布更新
4. 收集用户反馈

---

**制定人**: 产品 & 技术团队
**最后更新**: 2025-01-13
**版本**: v1.0

---

*本计划将根据实际进展和用户反馈动态调整*
