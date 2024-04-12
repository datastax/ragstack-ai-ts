# @datastax/ragstack-ai-cli
![GitHub Release](https://img.shields.io/github/v/release/datastax/ragstack-ai-ts?filter=ragstack-ai-cli-*&label=release%20notes)
![npm](https://img.shields.io/npm/dm/@datastax/ragstack-ai-cli)
[![License: Business Source License](https://img.shields.io/badge/License-BSL-yellow.svg)](https://github.com/datastax/ragstack-ai/blob/main/LICENSE.txt)

RAGStack is an out-of-the-box solution simplifying Retrieval Augmented Generation (RAG) in GenAI apps.

The RAGStack CLI is the recommended way to manage your RAGStack projects.
With the `install` command you can safely add or change the RAGStack version without worrying about transitive dependencies versions.
This is especially important because RAGStack is a stack of multiple packages that are tested together for compatibility, performance, and security.

## ⚡️ Quickstart
You don't need to install the CLI, using `npx` is the recommended way to run it.

Move your terminal to the project you want to install RAGStack in and run the following command:
```bash
npx @datastax/ragstack-ai-cli install 
```
This will modify the `package.json`, install `@datastax/ragstack-ai` and refresh your local dependencies.
The supported package managers are `npm` and `yarn` (both classic and berry).

The CLI automatically detects the package manager you are using and installs the correct version of RAGStack.
However, if you never built the project before, it's recommended to force a specific package manager by setting the `--use-npm` or `--use-yarn` option.
