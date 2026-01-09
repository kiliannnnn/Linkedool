#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { Command } = require('commander');
const inquirer = require('inquirer');
const {
  loadPdfTextFromFile,
  extractTextFromHtml,
  fetchHtmlFromUrl,
  buildPrompt,
  callOllama,
} = require('./analyzer');

function logInfo(message) {
  console.log(`\n[linkedool] ${message}`);
}

async function readTextFile(filePath) {
  const resolved = path.resolve(filePath);
  const buffer = await fs.readFile(resolved);
  return buffer.toString('utf8');
}

async function promptForSource() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: 'How do you want to import the profile?',
      choices: [
        { name: 'LinkedIn PDF download', value: 'pdf' },
        { name: 'Paste LinkedIn HTML', value: 'html' },
        { name: 'Fetch LinkedIn profile URL (requires your session cookie, may break ToS)', value: 'url' },
        { name: 'Paste raw profile text', value: 'text' },
      ],
    },
  ]);

  return answers.source;
}

async function promptForCv() {
  const { addCv } = await inquirer.prompt([
    { type: 'confirm', name: 'addCv', message: 'Attach a recent CV/resume for alignment?', default: false },
  ]);

  if (!addCv) return '';

  const { cvPath } = await inquirer.prompt([
    { type: 'input', name: 'cvPath', message: 'Path to CV/resume text or PDF file:' },
  ]);

  if (cvPath.toLowerCase().endsWith('.pdf')) {
    return await loadPdfTextFromFile(cvPath);
  }

  return await readTextFile(cvPath);
}

async function loadProfileTextFromInteractive(source) {
  if (source === 'pdf') {
    const { pdfPath } = await inquirer.prompt([
      { type: 'input', name: 'pdfPath', message: 'Path to LinkedIn PDF:' },
    ]);
    return await loadPdfTextFromFile(pdfPath);
  }

  if (source === 'html') {
    const { htmlPath } = await inquirer.prompt([
      { type: 'input', name: 'htmlPath', message: 'Path to HTML file:' },
    ]);
    const html = await readTextFile(htmlPath);
    return extractTextFromHtml(html);
  }

  if (source === 'url') {
    const { url, cookie } = await inquirer.prompt([
      { type: 'input', name: 'url', message: 'Profile URL:' },
      { type: 'input', name: 'cookie', message: 'Session cookie (li_at). Use responsibly; may violate LinkedIn ToS):' },
    ]);
    const html = await fetchHtmlFromUrl(url, cookie);
    return extractTextFromHtml(html);
  }

  const { text } = await inquirer.prompt([
    { type: 'editor', name: 'text', message: 'Paste profile text, save & close your editor:' },
  ]);
  return text;
}

async function getProfileText(opts) {
  if (opts.pdf) return await loadPdfTextFromFile(opts.pdf);
  if (opts.html) return extractTextFromHtml(await readTextFile(opts.html));
  if (opts.url) return extractTextFromHtml(await fetchHtmlFromUrl(opts.url, opts.cookie));
  if (opts.text) return opts.text;

  const source = await promptForSource();
  return await loadProfileTextFromInteractive(source);
}

async function run() {
  const program = new Command();
  program
    .name('linkedool')
    .description('Audit a LinkedIn profile using local Ollama')
    .option('--pdf <path>', 'Path to LinkedIn PDF export')
    .option('--html <path>', 'Path to LinkedIn HTML file')
    .option('--url <url>', 'LinkedIn profile URL (requires session cookie)')
    .option('--cookie <cookie>', 'Session cookie for fetching profile')
    .option('--text <text>', 'Raw profile text')
    .option('--model <name>', 'Ollama model name', 'llama3')
    .parse(process.argv);

  const opts = program.opts();

  logInfo('Loading profile...');
  const profileText = await getProfileText(opts);
  if (!profileText || profileText.trim().length === 0) {
    console.error('No profile content detected.');
    process.exit(1);
  }

  const cvText = await promptForCv();

  logInfo(`Calling Ollama model "${opts.model}"...`);
  const prompt = buildPrompt({ profileText, cvText, model: opts.model });
  try {
    const response = await callOllama(opts.model, prompt);
    console.log('\n=== Ollama Audit ===\n');
    console.log(response);
  } catch (err) {
    console.error('Ollama request failed:', err.message);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
