const axios = require('axios');

/** Client for the Python ML service. Sends the shared INTERNAL_TOKEN when one is configured. */
module.exports = axios.create({
  baseURL: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  headers: process.env.INTERNAL_TOKEN ? { 'x-internal-token': process.env.INTERNAL_TOKEN } : {},
});
