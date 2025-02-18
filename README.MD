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

## 我是否应该使用 CortexLuna？

CortexLuna 并不是为了取代 Langchain 或 Vercel AI SDK，而是为了给一部分（像我一样的用户）提供一个更简单，轻量级的 LLM 框架。

由于 Langchain 过于笨重，但是 Vercel AI SDK 的设计又有一些简洁。我尝试将两者结合起来，就形成了 CortexLuna。

> [! TIP]
> 请注意，此项目是实验性的，不应该用于生产环境。

## 用法

TODO...

## 致谢

感谢以下开源项目：

* [langchain/langchainjs](https://github.com/langchain-ai/langchainjs)
* [vecel/ai](https://github.com/vercel)
* [cordis](https://github.com/cordiverse/cordis)

最后感谢所有 ChatLuna 的贡献者和用户，没有你们的支持，ChatLuna 就不会继续向前发展。

## 许可证

使用 [MIT](./LICENSE) 许可证发布。
