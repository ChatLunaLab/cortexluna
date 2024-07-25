# ChatLuna Adapters

ChatLuna 模型适配器项目。

## 项目结构

- [@chatluna/adapter-openai](./packages/openai/README.MD)

  为 ChatLuna 提供 OpenAI 支持的适配器。

## 用法

### Requester

```ts
const requester = new OpenAIRequester({
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1'
})

const messages = [new HumanMessage('What is the capital of France?')]

const generation = await requester.completion({
   input: messages,
   model: 'gpt-3.5-turbo',
   maxTokens: 100
})

console.log(generation.message.content)
```

### With Client (LangChain Model)

### With Full Cordis Context (ChatLuna Platform Service, Requester Service)

## 致谢

感谢 [LangChain](https://github.com/langchain-ai/langchainjs) 项目。本项目基于其进行二次封装。

最后感谢所有 ChatLuna 的贡献者和用户，没有你们的支持，ChatLuna 就不会继续向前发展。

## 许可证

使用 [MIT](./LICENSE) 许可证发布。
