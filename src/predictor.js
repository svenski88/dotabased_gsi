import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_BIN = process.env.DOTABASED_PYTHON || 'python';
const PREDICTION_DIR = process.env.DOTABASED_PREDICTION_DIR
  || path.resolve(__dirname, '..', '..', 'dotaprediction');
const REQUEST_TIMEOUT_MS = Number(process.env.DOTABASED_PREDICT_TIMEOUT_MS || 2000);

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

    const scorerPath = path.join(__dirname, 'scorer.py');
    this.process = spawn(PYTHON_BIN, [scorerPath], {
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
      error: this.startupError,
      stderr: this.stderrBuffer,
    };
  }
}

function windowClearTimeout(timeoutId) {
  clearTimeout(timeoutId);
}
