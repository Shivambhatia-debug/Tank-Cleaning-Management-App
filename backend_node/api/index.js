// Vercel serverless entry: all requests rewritten here, Express handles routes
try {
  module.exports = require('../server');
} catch (err) {
  console.error('Server load failed:', err);
  const express = require('express');
  const fallback = express();
  fallback.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });
  fallback.get('/api/health', (req, res) => res.json({ ok: false, error: 'Server failed to load', message: err.message }));
  fallback.use((req, res) => res.status(500).json({ error: err.message }));
  module.exports = fallback;
}
