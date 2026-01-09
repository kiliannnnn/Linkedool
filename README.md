# Linkedool

AI-powered LinkedIn profile auditor with real-time streaming feedback.

## Quick Start

### Install
```bash
npm install
```

### Web UI (Recommended)
```bash
npm run serve
```
Open http://localhost:3000 in your browser.

**Usage:**
1. Paste your LinkedIn profile text, or upload a PDF/HTML export
2. Choose AI provider (Ollama local or OpenAI)
3. Click "Analyze" to see scores and feedback stream in real-time

### CLI
```bash
npm start
# or after npm link:
linkedool
```

**Options:**
```bash
linkedool --pdf profile.pdf              # Analyze PDF export
linkedool --html profile.html            # Analyze HTML export
linkedool --model gemma3                 # Specify Ollama model
```

## Features

- **Real-time streaming**: Watch AI feedback appear as it's generated
- **Multiple AI providers**: Use local Ollama or OpenAI API
- **Precise scoring**: Overall + section scores (Headline, About, Experience, Skills, Education)
- **Markdown rendering**: Formatted feedback with syntax highlighting
- **Multiple input formats**: Text paste, PDF upload, or HTML export

## AI Providers

### Ollama (Local)
1. Install [Ollama](https://ollama.ai/)
2. Pull a model: `ollama pull llama3`
3. Start Ollama (usually runs on http://localhost:11434)
4. Select "Ollama" in the UI and click "Load" to fetch available models

### OpenAI
1. Select "OpenAI" in the UI
2. Enter your API key (sk-...)
3. Choose a model (default: gpt-4)

## Environment Variables

- `OLLAMA_HOST`: Override Ollama URL (default: `http://localhost:11434`)
- `PORT`: Server port (default: `3000`)

## API Endpoints

### POST /api/analyze-stream
Streaming analysis with Server-Sent Events (SSE).

**Form data:**
- `profileText` or `profilePdf` or `profileHtml` (required)
- `provider`: `ollama` or `openai`
- `model`: Model name
- `host`: Ollama host (if using Ollama)
- `apiKey`: OpenAI API key (if using OpenAI)

### GET /api/models
List available Ollama models.

**Query params:**
- `host`: Ollama host URL

## License

MIT
