import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';
import mod from 'pdf-parse';

// Robust pdf-parse resolver across versions:
// - v1 style: default export is a function (buffer) -> { text }
// - v2+ style: exports PDFParse class with getText()
let pdfParseFn;
try {
  if (typeof mod === 'function') {
    pdfParseFn = async (buffer) => (await mod(buffer)).text || '';
  } else if (typeof mod.default === 'function') {
    pdfParseFn = async (buffer) => (await mod.default(buffer)).text || '';
  } else if (mod?.PDFParse) {
    pdfParseFn = async (buffer) => {
      const parser = new mod.PDFParse({ data: buffer });
      const res = await parser.getText();
      return res?.text || '';
    };
  }
} catch (err) {
  pdfParseFn = null;
}

const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

async function loadPdfTextFromFile(filePath) {
  const dataBuffer = await fs.readFile(path.resolve(filePath));
  return loadPdfTextFromBuffer(dataBuffer);
}

async function loadPdfTextFromBuffer(buffer) {
  if (typeof pdfParseFn !== 'function') {
    throw new Error('pdf-parse import failed: no usable parser function');
  }
  const text = await pdfParseFn(buffer);
  return text || '';
}

function extractTextFromHtml(html) {
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

async function fetchHtmlFromUrl(url, cookieHeader) {
  const headers = cookieHeader ? { cookie: cookieHeader } : undefined;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function truncateForPrompt(text, max = 6000) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n... [truncated]\n';
}

function buildPrompt({ profileText, model }) {
  const profileBlock = truncateForPrompt(profileText);

  return [
    'You are a LinkedIn profile auditor. Score and critique the profile like Google Lighthouse.',
    'Return concise markdown with REQUIRED format:',
    '',
    '## Scores',
    '- Overall Score: [X]/100',
    '- Headline Score: [X]/100',
    '- About Score: [X]/100',
    '- Experience Score: [X]/100',
    '- Skills Score: [X]/100',
    '- Education Score: [X]/100',
    '',
    '## Strengths',
    '[List as bullets]',
    '',
    '## Gaps & Risks',
    '[List as bullets]',
    '',
    '## Recommendations',
    '[Actionable, short bullets with examples]',
    '',
    '## Optional: ATS Keywords',
    '[For target roles if evident]',
    '',
    'IMPORTANT: Use precise scores (e.g., 73, 84, 67) - do NOT round to multiples of 5 or 10.',
    'Differentiate scores based on actual quality differences.',
    'Rules: be direct, avoid fluff, keep outputs compact.',
    '',
    'PROFILE TEXT:',
    profileBlock,
    '',
    `Model hint: ${model}`,
  ].join('\n');
}

async function callOllama(model, prompt, host = DEFAULT_OLLAMA_HOST) {
  const target = host || DEFAULT_OLLAMA_HOST;
  const res = await fetch(`${target}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  return json.response;
}

async function callOpenAI(model, prompt, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  return json.choices[0]?.message?.content || '';
}

async function fetchModels(host = DEFAULT_OLLAMA_HOST) {
  const target = host || DEFAULT_OLLAMA_HOST;
  const res = await fetch(`${target}/api/tags`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load models: ${res.status} ${res.statusText} - ${text}`);
  }
  const json = await res.json();
  return json.models || [];
}

module.exports = {
  DEFAULT_OLLAMA_HOST,
  loadPdfTextFromFile,
  loadPdfTextFromBuffer,
  extractTextFromHtml,
  fetchHtmlFromUrl,
  truncateForPrompt,
  buildPrompt,
  callOllama,
  callOpenAI,
  fetchModels,
};
