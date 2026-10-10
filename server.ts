import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// In-memory waitlist persistence
const waitlistSubscribers = [];

// In-memory default account state
let accountProfile = {
  id: "USR-ADHD-8841",
  name: "Alex Vance",
  email: "alex.vance@synapse.ai",
  role: "Creative Technologist & Founder",
  avatarInitials: "AV",
  membershipTier: "Alpha Founder Cohort #0418",
  joinedDate: "October 2026",
  cognitiveTypology: "Divergent Catalyst",
  subtype: "Hyperfocus / High Creative Divergence",
  energyArchetype: "Bilateral Synaptic Flow",
  primaryFocusChallenge: "Initiation Friction & Working Memory Loss",
  settings: {
    taskAnchorProtection: true,
    tabDriftGuard: true,
    driftTimeoutMinutes: 4,
    gentleAudioReentry: true,
    audioToneFrequency: 520,
    dopamineIntervalPacing: 45,
    hyperfocusPacerAlert: true,
    microRewardPings: true,
    contrastMode: "deep-space",
    soundFxEnabled: true,
    reducedMotion: false,
    localVaultEncryption: true,
    autoBackupFrequency: "Daily"
  },
  stats: {
    initiationFrictionDissolved: 58,
    focusHoursPreserved: 34.5,
    divergentSparksCaptured: 247,
    dopamineCrashesPrevented: 14,
    cognitiveEquilibriumScore: 94
  },
  integrations: [
    { id: "notion", name: "Notion Brain Vault", connected: true, lastSync: "12m ago" },
    { id: "obsidian", name: "Obsidian Local Graph", connected: true, lastSync: "1h ago" },
    { id: "google_cal", name: "Google Flow Calendar", connected: false, lastSync: "Never" },
    { id: "browser_ext", name: "Chrome Neural Anchor", connected: true, lastSync: "Active now" }
  ]
};

app.get('/api/account', (req, res) => {
  res.json({ success: true, data: accountProfile });
});

app.put('/api/account', (req, res) => {
  const updates = req.body || {};
  if (updates.name) accountProfile.name = updates.name;
  if (updates.email) accountProfile.email = updates.email;
  if (updates.role) accountProfile.role = updates.role;
  if (updates.cognitiveTypology) accountProfile.cognitiveTypology = updates.cognitiveTypology;
  if (updates.primaryFocusChallenge) accountProfile.primaryFocusChallenge = updates.primaryFocusChallenge;
  if (updates.avatarInitials) accountProfile.avatarInitials = updates.avatarInitials;
  
  if (updates.settings) {
    accountProfile.settings = {
      ...accountProfile.settings,
      ...updates.settings
    };
  }

  if (updates.integrations && Array.isArray(updates.integrations)) {
    accountProfile.integrations = updates.integrations;
  }

  res.json({ success: true, data: accountProfile });
});

app.post('/api/account/reset', (req, res) => {
  accountProfile.settings = {
    taskAnchorProtection: true,
    tabDriftGuard: true,
    driftTimeoutMinutes: 4,
    gentleAudioReentry: true,
    audioToneFrequency: 520,
    dopamineIntervalPacing: 45,
    hyperfocusPacerAlert: true,
    microRewardPings: true,
    contrastMode: "deep-space",
    soundFxEnabled: true,
    reducedMotion: false,
    localVaultEncryption: true,
    autoBackupFrequency: "Daily"
  };
  res.json({ success: true, message: 'Settings recalibrated to cognitive baseline', data: accountProfile });
});

app.get('/api/account/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="neuro_adaptive_account_vault.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(accountProfile, null, 2));
});

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

// Firebase Auth API Proxy to ensure authorized referer headers
app.all('/api/firebase-auth-proxy/identitytoolkit/*', async (req, res) => {
  const targetPath = req.originalUrl.replace('/api/firebase-auth-proxy/identitytoolkit/', '');
  const targetUrl = `https://identitytoolkit.googleapis.com/${targetPath}`;
  try {
    const headers: Record<string, string> = {
      'Content-Type': (req.headers['content-type'] as string) || 'application/json',
      'Referer': 'https://rosy-cache-478313-a2.firebaseapp.com',
      'Origin': 'https://rosy-cache-478313-a2.firebaseapp.com',
    };
    if (req.headers['x-firebase-locale']) {
      headers['X-Firebase-Locale'] = req.headers['x-firebase-locale'] as string;
    }
    if (req.headers['x-client-version']) {
      headers['X-Client-Version'] = req.headers['x-client-version'] as string;
    }
    if (req.headers['x-firebase-client']) {
      headers['X-Firebase-Client'] = req.headers['x-firebase-client'] as string;
    }
    if (req.headers['x-firebase-gmpid']) {
      headers['X-Firebase-GMPID'] = req.headers['x-firebase-gmpid'] as string;
    }
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string;
    }

    const isBodyMethod = !['GET', 'HEAD'].includes(req.method);
    let bodyData: any = undefined;
    if (isBodyMethod) {
      if (typeof req.body === 'object' && req.body !== null) {
        bodyData = JSON.stringify(req.body);
      } else if (typeof req.body === 'string') {
        bodyData = req.body;
      } else {
        bodyData = '{}';
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyData
    });
    const data = await response.text();
    res.status(response.status).set('Content-Type', response.headers.get('content-type') || 'application/json').send(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.all('/api/firebase-auth-proxy/securetoken/*', async (req, res) => {
  const targetPath = req.originalUrl.replace('/api/firebase-auth-proxy/securetoken/', '');
  const targetUrl = `https://securetoken.googleapis.com/${targetPath}`;
  try {
    const headers: Record<string, string> = {
      'Content-Type': (req.headers['content-type'] as string) || 'application/x-www-form-urlencoded',
      'Referer': 'https://rosy-cache-478313-a2.firebaseapp.com',
      'Origin': 'https://rosy-cache-478313-a2.firebaseapp.com',
    };
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'] as string;
    }

    const isBodyMethod = !['GET', 'HEAD'].includes(req.method);
    let bodyData: any = undefined;
    if (isBodyMethod) {
      if (typeof req.body === 'object' && req.body !== null) {
        bodyData = new URLSearchParams(req.body as any).toString();
      } else if (typeof req.body === 'string') {
        bodyData = req.body;
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyData
    });
    const data = await response.text();
    res.status(response.status).set('Content-Type', response.headers.get('content-type') || 'application/json').send(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Google Calendar API Proxy
app.all('/api/calendar/events*', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const calendarId = (req.query.calendarId as string) || 'primary';
  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'calendarId' && typeof v === 'string') queryParams.append(k, v);
  }
  const qStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const eventId = req.params[0] ? req.params[0].replace(/^\//, '') : '';
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${qStr}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${qStr}`;

  try {
    const isBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
    const apiRes = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: isBody ? JSON.stringify(req.body) : undefined
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calendar/calendarList', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  try {
    const apiRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': token }
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Google Tasks API Proxy
app.all('/api/tasks/lists*', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const listId = req.params[0] ? req.params[0].replace(/^\//, '') : '';
  const url = listId
    ? `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(listId)}`
    : `https://tasks.googleapis.com/tasks/v1/users/@me/lists`;
  try {
    const isBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
    const apiRes = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: isBody ? JSON.stringify(req.body) : undefined
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.all('/api/tasks/items*', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const listId = (req.query.listId as string) || '@default';
  const taskId = req.query.taskId as string;
  const qStr = req.query.showCompleted ? '?showCompleted=true&showHidden=true' : '';
  const url = taskId
    ? `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`
    : `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks${qStr}`;
  try {
    const isBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
    const apiRes = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: isBody ? JSON.stringify(req.body) : undefined
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Always serve index.html for root or SPA route navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI for ADHD server running at http://0.0.0.0:${PORT}`);
});
