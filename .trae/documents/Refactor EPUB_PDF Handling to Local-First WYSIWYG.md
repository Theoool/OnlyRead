# 实施计划：本地优先的所见即所得阅读器 (Local-First WYSIWYG Reader)

根据您的要求，我们将重构阅读系统，实现 ePub/PDF 的本地解析、存储和渲染，移除后端转换流程，并优化目录体验。

## 1. 核心架构变更
*   **数据存储**: 引入 `Dexie.js` (IndexedDB 封装库) 在浏览器端存储 ePub/PDF 文件及其元数据。
*   **渲染引擎**:
    *   **ePub**: 使用 `react-reader` (基于 epub.js) 实现仿真阅读。
    *   **PDF**: 使用 `@react-pdf-viewer/core` 实现高性能 PDF 渲染。
*   **数据流**: 文件选择 -> 解析元数据(前端) -> 存入 IndexedDB -> 直接读取渲染。

## 2. 详细实施步骤

### 2.1 依赖安装与基础建设
*   安装 `dexie`, `dexie-react-hooks` 用于本地存储。
*   安装 `react-reader` (ePub), `@react-pdf-viewer/core`, `@react-pdf-viewer/default-layout`, `pdfjs-dist` (PDF)。
*   创建 `lib/db.ts`: 定义本地数据库 Schema (`books` 表: id, title, author, cover, fileData, format, addedAt)。

### 2.2 上传/导入流程重构 (`app/page.tsx`)
*   改造 `handleFile` 函数：
    *   **拦截**: 当检测到 `.epub` 或 `.pdf` 时，阻止上传到 Supabase 和后端 API 调用。
    *   **解析**: 在前端解析文件获取标题、作者和封面 (使用 `epubjs` 或 `pdfjs`)。
    *   **存储**: 将文件 Blob 和元数据存入 IndexedDB。
    *   **反馈**: 上传成功后自动刷新本地书架列表。

### 2.3 书架列表升级 (`app/page.tsx`)
*   新增 `useLiveQuery` 钩子实时获取本地书籍列表。
*   将本地书籍与远程书籍 (Collections) 合并展示，或在 "Books" 视图中增加 "Local" 分组。
*   本地书籍点击后跳转至 `/read?localId={uuid}`。

### 2.4 全新阅读器组件开发
*   **路由改造 (`app/read/page.tsx`)**:
    *   增加对 `localId` 参数的支持。
    *   当存在 `localId` 时，从 IndexedDB 加载文件并切换到新的渲染模式。
*   **EPUB 阅读器 (`app/read/EpubReader.tsx`)**:
    *   集成 `ReactReader`。
    *   **样式定制**: 覆盖默认样式，适配当前的黑白极简主题 (Zinc-50/Black)。
    *   **目录优化**: 提取并渲染嵌套层级的目录结构 (Tree View)，替代扁平列表。
*   **PDF 阅读器 (`app/read/PdfReader.tsx`)**:
    *   集成 PDF Viewer。
    *   配置缩放、缩略图和目录侧边栏插件。

### 2.5 目录与交互优化
*   确保 `ChapterListSidebar` 支持递归渲染嵌套目录（针对 ePub 的多级章节）。
*   保留 "Space to Read" (空格翻页) 等核心交互体验（需适配新阅读器 API）。

## 3. 注意事项
*   **AI 功能限制**: 本地模式下，由于未进行后端文本提取和向量化，"AI 概念高亮"和"相关推荐"功能将暂时不可用。
*   **数据同步**: 本地书籍仅存在于当前浏览器，清除缓存会丢失书籍。

确认后，我将按此计划开始执行代码修改。