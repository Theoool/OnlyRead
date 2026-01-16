# 🧠 开发者架构指南 (Developer Architecture Guide)

> "Programs must be written for people to read, and only incidentally for machines to execute."

## 1. 核心架构设计 (Core Architecture)

本项目采用 **领域驱动设计 (DDD)** 和 **六边形架构 (Hexagonal Architecture)** 的简化变体。
我们的目标是分离 **业务逻辑**、**基础设施** 和 **控制层**。

### 目录结构 (Directory Structure)

```
lib/
├── core/                     # 业务核心 (Domain Layer)
│   ├── reading/             # 阅读领域
│   │   ├── articles.repository.ts  # 服务端数据访问 (Prisma)
│   │   └── articles.service.ts     # 客户端 API 封装 (Fetch)
│   └── learning/            # 学习领域 (Concept, Review)
│
├── infrastructure/           # 基础设施 (Infrastructure Layer)
│   ├── database/            # 数据库连接 (Prisma)
│   ├── api/                 # API 响应与错误处理
│   └── error/               # 自定义错误类
│
└── shared/                   # 共享内核 (Shared Kernel)
    ├── validation/          # Zod Schemas
    ├── types/               # TypeScript 类型
    └── utils/               # 工具函数
```

---

## 2. 如何开发新功能 (How to Build New Features)

遵循以下 **标准开发流 (Standard Flow)**：

### Step 1: 定义数据校验 (Validation)
在 `lib/shared/validation/schemas.ts` 中定义 Zod Schema。
*   这不仅用于后端校验，前端表单也可以复用。

```typescript
export const NewFeatureSchema = z.object({
  title: z.string().min(1),
  // ...
});
```

### Step 2: 实现服务端逻辑 (Repository)
在 `lib/core/<domain>/<feature>.repository.ts` 中封装 Prisma 操作。
*   **不要**在 API Route 中直接写 `prisma.findMany`。
*   Repository 负责处理数据查询、更新和软删除逻辑。
*   Repository 抛出 `NotFoundError` 等标准错误。

### Step 3: 实现 API 路由 (Controller)
在 `app/api/<feature>/route.ts` 中调用 Repository。
*   使用 `apiHandler` 包裹处理函数，自动捕获错误。
*   使用 `Zod` 解析请求体。
*   使用 `createSuccessResponse` 返回结果。

```typescript
export const POST = apiHandler(async (req) => {
  const user = await requireUser();
  const json = await req.json();
  const data = NewFeatureSchema.parse(json); // 自动校验
  const result = await NewFeatureRepository.create(user.id, data);
  return createSuccessResponse({ result }, 201);
});
```

### Step 4: 封装客户端服务 (Client Service)
在 `lib/core/<domain>/<feature>.service.ts` 中封装 Fetch 调用。
*   UI 组件只调用 Service，不直接调用 fetch。

---

## 3. 错误处理机制 (Error Handling)

我们拥有一套统一的错误处理系统：

*   **AppError**: 所有自定义错误的基类。
*   **Validation Error (400)**: 当 Zod 校验失败时自动抛出。
*   **Unauthorized (401)**: 当用户未登录时抛出。
*   **Not Found (404)**: 当 Repository 找不到资源时抛出。

**API 响应格式**:
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [ ...zod errors... ]
}
```

---

## 4. 下一步建议 (Next Steps)

*   在添加新实体（如 `Tag` 或 `Graph`）时，请严格复制此模式。
*   保持 Controller (API Route) 极度精简，它只负责 HTTP 协议转换。
*   业务逻辑全部下沉到 Repository 或 Domain Service。
