# 变更日志 (Changelog)

本文档记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2025-01-13

### 🎉 重大更新 - 全栈架构升级

#### ✨ 新增功能

**用户认证系统**
- ✅ 邮箱密码注册和登录
- ✅ Supabase Auth集成
- ✅ 安全的会话管理和JWT令牌
- ✅ 受保护的路由（复习、设置页面）
- ✅ 中间件自动刷新会话

**云端数据同步**
- ✅ Supabase PostgreSQL数据库
- ✅ Prisma ORM集成
- ✅ 概念卡片云端存储
- ✅ 文章云端存储
- ✅ 复习历史追踪
- ✅ 阅读会话统计
- ✅ Row Level Security (RLS) 数据隔离

**数据迁移工具**
- ✅ localStorage到云端的一键迁移
- ✅ 批量导入API
- ✅ 自动数据备份
- ✅ 迁移状态检查
- ✅ 回滚支持

**API路由**
- ✅ `/api/auth/*` - 认证相关API
- ✅ `/api/concepts/*` - 概念卡片CRUD
- ✅ `/api/articles/*` - 文章CRUD
- ✅ `/api/migration/*` - 数据迁移API

#### 🏗️ 技术改进

**数据库**
- ✅ 完整的Prisma Schema定义
- ✅ 5个核心数据模型（User, Concept, Article, ReviewHistory, ReadingSession）
- ✅ 索引优化
- ✅ 软删除支持
- ✅ 时间戳自动管理

**部署**
- ✅ Docker多阶段构建配置
- ✅ Docker Compose编排
- ✅ 生产环境优化（standalone模式）
- ✅ 安全头部配置
- ✅ 环境变量管理

**文档**
- ✅ 详细的部署指南（DEPLOYMENT.md）
- ✅ 更新的README.md
- ✅ API文档
- ✅ Docker使用说明

#### 🔧 改进

- 性能优化：数据库查询优化
- 安全增强：RLS策略、CORS配置、CSP头部
- 开发体验：类型安全的API、自动生成Prisma Client
- 代码质量：TypeScript严格模式、ESLint配置

#### 📝 已知问题

- 尚未实现前端UI的认证组件（需要手动调用API）
- 数据迁移工具需要前端UI集成
- 缺少单元测试和集成测试

#### 🔜 下一步计划

- [ ] 实现前端登录/注册页面
- [ ] 集成数据迁移UI
- [ ] 添加用户设置页面
- [ ] 实现概念卡片搜索和过滤
- [ ] 添加学习统计和可视化
- [ ] 编写测试用例
- [ ] 性能监控和日志

---

## [0.1.0] - 之前版本

### ✨ 初始功能

**深度阅读模式**
- ✅ 逐块文本展示
- ✅ 智能文本分割
- ✅ Markdown支持
- ✅ 键盘快捷键
- ✅ 阅读进度追踪

**概念卡片系统**
- ✅ 文本选择创建卡片
- ✅ AI辅助生成定义
- ✅ 强制手写输入
- ✅ 本地存储（localStorage）

**间隔重复复习**
- ✅ SuperMemo2算法实现
- ✅ 智能复习调度
- ✅ 四级评分系统

**多源导入**
- ✅ URL抓取
- ✅ 文本粘贴
- ✅ 文件上传

---

## 版本说明

### 版本号规则

- **Major (主版本)**: 不兼容的API变更
- **Minor (次版本)**: 向后兼容的功能新增
- **Patch (补丁版本)**: 向后兼容的问题修复

### 变更类型

- ✨ **新增**: 新功能
- 🔧 **改进**: 现有功能的改进
- 🐛 **修复**: Bug修复
- 📝 **文档**: 文档更新
- ♻️ **重构**: 代码重构
- ⚡ **性能**: 性能优化
- 🔒 **安全**: 安全相关的改进
- 🗑️ **删除**: 功能删除

---

## 贡献指南

如果您想为项目做出贡献，请：

1. Fork本仓库
2. 创建特性分支
3. 提交清晰的commit message
4. 开启Pull Request

Commit message格式建议：

```
<type>(<scope>): <subject>

<body>

<footer>
```

示例：

```
feat(auth): add user registration API

- Implement email/password registration
- Add validation for user input
- Create user profile in database

Closes #123
```

---

## 联系方式

- 问题反馈: [GitHub Issues](https://github.com/your-username/anti-ai-reader/issues)
- 功能建议: [GitHub Discussions](https://github.com/your-username/anti-ai-reader/discussions)
