import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function currentModuleDir() {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

const MODULE_DIR = currentModuleDir();

const PYTHON_BIN = process.env.DOTABASED_PYTHON || 'python';
const EXECUTABLE_DIR = path.dirname(process.execPath);
const BUNDLED_SCORER_PATH = path.join(EXECUTABLE_DIR, 'scorer', 'scorer.exe');
const BUNDLED_PREDICTION_DIR = path.join(EXECUTABLE_DIR, 'dotaprediction');
const SOURCE_SCORER_PATH = path.join(MODULE_DIR, 'scorer.py');
const SOURCE_PREDICTION_DIR = path.resolve(MODULE_DIR, '..', 'dotaprediction');
const IS_PACKAGED_EXECUTABLE = path.basename(process.execPath).toLowerCase() === 'dotabased-gsi.exe'
  || fs.existsSync(BUNDLED_SCORER_PATH);
const PREDICTION_DIR = process.env.DOTABASED_PREDICTION_DIR
  || (IS_PACKAGED_EXECUTABLE ? BUNDLED_PREDICTION_DIR : SOURCE_PREDICTION_DIR);
const REQUEST_TIMEOUT_MS = Number(process.env.DOTABASED_PREDICT_TIMEOUT_MS || 2000);

function scorerCommand() {
  if (process.env.DOTABASED_SCORER_EXE) {
    return {
      command: process.env.DOTABASED_SCORER_EXE,
      args: [],
      mode: 'custom-exe',
    };
  }

  if (fs.existsSync(BUNDLED_SCORER_PATH)) {
    return {
      command: BUNDLED_SCORER_PATH,
      args: [],
      mode: 'bundled-exe',
    };
  }

  return {
    command: PYTHON_BIN,
    args: [SOURCE_SCORER_PATH],
    mode: 'python',
  };
}

export class PredictionService {
  constructor() {
    this.process = null;
    this.ready = false;
    this.startupError = null;
    this.nextRequestId = 1;
    this.pendingRequests = new Map();
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
  }

  start() {
    if (this.process) {
      return;
    }

    const scorer = scorerCommand();
    this.scorerMode = scorer.mode;
    this.scorerPath = scorer.command;
    this.process = spawn(scorer.command, scorer.args, {
      env: {
        ...process.env,
        DOTABASED_PREDICTION_DIR: PREDICTION_DIR,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');
    this.process.stdout.on('data', chunk => this.handleStdout(chunk));
    this.process.stderr.on('data', chunk => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-4000);
    });
    this.process.on('exit', (code, signal) => this.handleExit(code, signal));
    this.process.on('error', error => {
      this.startupError = error.message || 'Could not start prediction scorer.';
      this.rejectPending(error);
    });
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let payload;
      try {
        payload = JSON.parse(line);
      } catch (error) {
        this.startupError = `Invalid scorer output: ${line}`;
        continue;
      }

      if (payload.type === 'ready') {
        this.ready = true;
        this.startupError = null;
        continue;
      }

      if (payload.type === 'startup_error') {
        this.startupError = payload.error || 'Prediction scorer failed to start.';
        continue;
      }

      const request = this.pendingRequests.get(payload.id);
      if (!request) {
        continue;
      }

      windowClearTimeout(request.timeoutId);
      this.pendingRequests.delete(payload.id);
      request.resolve(payload);
    }
  }

  handleExit(code, signal) {
    const error = new Error(`Prediction scorer exited (${signal || code}). ${this.stderrBuffer}`.trim());
    this.process = null;
    this.ready = false;
    this.startupError = error.message;
    this.rejectPending(error);
  }

  rejectPending(error) {
    for (const [id, request] of this.pendingRequests.entries()) {
      windowClearTimeout(request.timeoutId);
      request.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  async predict(models) {
    this.start();

    if (this.startupError && !this.process) {
      throw new Error(this.startupError);
    }

    const id = this.nextRequestId++;
    const payload = { id, models };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Prediction scorer timed out.'));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      try {
        this.process.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  status() {
    this.start();

    return {
      ok: this.ready,
      ready: this.ready,
      modelRoot: PREDICTION_DIR,
      scorerMode: this.scorerMode || scorerCommand().mode,
      scorerPath: this.scorerPath || scorerCommand().command,
      error: this.startupError,
      stderr: this.stderrBuffer,
    };
  }
}

function windowClearTimeout(timeoutId) {
  clearTimeout(timeoutId);
}
