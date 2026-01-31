# semantic-code-mcp

[![npm version](https://img.shields.io/npm/v/@smallthinkingmachines/semantic-code-mcp.svg)](https://www.npmjs.com/package/@smallthinkingmachines/semantic-code-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for semantic code search using AST-aware chunking and vector embeddings. Works with any AI coding tool that supports MCP.

[GitHub](https://github.com/smallthinkingmachines/semantic-code-mcp) | [npm](https://www.npmjs.com/package/@smallthinkingmachines/semantic-code-mcp)

## The Problem

Traditional search tools like grep, ripgrep, and ag match text patterns exactly. When developers ask conceptual questions like "How is authentication handled?" or "Where do we process payments?", these tools require knowing exact function names or code patterns. This leads to:

- **Overwhelming results**: Thousands of lines containing search terms, most irrelevant
- **Naming convention blindness**: "authenticateUser", "login", "validateSession", and "handleAuth" are the same concept—grep doesn't know that
- **Lost context**: Results show isolated lines without surrounding code structure

AI coding tools inherit these limitations. Claude Code relies on grep/ripgrep for code search—no semantic understanding, just string matching. Aider uses repo maps with graph ranking to select relevant code, but still depends on structural analysis rather than meaning. These approaches work on smaller codebases but struggle at scale, burning tokens on irrelevant results or missing conceptually related code.

## The Solution

Semantic search understands code by meaning, not just text. It can answer "How is user authentication implemented?" by understanding conceptual relationships—regardless of function names or file locations.

Using local embeddings and vector search, it bridges the gap between text search limitations and LLM context constraints, providing more accurate results for navigating large codebases.

## Features

- **Semantic search** - Find code by meaning, not just keywords
- **AST-aware chunking** - Tree-sitter WASM for cross-platform parsing, no native compilation required
- **Local embeddings** - ONNX Runtime with nomic-embed-code (768 dims, 8K context)
- **Hybrid search** - Vector similarity + BM25 keyword matching
- **Cross-encoder reranking** - Higher precision with transformer reranking
- **Incremental indexing** - MD5 hashing for change detection, only re-index modified files
- **File watching** - Live updates as you code
- **Lazy indexing** - Index builds on first search, not on startup
- **GPU support** - CUDA auto-detection for 10-50x faster indexing

## Installation

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "semantic-code": {
      "type": "local",
      "command": ["npx", "@smallthinkingmachines/semantic-code-mcp"],
      "enabled": true
    }
  }
}
```

### Claude Code

Add to `~/.claude.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "semantic-code": {
      "command": "npx",
      "args": ["@smallthinkingmachines/semantic-code-mcp"]
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` (workspace) or run `MCP: Add Server` command:

```json
{
  "servers": {
    "semantic-code": {
      "command": "npx",
      "args": ["-y", "@smallthinkingmachines/semantic-code-mcp"]
    }
  }
}
```

### Specifying a Directory

The server indexes your current working directory by default. To index a specific directory, add it as an argument:

```bash
# OpenCode: ["npx", "@smallthinkingmachines/semantic-code-mcp", "/path/to/project"]
# VS Code:  "args": ["-y", "@smallthinkingmachines/semantic-code-mcp", "/path/to/project"]
# Claude:   "args": ["@smallthinkingmachines/semantic-code-mcp", "/path/to/project"]
```

## First Run

On first search, the server will:
1. **Download models** (~400MB) - embedding and reranking models are cached in `~/.cache/semantic-code-mcp/`
2. **Index your codebase** - parses and embeds all supported files (progress shown in logs)

Subsequent searches use the cached models and index. The index updates automatically when files change.

## Tool: semantic_search

Search code semantically using natural language queries.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query describing what you're looking for |
| `path` | string | No | Directory path to scope the search |
| `limit` | number | No | Maximum results (default: 10, max: 50) |
| `file_pattern` | string | No | Glob pattern to filter files (e.g., "*.ts", "**/*.py") |

### Example

```
semantic_search({
  query: "authentication middleware that validates JWT tokens",
  path: "src/",
  limit: 5
})
```

## Architecture

```
semantic_search tool (MCP Server)
├── Chunker (web-tree-sitter) → AST-aware code splitting (WASM, cross-platform)
├── Embedder (ONNX local)     → nomic-embed-code, 768 dims
├── Vector DB (LanceDB)       → Serverless, hybrid search
├── File Watcher (chokidar)   → Incremental updates
└── Hybrid Search             → BM25 + vector + reranking
```

## Supported Languages

- TypeScript / JavaScript (including TSX/JSX)
- Python
- Go
- Rust
- Java
- C / C++
- C#

Other languages fall back to line-based chunking.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SEMANTIC_CODE_ROOT` | Root directory to index | Current working directory |
| `SEMANTIC_CODE_INDEX` | Custom index storage location | `.semantic-code/index/` |

### Default Ignore Patterns

The following patterns are ignored by default:

```
**/node_modules/**
**/.git/**
**/dist/**
**/build/**
**/.next/**
**/coverage/**
**/__pycache__/**
**/venv/**
**/.venv/**
**/target/**          (Rust)
**/vendor/**          (Go)
**/*.min.js
**/*.bundle.js
**/*.map
**/package-lock.json
**/yarn.lock
**/pnpm-lock.yaml
**/.semantic-code/**
```

### Security

The server includes protection against common attack vectors:

- **SQL Injection**: All filter inputs are validated against a strict whitelist
- **Path Traversal**: Search paths are validated to stay within the root directory
- **Input Validation**: IDs and patterns are validated before database operations

Invalid inputs throw typed errors (`InvalidFilterError`, `PathTraversalError`, `InvalidIdError`) that can be caught and handled appropriately.

## Storage

- Index location: `.semantic-code/index/` (add to `.gitignore`)
- Model cache: `~/.cache/semantic-code-mcp/`
- Estimated size: 3GB codebase → ~1.5GB index (with float16)

## Documentation

- [Deployment Guide](./docs/deployment.md) - Production deployment, Docker, performance tuning
- [Troubleshooting Guide](./docs/troubleshooting.md) - Common issues and solutions
- [Architecture Overview](./docs/architecture.md) - Internal design and data flow

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run in development
yarn dev

# Run tests
yarn test

# Run specific test suites
yarn test -- tests/integration/    # Integration tests
yarn test -- tests/edge-cases/     # Edge case tests
yarn test -- tests/performance/    # Performance benchmarks
```

## Project Structure

```
semantic-code-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── chunker/
│   │   ├── index.ts          # Main chunker logic
│   │   ├── languages.ts      # Language configs with WASM paths
│   │   └── wasm-loader.ts    # WASM grammar loader with caching
│   ├── embedder/
│   │   ├── index.ts          # ONNX embedding generation
│   │   └── model.ts          # Model download & loading
│   ├── store/
│   │   └── index.ts          # LanceDB integration
│   ├── search/
│   │   ├── index.ts          # Hybrid search orchestration
│   │   └── reranker.ts       # Cross-encoder reranking
│   ├── watcher/
│   │   └── index.ts          # File watcher + incremental indexing
│   └── tools/
│       └── semantic-search.ts # MCP tool definition
├── grammars/                  # Pre-built WASM parsers
├── scripts/
│   └── copy-grammars.js      # Build script for WASM files
├── package.json
├── tsconfig.json
└── README.md
```

---

## Appendix

### Nix Users

Due to Nix's PATH isolation, `npx` may not find the binary. Install to a fixed location instead:

```bash
npm install --prefix ~/.local/share/semantic-code-mcp @smallthinkingmachines/semantic-code-mcp
```

Then use in your MCP config (replace `YOUR_USERNAME`):

```json
{
  "mcpServers": {
    "semantic-code": {
      "command": "node",
      "args": ["/home/YOUR_USERNAME/.local/share/semantic-code-mcp/node_modules/@smallthinkingmachines/semantic-code-mcp/dist/index.js"]
    }
  }
}
```
