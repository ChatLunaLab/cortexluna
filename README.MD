# CortexLuna

CortexLuna 是简易，轻量化的 LLM 框架。建设在 Cordis 之上，与 Langchain 和 Vercel AI SDK 有一些相近的 API。

CortexLuna 基于 Langchain 和 Vercel AI SDK 派生开发。

## 特性

* 基于 TypeScript 编写，提供大量的类型定义
* 轻量化，易于使用，尽可能少的依赖
* 渐进式 API 设计，随时可集成进你的项目

## 路线图

* [x] 结构化 `prompt` 格式化支持
* [x] `generateText` 和 tool calling 支持
* [x] `generateObject` 支持，结构化输出
* [x] `streamText` 支持，流式输出
* [x] `embed` 支持，获取文本（也可以是其他东西）的向量
* [x] `Provider` 提供器，轮询配置等请求
* [ ] Workflow 工作流支持
* [ ] Vector Store 向量存储和检索
* [ ] Hybrid search, bm25 混合向量查询

## 用法

和 Vercel AI SDK 类似，CortexLuna 提供了 `generateText` 和 `generateObject` 等 API。

```typescript
// 需要设置环境变量啊喂
const { text, usage, finishReason } = await generatateText({
    model: openaiCompatible('gemini-2.0-flash-lite-preview'),
    prompt: 'Talk a joke about programming'
})

console.log(text, usage, finishReason)
```

我们也支持 PromptTemplate 格式化：

```typescript
const prompt = promptTemplate(
      'Now is {time}.  I will ask you a question: {question}. Please answer it.'
)

const chain = bindPromptTemplate(prompt, generatateText)
const { text, usage, finishReason } = await chain({
    model: openaiCompatible('gemini-2.0-flash-lite-preview'),
    input: {
        time: new Date().toLocaleString(),
        question: 'what time is it'
    }
})

console.log(text, usage, finishReason)
```

流式文本也是支持的：

```typescript
const {textStream, text } =  streamText({
    model: openaiCompatible('gemini-2.0-flash-lite-preview'),
    prompt: 'Talk a joke about programming'

})
for await (const chunk of textStream) {
    console.log(chunk)
}

console.log(await text)
```

结构化输出也支持：

```typescript
const { object, usage } = await generateObject({
    model: openaiCompatible('gemini-2.0-flash-lite-preview'),
    prompt: 'Tell me a joke about programming',
    schema: z.object({
        joke: z.string().describe('The joke'),
        punchline: z.string().describe('The punchline')
    })
})

console.log(object, usage)
```

## 我是否应该使用 CortexLuna？

看到上面的例子，你会觉得：

> 这 Vercel AI SDK 有什么区别？

单纯 API 设计角度来看，确实是很接近。因为 CortexLuna 是基于 Vercel AI SDK 派生开发的，所以它的 API 设计也很接近。

但 CortexLuna 不是为了取代 Langchain 或 Vercel AI SDK，而是为了给其他项目（主要指的是 ChatLuna）提供一个更简单，轻量级的 LLM 框架。

Langchain 实在是过于笨重了，我不想再继续依赖它。但 Vercel AI SDK 的设计又比较简洁，我仍需要扩展一些东西才能用到 ChatLuna。最后我决定将两者的部分特定结合起来，就形成了 CortexLuna。

> [!TIP]
> 请注意，此项目是实验性的，不应该用于生产环境。

## 致谢

感谢以下开源项目：

* [langchain/langchainjs](https://github.com/langchain-ai/langchainjs)
* [vecel/ai](https://github.com/vercel)
* [cordis](https://github.com/cordiverse/cordis)

最后感谢所有 ChatLuna 的贡献者和用户，没有你们的支持，ChatLuna 就不会继续向前发展。

## 许可证

使用 [MIT](./LICENSE) 许可证发布。
