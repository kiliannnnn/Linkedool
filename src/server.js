const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const {
  loadPdfTextFromBuffer,
  extractTextFromHtml,
  buildPrompt,
  callOllama,
  callOpenAI,
  fetchModels,
  DEFAULT_OLLAMA_HOST,
} = require('./analyzer');
const { streamOllama, streamOpenAI } = require('./streaming');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'linkedool-server' });
});

app.post(
  '/api/analyze',
  upload.fields([
    { name: 'profilePdf', maxCount: 1 },
    { name: 'profileHtml', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const body = req.body || {};
      const provider = body.provider || 'ollama';
      const model = body.model || (provider === 'openai' ? 'gpt-4' : 'llama3');

      let profileText = body.profileText;
      const profilePdf = req.files?.profilePdf?.[0];
      const profileHtml = req.files?.profileHtml?.[0];

      if (!profileText && profilePdf) {
        profileText = await loadPdfTextFromBuffer(profilePdf.buffer);
      }

      if (!profileText && profileHtml) {
        profileText = extractTextFromHtml(profileHtml.buffer.toString('utf8'));
      }

      if (!profileText || !profileText.trim()) {
        return res.status(400).json({ error: 'Provide profileText, profilePdf, or profileHtml.' });
      }

      let llmReport = null;
      let responseHost = null;

      try {
        const prompt = buildPrompt({ profileText, model });

        if (provider === 'ollama') {
          const host = body.host || DEFAULT_OLLAMA_HOST;
          responseHost = host || DEFAULT_OLLAMA_HOST;
          llmReport = await callOllama(model, prompt, host);
        } else if (provider === 'openai') {
          const apiKey = body.apiKey;
          if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key required.' });
          }
          llmReport = await callOpenAI(model, prompt, apiKey);
          responseHost = 'api.openai.com';
        } else {
          return res.status(400).json({ error: 'Unknown provider. Use ollama or openai.' });
        }
      } catch (err) {
        return res.status(502).json({
          error: 'LLM request failed',
          details: err.message,
        });
      }

      res.json({
        provider,
        model,
        host: responseHost,
        llmReport,
      });
    } catch (err) {
      console.error('[linkedool-server] error:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  }
);

app.get('/api/models', async (req, res) => {
  try {
    const host = req.query.host || DEFAULT_OLLAMA_HOST;
    const models = await fetchModels(host);
    res.json({ host: host || DEFAULT_OLLAMA_HOST, models });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch models', details: err.message });
  }
});

app.post(
  '/api/analyze-stream',
  upload.fields([
    { name: 'profilePdf', maxCount: 1 },
    { name: 'profileHtml', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const body = req.body || {};
      const provider = body.provider || 'ollama';
      const model = body.model || (provider === 'openai' ? 'gpt-4' : 'llama3');

      let profileText = body.profileText;
      const profilePdf = req.files?.profilePdf?.[0];
      const profileHtml = req.files?.profileHtml?.[0];

      if (!profileText && profilePdf) {
        profileText = await loadPdfTextFromBuffer(profilePdf.buffer);
      }

      if (!profileText && profileHtml) {
        profileText = extractTextFromHtml(profileHtml.buffer.toString('utf8'));
      }

      if (!profileText || !profileText.trim()) {
        return res.status(400).json({ error: 'Provide profileText, profilePdf, or profileHtml.' });
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const prompt = buildPrompt({ profileText, model });

        let stream;
        if (provider === 'ollama') {
          const host = body.host || DEFAULT_OLLAMA_HOST;
          stream = streamOllama(model, prompt, host);
        } else if (provider === 'openai') {
          const apiKey = body.apiKey;
          if (!apiKey) {
            res.write(`data: ${JSON.stringify({ error: 'OpenAI API key required.' })}\n\n`);
            return res.end();
          }
          stream = streamOpenAI(model, prompt, apiKey);
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Unknown provider. Use ollama or openai.' })}\n\n`);
          return res.end();
        }

        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: 'LLM request failed', details: err.message })}\n\n`);
        res.end();
      }
    } catch (err) {
      console.error('[linkedool-server] stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error', details: err.message });
      }
    }
  }
);

app.listen(PORT, () => {
  console.log(`[linkedool] server listening on http://localhost:${PORT}`);
});
