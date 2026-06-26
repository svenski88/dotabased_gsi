import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ENV_FILE = 'dotabased-gsi.env';

function unquoteValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  const value = unquoteValue(normalized.slice(separatorIndex + 1));

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return { key, value };
}

export function loadEnvFile(options = {}) {
  const envFilePath = path.resolve(
    options.cwd || process.cwd(),
    process.env.DOTABASED_ENV_FILE || options.fileName || DEFAULT_ENV_FILE,
  );

  if (!fs.existsSync(envFilePath)) {
    return {
      loaded: false,
      path: envFilePath,
      keys: [],
    };
  }

  const text = fs.readFileSync(envFilePath, 'utf8');
  const keys = [];

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed || Object.prototype.hasOwnProperty.call(process.env, parsed.key)) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
    keys.push(parsed.key);
  }

  return {
    loaded: true,
    path: envFilePath,
    keys,
  };
}
