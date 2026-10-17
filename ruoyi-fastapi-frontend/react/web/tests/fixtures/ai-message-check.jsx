import { useState } from 'react'
import { Button, Card, Space } from 'antd'
import AiMessage from '../../plugins/ai/views/chat/components/AiMessage'

const reasoning = '先保留 **原有聊天布局**，再检查流式内容、代码、公式和图表。'
const steps = [
  { content: '', reasoningContent: '', loading: true },
  { content: '', reasoningContent: reasoning, loading: true },
  {
    content: '## AI 消息\n\n正在逐步接收 **回答**。\n\n```javascript\nconst message =',
    reasoningContent: reasoning,
    loading: true,
  },
  {
    content:
      '## AI 消息\n\n正在逐步接收 **回答**。\n\n```javascript\nconst message = "你好，Markstream";\nconsole.log(message);\n```\n\n公式：$E = mc^2$\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$\n\n> 保留原来的思考过程折叠区域。\n\n| 渲染内容 | 状态 |\n| --- | --- |\n| 流式输出 | 完成 |\n| 深色主题 | 可切换 |\n\n```mermaid\nflowchart LR\n  A[接收消息] --> B[流式渲染]\n  B --> C[完成回答]\n```',
    reasoningContent: reasoning,
    loading: false,
  },
]
export default function AiMessageCheck() {
  const [step, setStep] = useState(3)
  return (
    <Card style={{ maxWidth: 900, marginInline: 'auto' }}>
      <Space
        wrap
        style={{ marginBottom: 24 }}
      >
        <Button onClick={() => setStep(0)}>等待回复</Button>
        <Button onClick={() => setStep(1)}>思考过程</Button>
        <Button onClick={() => setStep(2)}>未闭合代码块</Button>
        <Button onClick={() => setStep(3)}>完成回复</Button>
      </Space>
      <AiMessage {...steps[step]} />
    </Card>
  )
}
