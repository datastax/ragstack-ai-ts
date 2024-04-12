# RAGStack (for Javascript/Typescript)

[RAGStack](https://www.datastax.com/products/ragstack) is an out-of-the-box solution simplifying Retrieval Augmented Generation (RAG) in GenAI apps.
RAGStack includes the best open-source for implementing RAG, giving developers a comprehensive Gen AI Stack leveraging [LangChainJS](https://github.com/langchain-ai/langchainjs) and more. RAGStack leverages the LangChain ecosystem and is fully compatible with LangSmith for monitoring your AI deployments.

For each open-source project included in RAGStack, we select a version lineup and then test the combination for compatibility, performance, and security. Our extensive test suite ensures that RAGStack components work well together so you can confidently deploy them in production.

RAGStack uses the [Astra DB Serverless (Vector) database](https://docs.datastax.com/en/astra/astra-db-vector/get-started/quickstart.html), which provides a highly performant and scalable vector store for RAG workloads like question answering, semantic search, and semantic caching.

Looking for the Python version? Check out [RAGStack for Python](https://github.com/datastax/ragstack-ai).

## Packages
- [RAGStack library](/packages/ragstack-ai) `@datastax/ragstack-ai`: core package for RAGStack.
- [RAGStack CLI](/packages/ragstack-ai-cli) `@datastax/ragstack-ai-cli`: CLI for easily managing RAGStack projects.

## ⚡️ Quickstart

### Yarn
```bash
npx @datastax/ragstack-ai-cli install --use-yarn    
```
### NPM
```bash
npx @datastax/ragstack-ai-cli install --use-yarn
```

## 📖 Documentation

[DataStax RAGStack Documentation](https://docs.datastax.com/en/ragstack/docs/index.html)
