# 模拟模式使用说明

## 📋 概述

为了避免在开发和测试时产生高额的 ProPainter API 调用成本，我们添加了模拟模式。在模拟模式下，系统会返回模拟的 API 响应，不会调用真实的 Replicate API。

## 🚀 启用模拟模式

### 方法 1：环境变量（推荐）

在 `.env` 文件中添加以下配置：

```env
# 启用 ProPainter 模拟模式（节省成本）
MOCK_PROPAINTER=true

# 启用 SAM3 模拟模式（可选）
MOCK_SAM3=true
```

### 方法 2：命令行

```bash
# 只模拟 ProPainter
MOCK_PROPAINTER=true pnpm dev

# 同时模拟 ProPainter 和 SAM3
MOCK_PROPAINTER=true MOCK_SAM3=true pnpm dev
```

## 🎭 模拟行为

### ProPainter 模拟

- **状态转换**：
  - 0-2 秒：`starting` 状态
  - 2-8 秒：`processing` 状态
  - 8 秒后：`succeeded` 状态

- **输出**：
  - 返回一个示例视频 URL（BigBuckBunny.mp4）作为占位符
  - 实际使用时，你可以替换为你的测试视频 URL

### SAM3 模拟

- **行为**：
  - 立即返回 `succeeded` 状态
  - 返回一个示例视频 URL 作为遮罩输出

## 📝 注意事项

1. **模拟模式仅用于开发和测试**：
   - 不会产生真实的 API 调用成本
   - 不会处理真实的视频
   - 输出结果是占位符，不是实际处理结果

2. **生产环境**：
   - 确保在生产环境中**不要**设置 `MOCK_PROPAINTER=true`
   - 否则用户将无法获得真实的处理结果

3. **测试流程**：
   - 使用模拟模式测试整个流程（前端交互、状态更新、数据库操作等）
   - 确认流程无误后，关闭模拟模式进行真实 API 测试

## 🔍 验证模拟模式

启用模拟模式后，你会在控制台看到以下日志：

```
🎭 Using MOCK mode for ProPainter (cost-saving mode)
🎭 [MOCK] ProPainter prediction created: mock-xxxxx
📊 [MOCK] Prediction status: starting
```

## 🛠️ 自定义模拟输出

如果需要使用你自己的测试视频作为输出，可以修改 `app/routes/api.processing.$.tsx` 中的模拟函数：

```typescript
// 在 mockProPainterPrediction 函数中
prediction.output = [
  "https://your-test-video-url.com/video.mp4", // 替换为你的测试视频 URL
];
```

## 📚 相关文件

- `app/routes/api.processing.$.tsx` - 包含模拟逻辑的实现

