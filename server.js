import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// In-memory waitlist persistence
const waitlistSubscribers = [];

app.post('/api/waitlist', (req, res) => {
  const { email, role, primaryChallenge } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const entry = {
    email,
    role: role || 'Explorer',
    primaryChallenge: primaryChallenge || 'Executive Function',
    createdAt: new Date().toISOString()
  };
  waitlistSubscribers.push(entry);
  return res.json({ success: true, count: waitlistSubscribers.length });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', app: 'AI for ADHD: The Cognitive Co-Pilot' });
});

// Always serve index.html for root or SPA route navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI for ADHD server running at http://0.0.0.0:${PORT}`);
});
