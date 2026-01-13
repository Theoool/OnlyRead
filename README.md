# Anti-AI Reader - 深度阅读与间隔重复学习系统

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

**一个创新的深度阅读应用，通过强制慢阅读、概念卡片收集和间隔重复算法，促进深度学习和记忆**

[功能特性](#功能特性) • [快速开始](#快速开始) • [部署指南](#部署指南) • [技术栈](#技术栈)

</div>

---

## 📖 项目简介

Anti-AI Reader 是一个"反AI"的阅读应用，旨在对抗现代信息过载和AI辅助阅读带来的浅层理解。通过以下独特设计实现深度学习：

- **强制慢阅读**：逐块展示文本，控制阅读节奏
- **主动学习**：必须手写定义和例子，禁用抄袭
- **间隔重复**：基于SuperMemo2算法的智能复习系统
- **本地优先**：数据完全本地存储，保护隐私
- **云端同步**：可选的Supabase云端同步支持

---

## ✨ 功能特性

### 📚 深度阅读模式

- ✅ 逐块/逐句展示文本，强制按节奏阅读
- ✅ 智能文本分割（Markdown和纯文本）
- ✅ 阅读进度自动保存
- ✅ 键盘快捷键支持（空格前进、左箭头后退）
- ✅ 响应式设计，暗色模式支持

### 🧠 概念卡片系统

- ✅ 选择文本即时创建概念卡片
- ✅ AI辅助生成定义和例子（可选）
- ✅ 强制手写，防止抄袭
- ✅ 自定义关联和置信度评级
- ✅ 每篇文章最多5张卡片，保证质量
- ✅ 24小时智能缓存，减少API调用

### 🔄 间隔重复复习

- ✅ 基于SuperMemo2算法
- ✅ 智能计算下次复习时间
- ✅ 四级评分系统（忘记/困难/良好/简单）
- ✅ 自动调整难度系数
- ✅ 复习历史追踪

### 📥 多源内容导入

- ✅ URL抓取并转换为Markdown
- ✅ 直接粘贴文本
- ✅ 上传Markdown和文本文件
- ✅ 智能清理和格式化

### 👤 用户认证（新功能）

- ✅ 邮箱密码注册/登录
- ✅ Supabase Auth集成
- ✅ 安全的会话管理
- ✅ 受保护的路由

### ☁️ 云端同步（新功能）

- ✅ Supabase数据库存储
- ✅ 跨设备数据同步
- ✅ 概念卡片云端备份
- ✅ 阅读历史追踪
- ✅ 一键数据迁移工具

---

## 🚀 快速开始

### 前置要求

- Node.js 20+
- npm 或 yarn
- Git

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/anti-ai-reader.git
cd anti-ai-reader/next-js-ui

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入必要配置（见下方说明）

# 4. 初始化数据库（如使用Supabase）
npx prisma generate
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 纯前端模式（无需后端）

如果没有配置Supabase，应用仍可作为纯前端应用使用：

1. 所有数据存储在浏览器localStorage
2. 可以正常使用所有阅读和复习功能
3. 数据仅限当前设备，无法跨设备同步

---

## ⚙️ 配置说明

### 最小配置（纯前端模式）

```bash
# 仅需OpenAI API密钥（用于AI生成概念卡片）
OPENAI_API_KEY=sk-your-openai-api-key
AI_MODEL_NAME=gpt-4o-mini
```

### 完整配置（全栈模式）

```bash
# Database Configuration (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key
AI_MODEL_NAME=gpt-4o-mini

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

详细配置步骤请参考：
- [部署指南](DEPLOYMENT.md)
- [GitHub OAuth 配置指南](GITHUB_OAUTH_SETUP.md) - 配置 GitHub 第三方登录

---

## 🐳 Docker部署

### 快速启动

```bash
# 1. 配置环境变量
cp .env.local.example .env.production
# 编辑 .env.production

# 2. 构建并启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f web
```

### 手动构建

```bash
docker build -t anti-ai-reader:latest .
docker run -p 3000:3000 --env-file .env.production anti-ai-reader:latest
```

---

## 📦 部署指南

详细的部署指南请查看 [DEPLOYMENT.md](DEPLOYMENT.md)，包括：

- ✅ Supabase项目配置
- ✅ 数据库设置和迁移
- ✅ 环境变量配置
- ✅ Docker部署
- ✅ 云服务部署（Railway/Render/VPS）
- ✅ 数据迁移工具使用
- ✅ 常见问题解决

---

## 🏗️ 技术栈

### 前端

- **框架**: Next.js 16.0 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **动画**: Framer Motion
- **组件**: Radix UI
- **图标**: Lucide React
- **Markdown**: react-markdown + rehype-highlight
- **状态管理**: Zustand

### 后端

- **数据库**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **认证**: Supabase Auth
- **API**: Next.js API Routes / Server Actions

### DevOps

- **容器化**: Docker + Docker Compose
- **代码质量**: ESLint + TypeScript
- **版本控制**: Git

---

## 📂 项目结构

```
next-js-ui/
├── app/                      # Next.js App Router
│   ├── api/                  # API路由
│   │   ├── auth/            # 认证相关API
│   │   ├── concepts/        # 概念卡片API
│   │   ├── articles/        # 文章API
│   │   └── migration/       # 数据迁移API
│   ├── components/          # React组件
│   ├── read/               # 阅读页面
│   ├── review/             # 复习页面
│   └── options/            # 设置页面
├── lib/                     # 核心业务逻辑
│   ├── prisma.ts           # Prisma客户端
│   ├── supabase/           # Supabase配置
│   ├── srs.ts              # SuperMemo2算法
│   ├── store/              # Zustand状态管理
│   └── migration.ts        # 数据迁移工具
├── prisma/                 # Prisma配置
│   └── schema.prisma       # 数据库Schema
├── public/                 # 静态资源
├── Dockerfile              # 生产环境Docker配置
├── docker-compose.yml      # Docker Compose配置
└── DEPLOYMENT.md           # 部署指南
```

---

## 🔄 从纯前端升级到全栈

如果您之前使用纯前端版本，可以轻松迁移到全栈版本：

1. **配置Supabase**（参考 [DEPLOYMENT.md](DEPLOYMENT.md)）
2. **启动应用并登录**
3. **在设置页面点击"数据迁移"**
4. **数据将自动同步到云端**

迁移工具会：
- 自动备份localStorage数据
- 批量上传概念卡片和文章
- 保持数据完整性
- 支持回滚

---

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

### 开发规范

- 遵循现有代码风格
- 添加TypeScript类型定义
- 更新相关文档
- 确保所有测试通过

---

## 📝 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🙏 致谢

- [SuperMemo2算法](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2) - 间隔重复系统
- [Supabase](https://supabase.com) - 开源Firebase替代方案
- [Next.js](https://nextjs.org) - React全栈框架
- [Prisma](https://www.prisma.io) - 现代数据库ORM

---

## 📮 联系方式

- **问题反馈**: [GitHub Issues](https://github.com/your-username/anti-ai-reader/issues)
- **功能建议**: [GitHub Discussions](https://github.com/your-username/anti-ai-reader/discussions)
- **邮件**: your-email@example.com

---

<div align="center">

**如果这个项目对你有帮助，请给个⭐️支持一下！**

Made with ❤️ by Anti-AI Reader Team

</div>
