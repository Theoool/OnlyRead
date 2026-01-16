# Embedding 系统测试脚本

## 步骤 1: 测试 Embedding API

在浏览器控制台运行以下代码：

```javascript
// 测试 1: 诊断 API
console.log('🔍 开始诊断 embedding 系统...');

fetch('/api/test/embedding', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ 诊断结��:', data);
  console.log('---');
  console.log('总体状态:', data.data.diagnostics.overall);
  console.log('---');
  console.log('检查项:');
  data.data.diagnostics.checks.forEach(check => {
    console.log(`  ${check.status} ${check.name}`);
    if (check.details) {
      console.log('    详情:', check.details);
    }
  });

  if (data.data.diagnostics.issues.length > 0) {
    console.log('---');
    console.log('⚠️ 发现的问题:');
    data.data.diagnostics.issues.forEach(issue => {
      console.log(`  ❌ ${issue}`);
    });
  }

  if (data.data.diagnostics.recommendations.length > 0) {
    console.log('---');
    console.log('💡 建议:');
    data.data.diagnostics.recommendations.forEach(rec => {
      console.log(`  💡 ${rec}`);
    });
  }
})
.catch(error => {
  console.error('❌ 诊断失败:', error);
});
```

## 步骤 2: 测试相似度搜索

```javascript
// 测试 2: 搜索相关概念
console.log('🔍 测试相似度搜索...');

fetch('/api/concepts/related?text=机器学习&limit=5&threshold=0.7', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('✅ 搜索结果:', data);

  if (data.data && data.data.related) {
    console.log(`---`);
    console.log(`找到 ${data.data.related.length} 个相关概念:`);
    data.data.related.forEach((concept, index) => {
      console.log(`  ${index + 1}. ${concept.term} (相似度: ${(concept.similarity * 100).toFixed(1)}%)`);
    });
  }
})
.catch(error => {
  console.error('❌ 搜索失败:', error);
});
```

## 步骤 3: 测试创建概念（自动生成 embedding）

```javascript
// 测试 3: 创建测试概念
console.log('🔍 测试创建概念...');

fetch('/api/concepts', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    term: '测试概念',
    myDefinition: '这是一个用于测试 embedding 生成的概念定义',
    myExample: '这是一个例句',
    confidence: 3,
    tags: ['test']
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ 概念创建结果:', data);
})
.catch(error => {
  console.error('❌ 创建失败:', error);
});
```

## 预期结果

### ✅ 成功的情况

```
🔍 开始诊断 embedding 系统...
✅ 诊断结果: {...}

总体状态: ✅ 系统正常

检查项:
  ✅ 通过 环境变量配置
  ✅ 通过 OpenAI API 连接
  ✅ 已启用 pgvector 扩展
  ✅ 存在 embedding 列
  ℹ️ 信息 概念 embedding 统计
  ✅ 正常 相似度搜索

💡 建议:
  🎉 Embedding 系统运行正常！
```

### ❌ 失败的情况

如果看到错误，请检查：

1. **API 密钥错误**
   ```
   ❌ OpenAI API 密钥无效
   ```
   → 检查 OPENAI_API_KEY 是否正确
   → 访问 https://platform.openai.com/api-keys 验证

2. **余额不足**
   ```
   ❌ OpenAI API 余额不足
   ```
   → 访问 https://platform.openai.com/account/usage 充值

3. **扩展未启用**
   ```
   ❌ pgvector 扩展未启用
   ```
   → 在 Supabase SQL Editor 运行：
      ```sql
      CREATE EXTENSION IF NOT EXISTS vector;
      ```
