import http from 'node:http';
import { emptyDraft, normalizeGameStateDraft, summarizeGameState } from './draft.js';

const HOST = process.env.DOTABASED_GSI_HOST || '127.0.0.1';
const PORT = Number(process.env.DOTABASED_GSI_PORT || 3100);
const AUTH_TOKEN = process.env.DOTABASED_GSI_TOKEN || 'dotabased-local-gsi';
const VERSION = '0.1.0';
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
  'https://dotabased.com',
  'https://www.dotabased.com',
]);

let latestRawGameState = null;
let latestDraft = emptyDraft();
let latestPostAt = null;

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function corsOrigin(origin) {
  if (!origin) {
    return '*';
  }
  return allowedOrigins.has(origin) ? origin : '';
}

function corsHeaders(request) {
  const origin = corsOrigin(request.headers.origin);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }

  return headers;
}

function writeJson(response, statusCode, payload, request) {
  response.writeHead(statusCode, {
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function writeOptions(response, request) {
  response.writeHead(204, {
    ...corsHeaders(request),
    'Access-Control-Max-Age': '600',
  });
  response.end();
}

function requestPath(request) {
  return new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`).pathname;
}

function isAuthorized(payload) {
  const token = payload?.auth?.token;
  return !AUTH_TOKEN || token === AUTH_TOKEN;
}

async function handleGsiPost(request, response) {
  try {
    const bodyText = await readRequestBody(request);
    const payload = bodyText ? JSON.parse(bodyText) : {};

    if (!isAuthorized(payload)) {
      writeJson(response, 401, { ok: false, error: 'Invalid GSI auth token.' }, request);
      return;
    }

    latestRawGameState = payload;
    latestDraft = normalizeGameStateDraft(payload);
    latestPostAt = new Date().toISOString();
    writeJson(response, 200, { ok: true }, request);
  } catch (error) {
    writeJson(response, 400, { ok: false, error: error.message || 'Invalid GSI payload.' }, request);
  }
}

const server = http.createServer(async (request, response) => {
  const path = requestPath(request);

  if (request.method === 'OPTIONS') {
    writeOptions(response, request);
    return;
  }

  if (request.method === 'GET' && path === '/health') {
    writeJson(response, 200, {
      ok: true,
      version: VERSION,
      listening: `${HOST}:${PORT}`,
      hasGameState: Boolean(latestRawGameState),
      latestPostAt,
    }, request);
    return;
  }

  if (request.method === 'GET' && path === '/draft') {
    writeJson(response, 200, latestDraft, request);
    return;
  }

  if (request.method === 'GET' && path === '/debug') {
    writeJson(response, 200, {
      latestPostAt,
      draft: latestDraft,
      summary: summarizeGameState(latestRawGameState),
    }, request);
    return;
  }

  if (request.method === 'POST' && path === '/gsi') {
    await handleGsiPost(request, response);
    return;
  }

  writeJson(response, 404, { ok: false, error: 'Not found.' }, request);
});

server.listen(PORT, HOST, () => {
  console.log(`DotaBASED GSI bridge listening on http://${HOST}:${PORT}`);
});
