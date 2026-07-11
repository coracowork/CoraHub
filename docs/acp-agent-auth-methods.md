# ACP Agent authMethods Survey

> Generated: 2026-04-13
>
> Image: `agent-research:latest` | Client: `acp-client` (`--verbose`)
>
> Source: agents registered in `acpx@0.5.3` AGENT_REGISTRY (16 agents)

## Summary

| #   | Agent                    | Version       | authMethods                                              | Status          |
| --- | ------------------------ | ------------- | -------------------------------------------------------- | --------------- |
| 1   | pi-acp                   | 0.0.25        | 1 (terminal login)                                       | OK              |
| 2   | codex-acp (Codex)        | 0.11.1        | 3 (ChatGPT login, env CODEX_API_KEY, env OPENAI_API_KEY) | OK              |
| 3   | claude-agent-acp         | 0.26.0        | 0 (empty array `[]`)                                     | OK              |
| 4   | gemini-cli               | 0.35.2-termux | 4 (Google OAuth, API key, Vertex AI, Gateway)            | OK              |
| 5   | copilot (GitHub Copilot) | 1.467.0       | 1 (GitHub OAuth)                                         | OK              |
| 6   | droid (Factory Droid)    | 0.99.0        | 2 (device pairing, env FACTORY_API_KEY)                  | OK              |
| 7   | iflow-agent              | 0.5.18        | 3 (OAuth, env IFLOW_API_KEY, OpenAI Compatible)          | OK              |
| 8   | kilocode (Kilo)          | 7.2.0         | 1 (terminal login)                                       | OK*             |
| 9   | opencode (OpenCode)      | 1.4.3         | 1 (terminal login)                                       | OK*             |
| 10  | qodercli (Qoder)         | -             | 1 (terminal login)                                       | OK              |
| 11  | qwen-code (Qwen Code)    | 0.14.3        | 2 (env OPENAI_API_KEY, Qwen OAuth)                       | OK              |
| 12  | openclaw-acp             | 0.0.11        | -                                                        | ERROR (gateway) |
| 13  | cursor                   | -             | -                                                        | NOT INSTALLABLE |
| 14  | kimi                     | -             | -                                                        | NOT INSTALLABLE |
| 15  | kiro                     | -             | -                                                        | NOT INSTALLABLE |
| 16  | trae                     | -             | -                                                        | NOT INSTALLABLE |

\* kilocode/opencode 首次启动有 SQLite 迁移，导致 30s 超时，但随后返回了正常响应。

---

## Per-Agent Details

### 1. pi-acp

- **Package**: `pi-acp@0.0.25` (via `npx pi-acp@latest`)
- **Agent command**: `npx pi-acp@^0.0.22`
- **Agent info**: `{ name: "pi-acp", title: "pi ACP adapter", version: "0.0.25" }`

**authMethods:**

```json
[
  {
    "id": "pi_terminal_login",
    "name": "Launch pi in the terminal",
    "description": "Start pi in an interactive terminal to configure API keys or login",
    "type": "terminal",
    "args": ["--terminal-login"],
    "env": {}
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentInfo":{"name":"pi-acp","title":"pi ACP adapter","version":"0.0.25"},"authMethods":[{"id":"pi_terminal_login","name":"Launch pi in the terminal","description":"Start pi in an interactive terminal to configure API keys or login","type":"terminal","args":["--terminal-login"],"env":{}}],"agentCapabilities":{"loadSession":true,"mcpCapabilities":{"http":false,"sse":false},"promptCapabilities":{"image":true,"audio":false,"embeddedContext":false},"sessionCapabilities":{"list":{}}}}}
```

---

### 2. codex-acp (Codex)

- **Package**: `@zed-industries/codex-acp@0.11.1` (via `npx @zed-industries/codex-acp@latest`)
- **Agent command**: `npx @zed-industries/codex-acp@^0.11.1`
- **Agent info**: `{ name: "codex-acp", title: "Codex", version: "0.11.1" }`

**authMethods:**

```json
[
  {
    "id": "chatgpt",
    "name": "Login with ChatGPT",
    "description": "Use your ChatGPT login with Codex CLI (requires a paid ChatGPT subscription)"
  },
  {
    "type": "env_var",
    "id": "codex-api-key",
    "name": "Use CODEX_API_KEY",
    "description": "Requires setting the `CODEX_API_KEY` environment variable.",
    "vars": [{ "name": "CODEX_API_KEY" }]
  },
  {
    "type": "env_var",
    "id": "openai-api-key",
    "name": "Use OPENAI_API_KEY",
    "description": "Requires setting the `OPENAI_API_KEY` environment variable.",
    "vars": [{ "name": "OPENAI_API_KEY" }]
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"promptCapabilities":{"image":true,"audio":false,"embeddedContext":true},"mcpCapabilities":{"http":true,"sse":false},"sessionCapabilities":{"list":{},"close":{}},"auth":{"logout":{}}},"authMethods":[{"id":"chatgpt","name":"Login with ChatGPT","description":"Use your ChatGPT login with Codex CLI (requires a paid ChatGPT subscription)"},{"type":"env_var","id":"codex-api-key","name":"Use CODEX_API_KEY","description":"Requires setting the `CODEX_API_KEY` environment variable.","vars":[{"name":"CODEX_API_KEY"}]},{"type":"env_var","id":"openai-api-key","name":"Use OPENAI_API_KEY","description":"Requires setting the `OPENAI_API_KEY` environment variable.","vars":[{"name":"OPENAI_API_KEY"}]}],"agentInfo":{"name":"codex-acp","title":"Codex","version":"0.11.1"}}}
```

---

### 3. claude-agent-acp (Claude Agent)

- **Package**: `@agentclientprotocol/claude-agent-acp@0.26.0` (via `npx -y @agentclientprotocol/claude-agent-acp@latest`)
- **Agent command**: `npx -y @agentclientprotocol/claude-agent-acp@^0.25.0`
- **Agent info**: `{ name: "@agentclientprotocol/claude-agent-acp", title: "Claude Agent", version: "0.26.0" }`

**authMethods:**

```json
[]
```

> Claude Agent 返回空的 authMethods 数组。认证可能通过外部环境变量（如 `ANTHROPIC_API_KEY`）处理，不走 ACP 协议层的 auth flow。

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"_meta":{"claudeCode":{"promptQueueing":true}},"promptCapabilities":{"image":true,"embeddedContext":true},"mcpCapabilities":{"http":true,"sse":true},"loadSession":true,"sessionCapabilities":{"fork":{},"list":{},"resume":{},"close":{}}},"agentInfo":{"name":"@agentclientprotocol/claude-agent-acp","title":"Claude Agent","version":"0.26.0"},"authMethods":[]}}
```

---

### 4. gemini-cli (Gemini CLI)

- **Package**: `@mmmbuto/gemini-cli-termux@0.35.2-termux` (fork of `google-gemini/gemini-cli`)
- **Agent command**: `gemini --acp`
- **Agent info**: `{ name: "gemini-cli", title: "Gemini CLI", version: "0.35.2-termux" }`

**authMethods:**

```json
[
  {
    "id": "oauth-personal",
    "name": "Log in with Google",
    "description": "Log in with your Google account"
  },
  {
    "id": "gemini-api-key",
    "name": "Gemini API key",
    "description": "Use an API key with Gemini Developer API",
    "_meta": { "api-key": { "provider": "google" } }
  },
  {
    "id": "vertex-ai",
    "name": "Vertex AI",
    "description": "Use an API key with Vertex AI GenAI API"
  },
  {
    "id": "gateway",
    "name": "AI API Gateway",
    "description": "Use a custom AI API Gateway",
    "_meta": { "gateway": { "protocol": "google", "restartRequired": "false" } }
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"authMethods":[{"id":"oauth-personal","name":"Log in with Google","description":"Log in with your Google account"},{"id":"gemini-api-key","name":"Gemini API key","description":"Use an API key with Gemini Developer API","_meta":{"api-key":{"provider":"google"}}},{"id":"vertex-ai","name":"Vertex AI","description":"Use an API key with Vertex AI GenAI API"},{"id":"gateway","name":"AI API Gateway","description":"Use a custom AI API Gateway","_meta":{"gateway":{"protocol":"google","restartRequired":"false"}}}],"agentInfo":{"name":"gemini-cli","title":"Gemini CLI","version":"0.35.2-termux"},"agentCapabilities":{"loadSession":true,"promptCapabilities":{"image":true,"audio":true,"embeddedContext":true},"mcpCapabilities":{"http":true,"sse":true}}}}
```

---

### 5. copilot (GitHub Copilot)

- **Package**: `@github/copilot-language-server@1.467.0`
- **Agent command**: `copilot --acp --stdio` (via language-server.js)
- **Agent info**: `{ name: "GitHub Copilot", version: "1.467.0" }`

**authMethods:**

```json
[
  {
    "id": "github_oauth",
    "name": "Sign in with GitHub",
    "description": "Authenticate using GitHub OAuth (opens browser)"
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"sessionCapabilities":{"list":{}},"promptCapabilities":{"audio":false,"embeddedContext":true,"image":true}},"agentInfo":{"name":"GitHub Copilot","version":"1.467.0"},"authMethods":[{"id":"github_oauth","name":"Sign in with GitHub","description":"Authenticate using GitHub OAuth (opens browser)"}]}}
```

---

### 6. droid (Factory Droid)

- **Package**: `droid@0.99.0`
- **Agent command**: `droid exec --output-format acp`
- **Agent info**: `{ name: "@factory/cli", title: "Factory Droid", version: "0.99.0" }`

**authMethods:**

```json
[
  {
    "id": "device-pairing",
    "name": "Login",
    "description": "Authenticate with Factory using a device pairing code in your browser."
  },
  {
    "id": "factory-api-key",
    "name": "Factory API Key",
    "description": "Authenticate using a Factory API key set in the FACTORY_API_KEY environment variable."
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"sessionCapabilities":{"list":{},"resume":{}},"promptCapabilities":{"image":true,"embeddedContext":true},"_meta":{"terminal_output":true,"terminal-auth":true}},"agentInfo":{"name":"@factory/cli","title":"Factory Droid","version":"0.99.0"},"authMethods":[{"id":"device-pairing","name":"Login","description":"Authenticate with Factory using a device pairing code in your browser."},{"id":"factory-api-key","name":"Factory API Key","description":"Authenticate using a Factory API key set in the FACTORY_API_KEY environment variable."}]}}
```

---

### 7. iflow-agent (iFlow)

- **Package**: `@iflow-ai/iflow-cli@0.5.18`
- **Agent command**: `iflow --experimental-acp`
- **Agent info**: `{ name: "iflow-agent", title: "iFlow Agent", version: "0.5.18" }`

**authMethods:**

```json
[
  {
    "id": "oauth-iflow",
    "name": "Log in with IFLOW",
    "description": null
  },
  {
    "id": "iflow",
    "name": "Use iFlow API key",
    "description": "Requires setting the `IFLOW_API_KEY` environment variable"
  },
  {
    "id": "openai-compatible",
    "name": "OpenAI Compatible API",
    "description": "OpenAI Compatible API"
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"isAuthenticated":false,"protocolVersion":1,"authMethods":[{"id":"oauth-iflow","name":"Log in with IFLOW","description":null},{"id":"iflow","name":"Use iFlow API key","description":"Requires setting the `IFLOW_API_KEY` environment variable"},{"id":"openai-compatible","name":"OpenAI Compatible API","description":"OpenAI Compatible API"}],"agentCapabilities":{"loadSession":true,"promptCapabilities":{"image":true,"audio":false,"embeddedContext":true}},"agentInfo":{"name":"iflow-agent","title":"iFlow Agent","version":"0.5.18"}}}
```

---

### 8. kilocode (Kilo)

- **Package**: `@kilocode/cli` (via `npx -y @kilocode/cli acp`)
- **Agent command**: `npx -y @kilocode/cli acp`
- **Agent info**: `{ name: "Kilo", version: "7.2.0" }`

**authMethods:**

```json
[
  {
    "description": "Run `kilo auth login` in the terminal",
    "name": "Login with Kilo",
    "id": "kilo-login"
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"mcpCapabilities":{"http":true,"sse":true},"promptCapabilities":{"embeddedContext":true,"image":true},"sessionCapabilities":{"fork":{},"list":{},"resume":{}}},"authMethods":[{"description":"Run `kilo auth login` in the terminal","name":"Login with Kilo","id":"kilo-login"}],"agentInfo":{"name":"Kilo","version":"7.2.0"}}}
```

---

### 9. opencode (OpenCode)

- **Package**: `opencode-ai` (via `npx -y opencode-ai acp`)
- **Agent command**: `npx -y opencode-ai acp`
- **Agent info**: `{ name: "OpenCode", version: "1.4.3" }`

**authMethods:**

```json
[
  {
    "description": "Run `opencode auth login` in the terminal",
    "name": "Login with opencode",
    "id": "opencode-login"
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true,"mcpCapabilities":{"http":true,"sse":true},"promptCapabilities":{"embeddedContext":true,"image":true},"sessionCapabilities":{"fork":{},"list":{},"resume":{}}},"authMethods":[{"description":"Run `opencode auth login` in the terminal","name":"Login with opencode","id":"opencode-login"}],"agentInfo":{"name":"OpenCode","version":"1.4.3"}}}
```

---

### 10. qodercli (Qoder)

- **Package**: `@qoder-ai/qodercli`
- **Agent command**: `qodercli --acp`
- **Agent info**: not returned in result (protocol v1 only)

**authMethods:**

```json
[
  {
    "description": "Run `qodercli /login` in the terminal",
    "id": "qodercli-login",
    "name": "Log in with Qoder CLI"
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"id":1,"result":{"agentCapabilities":{"_meta":{"qoder.ai":{"sessionFileDiffNotification":true}},"loadSession":true,"mcpCapabilities":{"http":true},"promptCapabilities":{"embeddedContext":true,"image":true}},"authMethods":[{"description":"Run `qodercli /login` in the terminal","id":"qodercli-login","name":"Log in with Qoder CLI"}],"protocolVersion":1},"jsonrpc":"2.0"}
```

---

### 11. qwen-code (Qwen Code)

- **Package**: `@qwen-code/qwen-code@0.14.3`
- **Agent command**: `qwen --acp`
- **Agent info**: `{ name: "qwen-code", title: "Qwen Code", version: "0.14.3" }`

**authMethods:**

```json
[
  {
    "id": "openai",
    "name": "Use OpenAI API key",
    "description": "Requires setting the `OPENAI_API_KEY` environment variable",
    "_meta": {
      "type": "terminal",
      "args": ["--auth-type=openai"]
    }
  },
  {
    "id": "qwen-oauth",
    "name": "Qwen OAuth",
    "description": "OAuth authentication for Qwen models with free daily requests",
    "_meta": {
      "type": "terminal",
      "args": ["--auth-type=qwen-oauth"]
    }
  }
]
```

**Full initialize NDJSON:**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentInfo":{"name":"qwen-code","title":"Qwen Code","version":"0.14.3"},"authMethods":[{"id":"openai","name":"Use OpenAI API key","description":"Requires setting the `OPENAI_API_KEY` environment variable","_meta":{"type":"terminal","args":["--auth-type=openai"]}},{"id":"qwen-oauth","name":"Qwen OAuth","description":"OAuth authentication for Qwen models with free daily requests","_meta":{"type":"terminal","args":["--auth-type=qwen-oauth"]}}],"agentCapabilities":{"loadSession":true,"promptCapabilities":{"image":true,"audio":true,"embeddedContext":true},"sessionCapabilities":{"list":{},"resume":{}}}}}
```

---

### 12. openclaw-acp (ERROR)

- **Package**: `openclaw-acp@0.0.11`
- **Agent command**: `openclaw-acp` (standalone) / `openclaw acp` (via acpx)
- **Status**: ERROR — "Failed to connect to OpenClaw gateway"

> openclaw-acp 是一个 Gateway 适配器，需要运行中的 OpenClaw gateway 才能初始化，无法独立运行。

**NDJSON (error response):**

```json
-> {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acp-client","title":"ACP Client","version":"1.0.0"}}}
<- {"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"Internal error","data":{"details":"Failed to connect to OpenClaw gateway"}}}
```

---

### 13-16. Not Installable

The following agents could not be installed in a container via npm:

| Agent      | acpx command        | Reason                                                                                                 |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| **cursor** | `cursor-agent acp`  | Cursor IDE 专有，需从 cursor.com 安装。npm 上的 `cursor-agent` 是无关的任务调度工具。                  |
| **kimi**   | `kimi acp`          | Moonshot AI 专有 CLI。npm 上的 `kimi-cli` 是 2018 年的无关 webpack 工具。GitHub: `MoonshotAI/kimi-cli` |
| **kiro**   | `kiro-cli-chat acp` | AWS Kiro 专有。npm 上的 `kiro-cli@0.0.1` 是占位 placeholder（仅 `console.log("Hello")`）。             |
| **trae**   | `traecli acp serve` | ByteDance Trae 专有，npm 上无相关包。                                                                  |

---

## Auth Pattern Analysis

### Auth Method Types Observed

| Type                      | Agents                                                                                                       | Description                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **OAuth / Browser login** | gemini (Google), copilot (GitHub), codex (ChatGPT), iflow, qwen                                              | 打开浏览器完成 OAuth 授权                    |
| **Terminal login**        | pi, kilocode, opencode, qodercli                                                                             | 在终端中运行登录命令                         |
| **Environment variable**  | codex (CODEX_API_KEY, OPENAI_API_KEY), droid (FACTORY_API_KEY), iflow (IFLOW_API_KEY), qwen (OPENAI_API_KEY) | 通过环境变量设置 API key                     |
| **Device pairing**        | droid                                                                                                        | 在浏览器中输入设备配对码                     |
| **API Gateway**           | gemini                                                                                                       | 自定义 AI API Gateway                        |
| **Empty**                 | claude                                                                                                       | 不声明 authMethods，可能通过外部配置处理认证 |

### Key Observations

1. **大多数 agent 声明了 authMethods** — 11 个可测试的 agent 中，10 个声明了至少 1 个 method，只有 claude-agent-acp 返回空数组。
2. **OAuth 是最常见的模式** — Google OAuth, GitHub OAuth, ChatGPT login, Qwen OAuth 等。
3. **env_var 类型带有 `vars` 字段** — codex 使用了 `type: "env_var"` 并在 `vars` 数组中声明所需变量名。
4. **`_meta` 扩展被广泛使用** — gemini 和 qwen 在 authMethods 中附带了 `_meta` 字段，携带额外的 provider/type 信息。
5. **terminal 类型** — pi 使用了 `type: "terminal"` 声明需要在终端中完成登录。
6. **协议版本** — 所有 agent 都返回 `protocolVersion: 1`。
