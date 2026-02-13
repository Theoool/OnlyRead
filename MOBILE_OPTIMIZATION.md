# 移动端优化文档

## 概述
本文档记录了对 AI 助手相关组件的移动端适配和 UX 优化工作。

## 优化内容

### 1. 事件冲突处理

#### SelectionToolbarV2
- **问题**: 文本选择工具栏会在输入框选择文本时误触发
- **解决方案**:
  - 添加 100ms 防抖延迟，避免与输入框事件冲突
  - 检测选中文本的容器元素，排除 `input`、`textarea`、`contenteditable` 元素
  - 使用 `stopPropagation()` 防止事件冒泡
  - 添加点击外部关闭功能

```typescript
// 排除可编辑元素
if (element && (
  element.tagName === 'INPUT' ||
  element.tagName === 'TEXTAREA' ||
  element.isContentEditable ||
  element.closest('input, textarea, [contenteditable="true"]')
)) {
  return; // 不显示工具栏
}
```

#### ChatInput
- **问题**: 键盘事件可能与其他组件冲突
- **解决方案**:
  - 使用 `onKeyDown` 而非全局键盘监听
  - Enter 键提交，阻止默认行为
  - 移动端提交后自动失焦，收起键盘
  - 添加 `autoComplete="off"` 等属性避免浏览器干扰

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit(e as any);
  }
};
```

### 2. 移动端适配

#### 响应式布局
所有组件都添加了移动端适配：

**AISidebarEphemeral**:
- 移动端全屏显示 (`w-full sm:w-[90vw] md:w-[400px]`)
- 添加遮罩层背景 (`bg-black/30`)
- 优化内边距 (`px-3 md:px-4`)
- 简化文本显示（移动端隐藏部分信息）

**SelectionToolbarV2**:
- 动态计算位置，防止超出屏幕边界
- 移动端增加工具栏顶部偏移 (80px vs 60px)
- 响应式按钮文本 (`<span className="hidden sm:inline">保存笔记</span>`)
- 最小宽度限制 (`min-w-[240px] md:min-w-0`)

**ChatMessages**:
- 响应式间距 (`space-y-4 md:space-y-6`)
- 响应式字体 (`text-sm md:text-base`)
- 响应式内边距 (`p-3 md:p-4`)
- 消息最大宽度调整 (`max-w-[85%] md:max-w-[80%]`)

**ChatInput**:
- 响应式内边距 (`p-3 md:p-4`)
- 响应式字体 (`text-sm md:text-base`)
- 键盘弹起时自动滚动到输入框

#### Touch 优化
- 所有按钮添加 `touch-manipulation` 类（禁用双击缩放）
- 添加 `active:scale-95` 提供触摸反馈
- 增加移动端按钮最小尺寸 (`min-w-[40px] min-h-[40px]`)
- 滚动容器添加 `overscroll-contain` 和 `-webkit-overflow-scrolling: touch`

### 3. 代码质量优化

#### AISidebarEphemeral
- **请求取消**: 添加 `AbortController` 支持，组件卸载或重置时取消进行中的请求
- **防止重复发送**: 使用 `initialMessageSentRef` 防止初始消息重复发送
- **错误处理**: 区分用户取消和真实错误
- **内存清理**: 组件卸载时清理所有副作用

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

// 发送请求时
abortControllerRef.current = new AbortController();
fetch(url, { signal: abortControllerRef.current.signal });

// 清理
useEffect(() => {
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);
```

#### ChatMessages
- **智能滚动**: 只在新消息添加时滚动，避免用户浏览历史消息时被打断
- **滚动状态追踪**: 用户手动滚动到顶部时停止自动滚动
- **性能优化**: 使用 `requestAnimationFrame` 优化滚动性能

```typescript
const lastMessageCountRef = useRef(0);

useEffect(() => {
  if (messages.length > lastMessageCountRef.current || isStreaming) {
    // 只在新消息时滚动
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }
  lastMessageCountRef.current = messages.length;
}, [messages.length, isStreaming]);
```

### 4. 旧组件清理

已删除以下废弃组件：
- ❌ `SelectionToolbar.tsx` → ✅ `SelectionToolbarV2.tsx`
- ❌ `AISidebar.tsx` → ✅ `AISidebarEphemeral.tsx`
- ❌ `AISidebarV2.tsx` → ✅ `AISidebarEphemeral.tsx`
- ❌ `CopilotWidget.tsx` → ✅ `CopilotWidgetV2.tsx`

更新了所有引用，确保使用新组件。

## 测试建议

### 移动端测试
1. 在不同屏幕尺寸下测试 (320px - 768px)
2. 测试横屏和竖屏模式
3. 测试键盘弹起时的布局
4. 测试触摸手势和滚动

### 事件冲突测试
1. 在输入框中选择文本，确认不会触发 SelectionToolbar
2. 在文章内容中选择文本，确认正常显示工具栏
3. 测试快速连续操作（防抖）
4. 测试点击外部关闭功能

### 性能测试
1. 测试长对话的滚动性能
2. 测试流式响应时的渲染性能
3. 测试组件快速打开/关闭
4. 测试请求取消功能

## 技术栈

- **React Hooks**: useState, useEffect, useCallback, useRef, memo
- **Framer Motion**: 动画和过渡效果
- **Tailwind CSS**: 响应式样式
- **TypeScript**: 类型安全

## 最佳实践

1. **事件处理**: 使用防抖和节流避免性能问题
2. **内存管理**: 及时清理副作用和取消请求
3. **响应式设计**: 移动优先，渐进增强
4. **可访问性**: 添加 `aria-label`、`title` 等属性
5. **性能优化**: 使用 `memo`、`useCallback` 避免不必要的重渲染

## 后续优化方向

1. 添加手势支持（滑动关闭侧边栏）
2. 优化深色模式适配
3. 添加离线支持
4. 优化大文本渲染性能
5. 添加无障碍功能（屏幕阅读器支持）

