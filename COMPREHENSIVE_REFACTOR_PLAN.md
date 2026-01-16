# 🚀 Anti-AI Reader 完整重构计划

**计划版本**: v2.0
**制定日期**: 2025-01-16
**预计开始**: 2025-01-17
**预计完成**: 2025-01-31 (2周)
**优先级**: 🔥 CRITICAL

---

## 📋 目录

1. [重构目标](#重构目标)
2. [重构原则](#重构原则)
3. [技术方案](#技术方案)
4. [详细计划](#详细计划)
5. [测试策略](#测试策略)
6. [部署方案](#部署方案)
7. [风险管理](#风险管理)
8. [验收标准](#验收标准)

---

## 🎯 重构目标

### 业务目标

**重构前**:
```
Book功能可用率: 0%
数据丢失风险: 30%
搜索响应时间: 3s
用户满意度: 2星
```

**重构后**:
```
Book功能可用率: 100%
数据丢失风险: < 1%
搜索响应时间: < 300ms
用户满意度: 4星
```

### 技术目标

**架构质量**:
```
代码可维护性: D → B
API标准化率: 30% → 90%
测试覆盖率: 0% → 80%
性能评分: D → B
```

**开发效率**:
```
Bug修复时间: -60%
新功能开发速度: +100%
Code Review时间: -40%
部署失败率: -80%
```

---

## 📐 重构原则

### 1. 业务连续性原则

**原则**: 重构期间不影响现有功能使用

**措施**:
- ✅ 使用特性开关 (Feature Flags)
- ✅ 灰度发布 (Canary Deployment)
- ✅ 数据库迁移向后兼容
- ✅ API版本化

```typescript
// 示例: 特性开关
const BOOK_REDESIGN_ENABLED = process.env.FEATURE_BOOK_REDESIGN === 'true';

if (BOOK_REDESIGN_ENABLED) {
  // 新逻辑
} else {
  // 旧逻辑
}
```

---

### 2. 数据完整性原则

**原则**: 不允许任何数据丢失

**措施**:
- ✅ 数据库迁移前备份
- ✅ 双写验证 (新旧系统同时写入)
- ✅ 回滚计划
- ✅ 数据校验脚本

```sql
-- 示例: 数据完整性检查
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM articles a
  LEFT JOIN collections c ON a.collection_id = c.id
  WHERE a.collection_id IS NOT NULL AND c.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphan articles', orphan_count;
  END IF;
END $$;
```

---

### 3. 渐进式重构原则

**原则**: 分阶段重构，每个阶段都可独立回滚

**阶段划分**:
```
Phase 0: 准备 (1天)
  ├─ 代码冻结
  ├─ 数据备份
  └─ 环境准备

Phase 1: 数据库修复 (2天)
  ├─ 添加约束
  ├─ 修复数据
  └─ 性能优化

Phase 2: API标准化 (3天)
  ├─ RESTful重构
  ├─ 错误处理统一
  └─ 文档生成

Phase 3: 前端重构 (3天)
  ├─ 状态管理统一
  ├─ 组件拆分
  └─ 性能优化

Phase 4: Book功能 (3天)
  ├─ 信息栏
  ├─ 导航系统
  └─ 进度同步

Phase 5: 测试与部署 (2天)
  ├─ 集成测试
  ├─ 性能测试
  └─ 灰度发布
```

---

## 🛠️ 技术方案

### Phase 0: 准备阶段 (Day 0)

#### 环境准备

```bash
# 1. 创建重构分支
git checkout -b refactor/comprehensive-v2
git push -u origin refactor/comprehensive-v2

# 2. 数据备份
pg_dump -U postgres -d anti_ai_reader > backup_$(date +%Y%m%d).sql

# 3. 准备测试数据库
createdb -U postgres anti_ai_reader_test
psql -U postgres -d anti_ai_reader_test < backup_$(date +%Y%m%d).sql

# 4. 配置Feature Flags
# .env.local
FEATURE_BOOK_REDESIGN=false
FEATURE_NEW_SEARCH=false
FEATURE_UNIFIED_STATE=false
```

#### 代码冻结

```bash
# 创建baseline tag
git tag -a v1.0.0-baseline -m "重构前基线"
git push origin v1.0.0-baseline

# 创建release分支
git checkout -b release/1.0.0
git push origin release/1.0.0
```

---

### Phase 1: 数据库修复 (Day 1-2)

#### 1.1 Schema修复

**新Schema** (prisma/schema.prisma):

```prisma
// ============================================
// Article Model - 修复版
// ============================================
model Article {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content
  title           String?   @db.VarChar(1000)
  content         String    @db.Text
  type            String    @default("markdown") @db.VarChar(50)

  // Source
  url             String?   @db.Text
  domain          String?   @db.VarChar(255)

  // Collection关系 - 修复
  collectionId    String?   @map("collection_id") @db.Uuid
  collection      Collection? @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  order           Int?      @default(0)

  // 进度聚合
  progress        Int       @default(0)
  currentPosition  Int       @default(0) @map("current_position")
  totalBlocks     Int       @default(0) @map("total_blocks")
  completedBlocks Int       @default(0) @map("completed_blocks")

  // Metadata
  embedding       Unsupported("vector(1536)")?

  // Statistics
  readingStartTime DateTime? @map("reading_start_time")
  readingEndTime  DateTime? @map("reading_end_time")
  totalReadingTime Int      @default(0) @map("total_reading_time")

  // Timestamps
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  // Relations
  readingSessions ReadingSession[]
  concepts        Concept[]

  @@unique([collectionId, order])  // ✅ 新增: 确保章节顺序唯一
  @@index([userId, progress])      // ✅ 新增: 按进度查询
  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, type])
  @@index([collectionId, order])   // ✅ 保留: 已有索引
  @@map("articles")
}

// ============================================
// Collection Model - 增强版
// ============================================
model Collection {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 基本信息
  title       String
  description String?
  cover       String?
  type        String    @default("SERIES") // SERIES, BOOK, COURSE

  // ✅ 新增: Book元数据
  author      String?   @db.VarChar(255)
  language    String?   @default("zh-CN") @db.VarChar(10)
  isbn        String?   @unique @db.VarChar(50)

  // ✅ 新增: 进度聚合
  totalChapters   Int     @default(0) @map("total_chapters")
  completedChapters Int   @default(0) @map("completed_chapters")
  readingProgress Float?  @default(0) @map("reading_progress")

  // ✅ 新增: 统计
  totalWords      BigInt?  @map("total_words")
  estimatedReadTime Int?   @map("estimated_read_time")  -- minutes

  // ✅ 新增: 用户偏好
  userPreferences Json?    @map("user_preferences")

  // Relations
  articles    Article[]

  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([userId, updatedAt(sort: Desc)])
  @@map("collections")
}

// ============================================
// Concept Model - 关联修复
// ============================================
model Concept {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 内容
  term             String    @db.VarChar(255)
  myDefinition     String    @db.Text @map("my_definition")
  myExample        String    @db.Text @map("my_example")
  myConnection     String?   @db.Text @map("my_connection")
  confidence       Int       @default(3) @db.SmallInt

  // AI辅助
  aiDefinition     String?   @db.Text @map("ai_definition")
  aiExample        String?   @db.Text @map("ai_example")
  aiRelatedConcepts Json?    @default("[]") @map("ai_related_concepts")

  // 向量搜索
  embedding        Unsupported("vector(1536)")?

  // 关联 - ✅ 修复
  sourceArticleId  String?   @map("source_article_id") @db.Uuid
  article          Article?  @relation(fields: [sourceArticleId], references: [id], onDelete: SetNull)

  isAiCollected     Boolean   @default(false) @map("is_ai_collected")

  // SRS算法
  lastReviewedAt   DateTime? @map("last_reviewed_at")
  reviewCount      Int       @default(0) @map("review_count")
  nextReviewDate   DateTime? @map("next_review_date")
  easeFactor       Decimal   @default(2.5) @map("ease_factor") @db.Decimal(5, 2)
  interval         Int       @default(0)

  // 标签
  tags             String[]  @default([])

  // 软删除
  deletedAt        DateTime? @map("deleted_at")

  // Relations
  reviewHistory    ReviewHistory[]

  @@index([userId])
  @@index([userId, nextReviewDate])  // ✅ 新增: 查询待复习概念
  @@index([tags], type: Gin)
  @@index([userId, createdAt(sort: Desc)])
  @@index([sourceArticleId])         // ✅ 新增: 查询某篇文章的概念
  @@index([userId, term])
  @@map("concepts")
}
```

#### 1.2 数据迁移

**Migration SQL** (已创建: `prisma/migrations/20250116_fix_book_schema/migration.sql`)

```bash
# 执行迁移
npx prisma migrate dev --name fix_book_schema

# 或者手动执行
psql -U postgres -d anti_ai_reader -f prisma/migrations/20250116_fix_book_schema/migration.sql
```

#### 1.3 数据验证

**验证脚本** (`scripts/validate-migration.ts`):

```typescript
import { prisma } from '@/lib/infrastructure/database/prisma';

async function validateMigration() {
  console.log('🔍 验证数据迁移...\n');

  // 1. 检查外键约束
  const orphanArticles = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM articles a
    LEFT JOIN collections c ON a.collection_id = c.id
    WHERE a.collection_id IS NOT NULL AND c.id IS NULL
  `;
  console.log(`❌ 孤儿文章: ${orphanArticles[0].count} (应该为0)`);

  // 2. 检查order唯一性
  const duplicateOrders = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM (
      SELECT collection_id, "order", COUNT(*)
      FROM articles
      WHERE collection_id IS NOT NULL AND "order" IS NOT NULL
      GROUP BY collection_id, "order"
      HAVING COUNT(*) > 1
    ) duplicates
  `;
  console.log(`❌ 重复order: ${duplicateOrders[0].count} (应该为0)`);

  // 3. 检查Collection统计
  const collections = await prisma.collection.findMany({
    select: {
      id: true,
      title: true,
      totalChapters: true,
      _count: { select: { articles: true } }
    }
  });

  console.log('\n📊 Collection统计:');
  for (const col of collections) {
    const expected = col._count.articles;
    const actual = col.totalChapters;
    const match = expected === actual ? '✅' : '❌';
    console.log(`${match} ${col.title}: ${actual}/${expected} 章节匹配`);
  }

  console.log('\n✅ 数据验证完成');
}

validateMigration().catch(console.error);
```

---

### Phase 2: API标准化 (Day 3-5)

#### 2.1 RESTful API重构

**文件结构**:
```
app/api/
├── articles/
│   ├── route.ts                    ✅ GET /api/articles (列表)
│   └── [id]/
│       └── route.ts                ✅ GET/PUT/DELETE /api/articles/:id
├── collections/
│   ├── route.ts                    ✅ GET/POST /api/collections
│   └── [id]/
│       ├── route.ts                ✅ GET/PUT/DELETE /api/collections/:id
│       ├── chapters/
│       │   └── route.ts            ✅ GET /api/collections/:id/chapters
│       └── progress/
│           └── route.ts            ✅ GET /api/collections/:id/progress
├── concepts/
│   ├── route.ts                    ✅ GET/POST /api/concepts
│   ├── [id]/
│   │   └── route.ts                ✅ GET/PUT/DELETE /api/concepts/:id
│   ├── due/
│   │   └── route.ts                ✅ GET /api/concepts/due
│   ├── review/
│   │   └── route.ts                ✅ POST /api/concepts/review
│   └── article/
│       └── [articleId]/
│           └── route.ts            ✅ GET /api/concepts/article/:articleId
└── stats/
    ├── reading/
    │   └── route.ts                ✅ GET /api/stats/reading
    └── streak/
        └── route.ts                ✅ GET /api/stats/streak
```

**API规范**:

```typescript
// 统一响应格式
interface APIResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: number;
    requestId: string;
  };
}

// 统一错误处理
// lib/infrastructure/error/handler.ts
export class APIError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

// 使用示例
export const GET = apiHandler(async (req: Request) => {
  const { id } = params;

  const article = await ArticlesRepository.findById(id, userId);
  if (!article) {
    throw new APIError('ARTICLE_NOT_FOUND', 404, 'Article not found');
  }

  return createSuccessResponse({ data: article });
});
```

#### 2.2 OpenAPI文档生成

**安装依赖**:
```bash
npm install --save-dev swagger-jsdoc
```

**配置** (`app/api/docs/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Anti-AI Reader API',
      version: '2.0.0',
      description: '深度阅读与间隔重复学习系统API',
    },
  },
  apis: ['./app/api/**/*.ts'],
};

const spec = swaggerJsdoc(options);

export async function GET() {
  return NextResponse.json(spec);
}
```

---

### Phase 3: 前端重构 (Day 6-8)

#### 3.1 统一状态管理

**新架构**:
```
数据层:
  ├─ React Query (服务器状态)
  │   ├─ useArticle()
  │   ├─ useArticles()
  │   ├─ useCollection()
  │   ├─ useConcepts()
  │   └─ useReadingStats()
  │
  └─ Zustand (客户端UI状态)
      └─ useUIStore()
          ├─ isSidebarOpen
          ├─ selectedChapter
          └─ theme
```

**移除localStorage依赖**:

```typescript
// ❌ 移除这样的代码
const stats = JSON.parse(localStorage.getItem('stats'));

// ✅ 替换为
// lib/hooks/use-reading-stats.ts
export function useReadingStats() {
  return useQuery({
    queryKey: ['stats', 'reading'],
    queryFn: async () => {
      const response = await fetch('/api/stats/reading');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}
```

#### 3.2 组件拆分

**Book功能组件**:

```typescript
// app/components/book/
├── BookInfoBar.tsx              // Book信息栏
├── ChapterNavigator.tsx         // 章节导航
├── ChapterListSidebar.tsx       // 章节列表侧边栏
├── ChapterProgress.tsx          // 章节进度
└── AutoAdvanceModal.tsx         // 自动跳转模态框
```

**使用示例**:

```typescript
// app/read/page.tsx
import { BookInfoBar } from '@/app/components/book/BookInfoBar';
import { ChapterNavigator } from '@/app/components/book/ChapterNavigator';

function ReadContent() {
  const { data: article } = useArticle(id);

  return (
    <div>
      {article?.collectionId && (
        <>
          <BookInfoBar collection={collection} article={article} />
          <ChapterNavigator article={article} />
        </>
      )}
      {/* ... 其他内容 */}
    </div>
  );
}
```

---

### Phase 4: Book功能完整实现 (Day 9-11)

#### 4.1 Book信息栏

**组件** (`app/components/book/BookInfoBar.tsx`):

```typescript
interface BookInfoBarProps {
  collection: Collection;
  article: Article;
  currentChapter: number;
  totalChapters: number;
  bookProgress: number;
}

export function BookInfoBar({
  collection,
  article,
  currentChapter,
  totalChapters,
  bookProgress
}: BookInfoBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Book标题和章节信息 */}
        <div className="flex items-center gap-4">
          <BookOpen className="w-4 h-4 text-zinc-500" />
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {collection.title}
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              第 {currentChapter} / {totalChapters} 章 • {article.title}
            </p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500">{bookProgress}%</span>
          <div className="w-32 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500"
              style={{ width: `${bookProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4.2 章节导航

**组件** (`app/components/book/ChapterNavigator.tsx`):

```typescript
export function ChapterNavigator({ article }: { article: Article }) {
  const router = useRouter();

  const { data: navigation } = useQuery({
    queryKey: ['navigation', article.collectionId, article.id],
    queryFn: () => fetchChapterNavigation(article.collectionId!, article.id),
  });

  if (!navigation) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 px-2 py-2">
        {navigation.prevChapter && (
          <button
            onClick={() => router.push(`/read?id=${navigation.prevChapter.id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs">上一章</span>
          </button>
        )}

        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {navigation.nextChapter && (
          <button
            onClick={() => router.push(`/read?id=${navigation.nextChapter.id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <span className="text-xs">下一章</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
```

#### 4.3 API端点

**获取章节导航** (`app/api/collections/[id]/navigation/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/infrastructure/database/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 获取Collection的所有章节，按order排序
  const collection = await prisma.collection.findUnique({
    where: { id, userId: user.id },
    include: {
      articles: {
        where: { deletedAt: null },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
          progress: true,
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  // 构建导航数据
  const articles = collection.articles;
  const navigation = {
    totalChapters: articles.length,
    chapters: articles.map((article, idx) => ({
      ...article,
      chapterNumber: idx + 1,
      isCompleted: article.progress >= 99,
    })),
  };

  return NextResponse.json({ navigation });
}
```

---

### Phase 5: 测试与部署 (Day 12-14)

#### 5.1 单元测试

**安装依赖**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

**测试示例** (`lib/core/reading/articles.service.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  beforeEach(() => {
    vi.mock('@/lib/infrastructure/api/client');
  });

  describe('getArticle', () => {
    it('should return article with collectionId', async () => {
      const mockArticle = {
        id: '123',
        title: 'Test Article',
        collectionId: 'collection-123',
        order: 1,
      };

      vi.mocked(get).mockResolvedValue({ article: mockArticle });

      const result = await ArticlesService.getArticle('123');

      expect(result).toHaveProperty('collectionId', 'collection-123');
      expect(result).toHaveProperty('order', 1);
    });

    it('should handle articles without collection', async () => {
      const mockArticle = {
        id: '123',
        title: 'Test Article',
        collectionId: null,
      };

      vi.mocked(get).mockResolvedValue({ article: mockArticle });

      const result = await ArticlesService.getArticle('123');

      expect(result.collectionId).toBeUndefined();
    });
  });
});
```

#### 5.2 集成测试

**E2E测试** (`tests/e2e/book-reading.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test.describe('Book Reading Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should display book info bar when reading a chapter', async ({ page }) => {
    // 导入EPUB
    await page.click('text=导入文件');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-files/sample-book.epub');
    await page.click('text=确认导入');

    // 等待导入完成
    await page.waitForSelector('text=导入成功');

    // 点击第一章
    await page.click('text=第1章');

    // 验证Book信息栏显示
    await expect(page.locator('[data-testid="book-info-bar"]')).toBeVisible();
    await expect(page.locator('text=/第.*章/')).toBeVisible();
    await expect(page.locator('[data-testid="book-progress"]')).toBeVisible();
  });

  test('should navigate to next chapter', async ({ page }) => {
    await page.goto('/read?id=chapter-1');

    // 点击下一章
    await page.click('text=下一章');

    // 验证URL更新
    await expect(page).toHaveURL(/read?id=chapter-2/);

    // 验证Book信息栏更新
    await expect(page.locator('text=/第 2 /.* 章/')).toBeVisible();
  });

  test('should show chapter list in sidebar', async ({ page }) => {
    await page.goto('/read?id=chapter-1');

    // 点击章节按钮
    await page.click('text=章节');

    // 验证侧边栏显示
    const sidebar = page.locator('[data-testid="chapter-sidebar"]');
    await expect(sidebar).toBeVisible();

    // 验证章节列表
    await expect(sidebar.locator('text=第1章')).toBeVisible();
    await expect(sidebar.locator('text=第2章')).toBeVisible();

    // 点击第二章
    await sidebar.locator('text=第2章').click();

    // 验证跳转
    await expect(page).toHaveURL(/read?id=chapter-2/);
  });
});
```

#### 5.3 性能测试

**测试脚本** (`scripts/performance-test.ts`):

```typescript
import { performance } from 'perf_hooks';

async function testAPILatency() {
  const tests = [
    { name: '获取文章列表', url: '/api/articles' },
    { name: '获取Collection详情', url: '/api/collections/test-id' },
    { name: '搜索概念', url: '/api/search?q=test' },
  ];

  console.log('🚀 API性能测试\n');

  for (const test of tests) {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await fetch(test.url);
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`${test.name}:`);
    console.log(`  平均: ${avg.toFixed(0)}ms`);
    console.log(`  最小: ${min.toFixed(0)}ms`);
    console.log(`  最大: ${max.toFixed(0)}ms`);
    console.log(`  状态: ${avg < 500 ? '✅' : '❌'}\n`);
  }
}

testAPILatency().catch(console.error);
```

#### 5.4 部署流程

**CI/CD配置** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 📊 验收标准

### 功能验收

| 功能 | 验收标准 | 测试方法 | 状态 |
|------|---------|---------|------|
| **Book信息栏** | 显示Book标题、章节位置、进度 | 导入EPUB → 阅读章节 | ⏳ 待测试 |
| **章节导航** | 上一章/下一章按钮正常工作 | 点击按钮 → 验证跳转 | ⏳ 待测试 |
| **章节列表** | 侧边栏显示所有章节 | 点击"章节"按钮 | ⏳ 待测试 |
| **自动跳转** | 完成章节后5秒倒计时自动跳转 | 阅读到章节末尾 | ⏳ 待测试 |
| **进度同步** | Book进度实时更新 | 完成章节 → 检查进度 | ⏳ 待测试 |

### 性能验收

| 指标 | 目标 | 测试方法 | 状态 |
|------|------|---------|------|
| **文章列表加载** | < 500ms | Performance API | ⏳ 待测试 |
| **Book章节切换** | < 300ms | Navigation Timing | ⏳ 待测试 |
| **搜索响应** | < 300ms | API latency test | ⏳ 待测试 |
| **首屏渲染** | < 2s | Lighthouse | ⏳ 待测试 |

### 稳定性验收

| 检查项 | 标准 | 状态 |
|--------|------|------|
| **数据完整性** | 无孤儿数据 | ⏳ 待检查 |
| **外键约束** | 所有关系有效 | ⏳ 待检查 |
| **错误处理** | 所有错误有友好提示 | ⏳ 待检查 |
| **无console错误** | 0个error/warning | ⏳ 待检查 |

---

## 🎯 实施时间表

### Week 1: 基础重构

| 日期 | 任务 | 负责人 | 工时 | 状态 |
|------|------|--------|------|------|
| Day 0 | 准备阶段 | 全员 | 8h | ⏳ 待开始 |
| Day 1-2 | 数据库修复 | 后端 | 16h | ⏳ 待开始 |
| Day 3-5 | API标准化 | 后端 | 24h | ⏳ 待开始 |
| Day 6-8 | 前端重构 | 前端 | 24h | ⏳ 待开始 |

### Week 2: 功能实现

| 日期 | 任务 | 负责人 | 工时 | 状态 |
|------|------|--------|------|------|
| Day 9-11 | Book功能 | 全栈 | 24h | ⏳ 待开始 |
| Day 12-14 | 测试部署 | 全员 | 16h | ⏳ 待开始 |

**总计**: 112小时 (2周全职工作)

---

## 🚨 风险管理

### 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|------|------|------|---------|--------|
| **数据丢失** | 低 | 严重 | 完整备份 + 回滚脚本 | 后端 |
| **功能回退** | 中 | 中 | 特性开关 + 灰度发布 | 前端 |
| **性能下降** | 低 | 中 | 性能测试 + 索引优化 | 后端 |
| **延期** | 中 | 中 | 缓冲时间 + MVP优先 | PM |

### 回滚计划

**触发条件**:
- 严重Bug > 5个
- 性能下降 > 30%
- 用户投诉 > 10个/天

**回滚步骤**:
```bash
# 1. 回滚代码
git revert HEAD
git push origin main

# 2. 回滚数据库
psql -U postgres -d anti_ai_reader -f prisma/migrations/rollback.sql

# 3. 重启服务
pm2 restart all

# 4. 验证
curl -X GET http://localhost:3000/api/collections
```

---

## 📈 成功指标

### 开发指标

- ✅ 代码审查通过率 > 95%
- ✅ 测试覆盖率 > 80%
- ✅ API文档完整度 100%
- ✅ 无P0/P1 Bug遗留

### 业务指标

- ✅ Book功能可用率 0% → 100%
- ✅ 用户投诉率 -80%
- ✅ 用户留存率 +20%
- ✅ NPS评分 2星 → 4星

---

**计划制定**: AI架构师
**审核状态**: 待用户批准
**下一步**: 获得批准后立即执行Phase 0

---

## 💬 决策点

请确认以下决策：

1. **是否同意完整重构？**
   - [ ] 同意 - 按照本计划执行
   - [ ] 不同意 - 需要调整计划
   - [ ] 需要更多信息

2. **重构时间是否可接受？**
   - [ ] 2周可接受
   - [ ] 需要延长到3周
   - [ ] 需要缩短到1周

3. **优先级是否正确？**
   - [ ] 同意Book功能优先
   - [ ] 应该先优化搜索
   - [ ] 其他优先级

请回复您的决策，我将立即开始执行！
