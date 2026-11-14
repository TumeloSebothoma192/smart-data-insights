const axios = require('axios');

/** Client for the Python ML service. Sends the shared INTERNAL_TOKEN when one is configured. */
const py = axios.create({
  baseURL: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  headers: process.env.INTERNAL_TOKEN ? { 'x-internal-token': process.env.INTERNAL_TOKEN } : {},
});

// On free hosting the ML service sleeps when idle and answers 502/503/504 (or refuses the
// connection) for up to about a minute while it wakes. Retry those instead of failing the request.
const WAKING = new Set([502, 503, 504]);
const MAX_WAIT_MS = 90_000;
py.interceptors.response.use(null, async (error) => {
  const cfg = error.config;
  const status = error.response?.status;
  const retryable = WAKING.has(status) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code);
  if (!cfg || !retryable) throw error;
  cfg._start = cfg._start || Date.now();
  if (Date.now() - cfg._start > MAX_WAIT_MS) throw error;
  // Multipart bodies are streams that can only be read once; rebuild them from the saved factory.
  if (cfg._makeBody) { const form = cfg._makeBody(); cfg.data = form; cfg.headers = { ...cfg.headers, ...form.getHeaders() }; }
  await new Promise((r) => setTimeout(r, 5000));
  return py.request(cfg);
});

/** Wake the ML service without waiting for it (call when a user is likely to need it soon). */
py.warmUp = () => py.get('/health', { timeout: 90_000 }).catch(() => {});

module.exports = py;
