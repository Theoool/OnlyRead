# 架构重构方案

## 🎯 重构目标

1. **清晰的代码组织** - 按功能和层次划分
2. **统一的开发规范** - 一致的代码风格
3. **可测试性** - 易于编写测试
4. **可维护性** - 易于理解和修改
5. **可扩展性** - 便于添加新功能

---

## 📁 目标架构

```
next-js-ui/
├── app/                          # Next.js App Router
│   ├── (main)/                  # 主应用路由组
│   │   ├── page.tsx            # 首页
│   │   ├── read/               # 阅读页面
│   │   ├── review/             # 复习页面
│   │   ├── search/             # 搜索页面
│   │   ├── stats/              # 统计页面
│   │   ├── layout.tsx          # 主布局
│   │   └── loading.tsx         # 全局加载
│   │
│   ├── (auth)/                 # 认证路由组
│   │   ├── login/
│   │   ├── register/
│   │   ├── callback/
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/            # 管理后台路由组
│   │   ├── page.tsx            # 仪表盘
│   │   ├── articles/           # 文章管理
│   │   ├── concepts/           # 概念管理
│   │   ├── settings/           # 设置
│   │   └── layout.tsx
│   │
│   ├── api/                    # API 路由
│   │   └── v1/                 # API 版本化
│   │       ├── articles/
│   │       ├── concepts/
│   │       ├── search/
│   │       ├── stats/
│   │       └── auth/
│   │
│   ├── error.tsx              # 错误页面
│   ├── not-found.tsx          # 404 页面
│   └── layout.tsx             # 根布局
│
├── lib/                        # 核心库
│   ├── core/                   # 核心业务逻辑
│   │   ├── reading/           # 阅读领域
│   │   │   ├── articles.service.ts
│   │   │   ├── progress.service.ts
│   │   │   ├── session.service.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── learning/          # 学习领域
│   │   │   ├── concepts.service.ts
│   │   │   ├── review.service.ts
│   │   │   ├── srs.service.ts
│   │   │   └── types.ts
│   │   │
│   │   └── search/            # 搜索领域
│   │       ├── search.service.ts
│   │       └── types.ts
│   │
│   ├── infrastructure/         # 基础设施
│   │   ├── database/          # 数据库
│   │   │   ├── prisma.ts
│   │   │   ├── repositories/  # 仓储模式
│   │   │   │   ├── articles.repository.ts
│   │   │   │   ├── concepts.repository.ts
│   │   │   │   └── users.repository.ts
│   │   │   └── migrations/
│   │   │
│   │   ├── api/               # API 客户端
│   │   │   ├── client.ts
│   │   │   └── endpoints.ts
│   │   │
│   │   ├── cache/             # 缓存
│   │   │   ├── memory-cache.ts
│   │   │   └── redis-cache.ts (未来)
│   │   │
│   │   └── storage/           # 存储服务
│   │       ├── local.ts
│   │       └── s3.ts (未来)
│   │
│   ├── ui/                     # UI 层
│   │   ├── components/        # 通用组件
│   │   │   ├── buttons/
│   │   │   ├── inputs/
│   │   │   ├── cards/
│   │   │   ├── modals/
│   │   │   └── index.ts
│   │   │
│   │   ├── features/          # 功能组件
│   │   │   ├── reading/
│   │   │   │   ├── Reader.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   └── ConceptHighlight.tsx
│   │   │   │
│   │   │   ├── learning/
│   │   │   │   ├── ReviewCard.tsx
│   │   │   │   └── ConceptEditor.tsx
│   │   │   │
│   │   │   └── search/
│   │   │       └── SearchBar.tsx
│   │   │
│   │   ├── hooks/             # React hooks
│   │   │   ├── useArticles.ts
│   │   │   ├── useConcepts.ts
│   │   │   └── index.ts
│   │   │
│   │   └── stores/            # 状态管理
│   │       ├── auth.store.ts
│   │       ├── concepts.store.ts
│   │       └── index.ts
│   │
│   ├── shared/                 # 共享代码
│   │   ├── utils/             # 工具函数
│   │   │   ├── date.ts
│   │   │   ├── text.ts
│   │   │   └── validation.ts
│   │   │
│   │   ├── types/             # 类型定义
│   │   │   ├── entities.ts
│   │   │   ├── api.ts
│   │   │   └── ui.ts
│   │   │
│   │   ├── constants/         # 常量
│   │   │   ├── routes.ts
│   │   │   ├── config.ts
│   │   │   └── limits.ts
│   │   │
│   │   └── validators/        # 验证器
│   │       ├── article.ts
│   │       └── concept.ts
│   │
│   └── config/                 # 配置
│       ├── env.ts             # 环境变量
│       ├── features.ts        # 功能开关
│       └── site.ts            # 站点配置
│
├── prisma/                     # 数据库
│   ├── schema.prisma
│   ├── migrations/
│   ├── seeds/
│   └── indexes.sql
│
├── tests/                      # 测试
│   ├── unit/                  # 单元测试
│   ├── integration/           # 集成测试
│   ├── e2e/                   # E2E 测试
│   └── fixtures/              # 测试数据
│
├── public/                     # 静态资源
│   ├── images/
│   ├── fonts/
│   └── icons/
│
├── docs/                       # 文档
│   ├── architecture/
│   ├── api/
│   └── user/
│
└── [配置文件]
```

---

## 🔄 迁移计划

### Phase 1: 基础重构 (Week 1-2)

#### 1.1 目录重组

```bash
# 创建新目录结构
mkdir -p lib/core/{reading,learning,search}
mkdir -p lib/infrastructure/{database,api,cache,storage}
mkdir -p lib/ui/{components,features,hooks,stores}
mkdir -p lib/shared/{utils,types,constants,validators}
mkdir -p tests/{unit,integration,e2e,fixtures}
mkdir -p docs/{architecture,api,user}
```

#### 1.2 类型定义统一

**创建**: `lib/shared/types/entities.ts`
```typescript
// 基于 Prisma 生成，但添加业务逻辑类型
export type Article = Prisma.Article & {
  // 扩展字段
  readingTime?: number
  relatedConcepts?: Concept[]
}

export type Concept = Prisma.Concept & {
  // 扩展字段
  relatedConcepts?: Concept[]
  masteryLevel?: 'new' | 'learning' | 'mature' | 'lapsed'
}

export type ArticleWithProgress = Article & {
  progress: number
  lastReadAt: Date
}
```

**创建**: `lib/shared/types/api.ts`
```typescript
export interface ApiResponse<T> {
  data: T
  error?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export interface SearchParams {
  q: string
  type?: 'all' | 'concepts' | 'articles'
  limit?: number
}

export interface SearchResults {
  concepts: Concept[]
  articles: Article[]
  total: number
  query: string
}
```

#### 1.3 服务层抽象

**示例**: `lib/core/reading/articles.service.ts`
```typescript
import { articlesRepository } from '@/lib/infrastructure/database/repositories'

export class ArticlesService {
  async getAll(userId: string) {
    return articlesRepository.findMany({ where: { userId } })
  }

  async getById(id: string, userId: string) {
    return articlesRepository.findOne({ where: { id, userId } })
  }

  async create(data: CreateArticleDto) {
    // 业务逻辑验证
    // 调用 repository
    // 返回结果
  }

  // ... 其他方法
}

export const articlesService = new ArticlesService()
```

### Phase 2: API 重构 (Week 3)

#### 2.1 API 版本化

**创建**: `app/api/v1/articles/route.ts`
```typescript
import { articlesService } from '@/lib/core/reading/articles.service'
import { handleApiError } from '@/lib/infrastructure/api/utils'

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    const articles = await articlesService.getAll(user.id)
    return NextResponse.json({ data: articles })
  } catch (error) {
    return handleApiError(error)
  }
}
```

#### 2.2 统一错误处理

**创建**: `lib/infrastructure/api/errors.ts`
```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message)
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  // 记录错误
  console.error('API Error:', error)

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

### Phase 3: UI 重构 (Week 4-5)

#### 3.1 组件组织

**重构前**:
```
app/components/
├── ConceptCard.tsx
├── ConceptHud.tsx
├── SearchBar.tsx
├── SelectionToolbar.tsx
└── MigrationCheck.tsx
```

**重构后**:
```
lib/ui/
├── components/               # 通用组件
│   ├── buttons/
│   ├── inputs/
│   └── cards/
│
├── features/                 # 功能组件
│   ├── reading/
│   │   ├── Reader/
│   │   ├── ConceptCard/
│   │   └── SelectionToolbar/
│   │
│   ├── learning/
│   │   ├── ReviewCard/
│   │   └── ConceptEditor/
│   │
│   └── search/
│       └── SearchBar/
```

#### 3.2 Hooks 统一

**创建**: `lib/ui/hooks/useArticles.ts`
```typescript
import { useQuery } from '@tanstack/react-query'
import { articlesService } from '@/lib/core/reading/articles.service'

export function useArticles() {
  return useQuery({
    queryKey: ['articles'],
    queryFn: () => articlesService.getAll(),
    staleTime: 1000 * 60 * 5, // 5分钟
  })
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['articles', id],
    queryFn: () => articlesService.getById(id),
    enabled: !!id,
  })
}

export function useCreateArticle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: articlesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}
```

### Phase 4: 测试添加 (Week 6)

#### 4.1 单元测试

**创建**: `tests/unit/srs.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { calculateSRS } from '@/lib/core/learning/srs.service'

describe('SRS Algorithm', () => {
  it('should calculate next review date correctly', () => {
    const concept = mockConcept()
    const result = calculateSRS(concept, 4)

    expect(result.interval).toBeGreaterThan(0)
    expect(result.nextReviewDate).toBeInstanceOf(Date)
  })
})
```

#### 4.2 集成测试

**创建**: `tests/integration/articles.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { articlesService } from '@/lib/core/reading/articles.service'

describe('Articles Service Integration', () => {
  it('should create and retrieve article', async () => {
    const article = await articlesService.create({
      title: 'Test Article',
      content: 'Test content',
    })

    const found = await articlesService.getById(article.id)

    expect(found).toBeDefined()
    expect(found.title).toBe('Test Article')
  })
})
```

#### 4.3 E2E 测试

**创建**: `tests/e2e/reading.spec.ts`
```typescript
import { test, expect } from '@playwright/test'

test.describe('Reading Flow', () => {
  test('should complete reading session', async ({ page }) => {
    await page.goto('/read?id=test-article')

    // 验证内容加载
    await expect(page.locator('h1')).toContainText('Test Article')

    // 模拟阅读
    await page.keyboard.press('Space')

    // 验证进度
    await expect(page.locator('[data-testid="progress"]')).toContainText('10%')
  })
})
```

---

## 📏 代码规范

### 命名规范

**文件命名**:
- 组件: `PascalCase.tsx` (e.g., `SearchBar.tsx`)
- Hooks: `use*.ts` (e.g., `useArticles.ts`)
- Services: `*.service.ts` (e.g., `articles.service.ts`)
- Types: `*.types.ts` (e.g., `entities.types.ts`)
- Utils: `*.ts` (e.g., `date.ts`)
- Constants: `*.ts` (e.g., `routes.ts`)

**变量命名**:
- 组件: `PascalCase`
- 变量/函数: `camelCase`
- 常量: `UPPER_SNAKE_CASE`
- 类型/接口: `PascalCase`
- 私有变量: `_camelCase`

### 代码组织

**组件文件结构**:
```typescript
// 1. Imports
import { useState } from 'react'
import { SomeComponent } from '@/lib/ui/components'

// 2. Types
interface Props {
  // ...
}

// 3. Constants
const CONSTANT_VALUE = '...'

// 4. Helper functions
function helper() {
  // ...
}

// 5. Main component
export function Component({ props }: Props) {
  // Hooks
  const [state, setState] = useState()

  // Event handlers
  const handleClick = () => {
    // ...
  }

  // Effects
  useEffect(() => {
    // ...
  }, [])

  // Render
  return <div>...</div>
}
```

### 注释规范

```typescript
/**
 * 文章服务
 * 提供文章的 CRUD 操作
 *
 * @module ArticlesService
 * @example
 * ```ts
 * const article = await articlesService.create(data)
 * ```
 */
export class ArticlesService {
  /**
   * 获取所有文章
   *
   * @param userId - 用户 ID
   * @returns 文章列表
   * @throws {ApiError} 当用户不存在时
   */
  async getAll(userId: string): Promise<Article[]> {
    // 实现...
  }
}
```

---

## 🔧 工具配置

### ESLint

**创建**: `.eslintrc.js`
```javascript
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['error', 'warn'] }]
  }
}
```

### Prettier

**创建**: `.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### TypeScript

**创建**: `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./lib/*"],
      "@/components/*": ["./lib/ui/components/*"],
      "@/features/*": ["./lib/ui/features/*"]
    }
  }
}
```

---

## 📊 重构评估

### 重构收益

| 指标 | 重构前 | 重构后 | 提升 |
|------|--------|--------|------|
| 代码组织性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 可维护性 | ⭐⭐ | ⭐⭐⭐⭐ | +100% |
| 可测试性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 开发效率 | ⭐⭐⭐ | ⭐⭐⭐⭐ | +33% |
| Bug 率 | 高 | 低 | -50% |

### 重构风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 功能回归 | 中 | 高 | 完善测试 |
| 开发延期 | 低 | 中 | 分阶段进行 |
| 学习成本 | 中 | 低 | 文档和培训 |

### 投入产出

**投入**:
- 时间: 6 周
- 人力: 2 人
- 成本: 中等

**产出**:
- 长期维护成本 -40%
- 新功能开发速度 +50%
- Bug 修复速度 +60%
- 代码审查效率 +80%

**ROI**: 6 个月后回本，长期收益显著

---

## 🎯 执行建议

### 优先级

1. **立即执行** (本周):
   - [ ] 创建目录结构
   - [ ] 统一类型定义
   - [ ] 添加错误处理

2. **短期执行** (2周内):
   - [ ] 重构服务层
   - [ ] API 版本化
   - [ ] UI 组件重组

3. **中期执行** (1个月内):
   - [ ] 完善测试覆盖
   - [ ] 性能优化
   - [ ] 文档完善

### 注意事项

1. **渐进式重构** - 不要大爆炸式重写
2. **保持功能同步** - 重构期间功能不变
3. **测试先行** - 先写测试再重构
4. **文档同步** - 代码和文档同步更新
5. **团队协作** - 重构需要全员参与

---

## 📚 参考资料

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Next.js Best Practices](https://nextjs.org/docs)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/overview)

---

**架构重构不是一蹴而就的，而是一个持续改进的过程。让我们一起打造一个优雅的代码库！** 🚀
