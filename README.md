# Linkedool

CLI helper to audit and improve a LinkedIn profile using local Ollama.

## Prerequisites
- Node.js 18+
- [Ollama](https://ollama.ai/) running locally (default host `http://localhost:11434`).
- LinkedIn profile export (PDF), HTML, or accessible URL (fetching with cookies may violate LinkedIn ToS; prefer exports).

## Install
```bash
npm install
```

Optionally link the CLI:
```bash
npm link
```

## Usage
Interactive flow:
```bash
npm start
# or
linkedool
```

Flags (non-interactive friendly):
- `--pdf <path>`: LinkedIn PDF export.
- `--html <path>`: LinkedIn HTML file (paste/export).
- `--url <url>` with `--cookie <li_at>`: fetch page HTML (use responsibly; may break LinkedIn ToS).
- `--model <name>`: Ollama model (default `llama3`).
- `--no-llm`: Skip Ollama call; show heuristic score only.

Examples:
```bash
linkedool --pdf ./profile.pdf --model llama3
linkedool --html ./profile.html --no-llm
```

## Server API
Start the API server:
```bash
npm run serve
# server listens on http://localhost:3000 by default
```

Web UI:
- Open http://localhost:3000 to use the built-in interface.
- Supports profile text paste, PDF upload, or HTML upload, optional CV file, Ollama host selection, model selection (auto-loaded from host), and skipping LLM.

Endpoint: `POST /api/analyze`
- Accepts `multipart/form-data` or JSON.
- Provide **one** of: `profileText` (string), `profilePdf` (file), `profileHtml` (file).
- Optional CV/resume: `cvText` (string) or `cv` (file; PDF or text).
- Optional `model` (default `llama3`), `noLlm=true` to skip Ollama.

Example (multipart with PDF):
```bash
curl -X POST http://localhost:3000/api/analyze \
	-F "profilePdf=@./profile.pdf" \
	-F "cv=@./resume.pdf" \
	-F "model=llama3"
```

JSON example (raw text):
```bash
curl -X POST http://localhost:3000/api/analyze \
	-H "Content-Type: application/json" \
	-d '{"profileText":"your profile text","noLlm":true}'
```

Response shape:
```json
{
	"heuristicScore": 78,
	"signals": { "wordCount": 900, "headline": true, ... },
	"model": "llama3",
	"llmReport": "...markdown from Ollama..."
}
```

## What it does
- Extracts text from PDF/HTML/URL/pasted input.
- Optional CV/resume ingestion for alignment.
- Heuristic quick score (0-100) with simple signal counts.
- Sends a structured prompt to Ollama to return section scores, strengths, risks, and recommendations.

## Configuration
- `OLLAMA_HOST`: override Ollama base URL (default `http://localhost:11434`).

## Notes
- Fetching LinkedIn pages with cookies can violate LinkedIn terms; prefer PDF exports.
- Output is deterministic on heuristics; AI feedback depends on your chosen model.
