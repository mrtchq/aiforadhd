import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Google GenAI client for server-side intelligence
const geminiApiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

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

// ============================================================
// GMAIL & NEURAL EMAIL RADAR API ENDPOINTS
// ============================================================

function extractBodyText(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    try {
      return Buffer.from(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    } catch (e) {}
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        try {
          return Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        } catch (e) {}
      }
      if (part.parts) {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
  }
  return '';
}

function parseGmailMessage(msg: any) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => {
    const h = headers.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
  };

  const subject = getHeader('Subject') || '(No Subject)';
  const from = getHeader('From') || 'Unknown Sender';
  const to = getHeader('To') || '';
  const date = getHeader('Date') || '';

  // Extract plain text snippet or body
  const bodySnippet = msg.snippet || '';
  const fullBodyText = extractBodyText(msg.payload) || bodySnippet;

  return {
    id: msg.id,
    threadId: msg.threadId,
    labelIds: msg.labelIds || [],
    isUnread: (msg.labelIds || []).includes('UNREAD'),
    isStarred: (msg.labelIds || []).includes('STARRED'),
    isImportant: (msg.labelIds || []).includes('IMPORTANT'),
    subject,
    from,
    to,
    date,
    snippet: bodySnippet,
    body: fullBodyText.slice(0, 4000),
    internalDate: msg.internalDate
  };
}

function makeBase64UrlEmail(to: string, subject: string, bodyText: string, inReplyTo?: string, threadId?: string) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    ...(inReplyTo ? [`In-Reply-To: <${inReplyTo}>`, `References: <${inReplyTo}>`] : []),
    '',
    bodyText
  ];
  const message = messageParts.join('\r\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 1. List messages
app.get('/api/gmail/messages', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const maxResults = (req.query.maxResults as string) || '20';
  const q = (req.query.q as string) || '';
  const pageToken = (req.query.pageToken as string) || '';
  const queryParams = new URLSearchParams();
  queryParams.append('maxResults', maxResults);
  if (q) queryParams.append('q', q);
  if (pageToken) queryParams.append('pageToken', pageToken);

  try {
    const apiRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`, {
      headers: { 'Authorization': token }
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Batch hydrate messages with metadata
app.post('/api/gmail/messages/batch', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ success: true, messages: [] });
  }

  try {
    const targetIds = ids.slice(0, 30);
    const results = await Promise.allSettled(
      targetIds.map(async (id: string) => {
        const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {
          headers: { 'Authorization': token }
        });
        if (!resp.ok) {
          throw new Error(`Failed to fetch message ${id}`);
        }
        return await resp.json();
      })
    );

    const messages = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => parseGmailMessage(r.value));

    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single message
app.get('/api/gmail/messages/:id', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const id = req.params.id;

  try {
    const apiRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {
      headers: { 'Authorization': token }
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).send(errText);
    }
    const raw = await apiRes.json();
    const parsed = parseGmailMessage(raw);
    res.json({ success: true, message: parsed, raw });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3.5. Get full thread
app.get('/api/gmail/threads/:id', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const id = req.params.id;

  try {
    const apiRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(id)}?format=full`, {
      headers: { 'Authorization': token }
    });
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).send(errText);
    }
    const raw = await apiRes.json();
    const messages = (raw.messages || []).map((m: any) => parseGmailMessage(m));
    res.json({ success: true, threadId: raw.id, messages, raw });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Modify labels (read/unread, starred)
app.post('/api/gmail/messages/:id/modify', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const id = req.params.id;

  try {
    const apiRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Trash message
app.post('/api/gmail/messages/:id/trash', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const id = req.params.id;

  try {
    const apiRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}/trash`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Send email / reply
app.post('/api/gmail/send', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing authorization bearer token' });
  const { to, subject, bodyText, inReplyTo, threadId } = req.body;
  if (!to || !subject || !bodyText) {
    return res.status(400).json({ error: 'To, subject, and bodyText are required' });
  }

  try {
    const rawEncoded = makeBase64UrlEmail(to, subject, bodyText, inReplyTo, threadId);
    const payload: any = { raw: rawEncoded };
    if (threadId) payload.threadId = threadId;

    const apiRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await apiRes.text();
    res.status(apiRes.status).set('Content-Type', apiRes.headers.get('content-type') || 'application/json').send(text);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI NEURO-ADAPTIVE EMAIL INTELLIGENCE (Gemini 3.8 Flash)
// ============================================================

app.post('/api/ai/analyze-emails', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.json({ success: true, analysis: [] });
  }

  // Attempt Gemini 3.8 Flash analysis
  if (ai) {
    try {
      const prompt = `You are the built-in AI Cognitive Co-Pilot for an adult with ADHD. Your goal is to eliminate email overwhelm, paralysis, and executive fatigue.
Analyze each of the following emails and provide an ADHD-optimized breakdown:
1. "priority": One of ["URGENT", "NEEDS_RESPONSE", "FYI", "NOISE"].
   - "URGENT": Deadlines, bills, time-sensitive issues, boss/client escalations requiring action within 24-48 hours.
   - "NEEDS_RESPONSE": Clear question or request from a person that requires an answer soon.
   - "FYI": Useful receipts, flight details, informative updates (no immediate action needed).
   - "NOISE": Promotional blasts, marketing, newsletters, or automated bulletins that can be ignored or safely archived.
2. "urgencyScore": Number from 1 to 100 (100 = most urgent).
3. "summary": Exactly ONE crisp sentence (max 20 words) giving the essence without corporate fluff.
4. "actionItem": A clear, concrete ADHD micro-step (e.g. "Reply with your approval", "Pay bill by Friday", "Review slide 4", "No action needed").
5. "suggestedDueDate": If a deadline or date is mentioned or implied, state it clearly (e.g., "Today by 5pm", "Oct 15", "End of Week", or null).
6. "suggestedReply": A courteous, ultra-concise draft response (1-3 sentences) that the user can send with 1 click to overcome reply paralysis. If no response needed, provide null.
7. "executiveSummary": An array of 3 to 5 concise, high-impact bulleted strings.
   CRITICAL REQUIREMENT: For every critical or high-priority email (e.g. priority == "URGENT" or urgencyScore >= 80), you MUST generate a thorough, executive-grade bulleted summary covering:
   - "📌 Situation & Thread Context": What is happening and why it matters
   - "⚡ Critical Deadlines & Stakes": Concrete dates, milestones, or consequences of inaction
   - "🎯 Immediate Actions & Decision Points": Exactly what decision or micro-step is needed
   - "👥 Key Stakeholders & Responsibilities": Who is involved or waiting
   - "💡 Strategic Bottom Line": High-level executive takeaway for an ADHD brain
   For non-critical emails, provide 2 to 3 concise summary bullets.

Emails to analyze:
${JSON.stringify(emails.slice(0, 15).map(e => ({
  id: e.id,
  threadId: e.threadId,
  subject: e.subject,
  from: e.from,
  snippet: e.snippet,
  body: e.body ? e.body.slice(0, 800) : '',
  date: e.date
})))}

Return valid JSON with an "items" array:
{
  "items": [
    {
      "id": "string",
      "priority": "URGENT" | "NEEDS_RESPONSE" | "FYI" | "NOISE",
      "urgencyScore": 90,
      "summary": "string",
      "actionItem": "string",
      "suggestedDueDate": "string or null",
      "suggestedReply": "string or null",
      "executiveSummary": [
        "📌 Situation: ...",
        "⚡ Deadlines: ...",
        "🎯 Action: ...",
        "👥 Stakeholders: ...",
        "💡 Bottom Line: ..."
      ]
    }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = aiResponse.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (pErr) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.analysis || []);
      return res.json({ success: true, source: 'gemini-3.8-flash', analysis: items });
    } catch (err: any) {
      console.warn('Gemini email analysis error, falling back to cognitive heuristics:', err.message);
    }
  }

  // Smart heuristic fallback ensuring zero downtime
  const fallbackAnalysis = emails.map((e: any) => {
    const text = `${e.subject} ${e.snippet}`.toLowerCase();
    let priority = 'FYI';
    let urgencyScore = 30;
    let actionItem = 'Review when convenient';
    let suggestedDueDate: string | null = null;
    let suggestedReply: string | null = null;
    let executiveSummary: string[] = [];

    if (text.includes('urgent') || text.includes('asap') || text.includes('deadline') || text.includes('due') || text.includes('action required') || text.includes('invoice') || text.includes('past due') || text.includes('payment') || text.includes('bill')) {
      priority = 'URGENT';
      urgencyScore = 95;
      actionItem = 'Time-sensitive deadline or request. Review and take action.';
      suggestedDueDate = 'Today';
      suggestedReply = 'Hi,\n\nReceived your message. I am on it and will send over the details shortly.\n\nBest,';
      executiveSummary = [
        `📌 Situation: Time-critical escalation regarding "${e.subject || 'Action Item'}"`,
        `⚡ Deadlines: Immediate response required by today to avoid project delays or late fees`,
        `🎯 Action: Review message details, verify required deliverables, and execute micro-step`,
        `👥 Stakeholders: Sender (${(e.from || 'Partner').split('<')[0].trim()}) awaiting confirmation`,
        `💡 Bottom Line: High-stakes thread flagged for prioritized completion before day end`
      ];
    } else if (text.includes('?') || text.includes('can you') || text.includes('could you') || text.includes('please confirm') || text.includes('let me know') || text.includes('thoughts?') || text.includes('feedback')) {
      priority = 'NEEDS_RESPONSE';
      urgencyScore = 75;
      actionItem = 'A reply or input was requested.';
      suggestedReply = 'Hi,\n\nThanks for following up! Sounds good to me. Let me know if you need anything else.\n\nBest,';
      executiveSummary = [
        `📌 Context: Direct inquiry received regarding "${e.subject || 'Pending Request'}"`,
        `🎯 Action: Provide answers or confirmation to keep thread moving`,
        `💡 Bottom Line: Standard 2-minute reply will resolve this conversation thread`
      ];
    } else if (text.includes('unsubscribe') || text.includes('discount') || text.includes('% off') || text.includes('deal') || text.includes('newsletter') || text.includes('no-reply') || text.includes('noreply') || text.includes('sale')) {
      priority = 'NOISE';
      urgencyScore = 10;
      actionItem = 'Promotional or automated newsletter. Safe to ignore or archive.';
      executiveSummary = [
        `📌 Overview: Automated marketing blast or promotional broadcast`,
        `💤 Impact: Zero cognitive priority. Safe to archive or ignore without consequence`
      ];
    } else {
      executiveSummary = [
        `📌 Overview: Informational message regarding "${e.subject || 'Update'}"`,
        `🎯 Action: File or review when scheduled time permits`,
        `💡 Bottom Line: No immediate blocker or deadline detected`
      ];
    }

    return {
      id: e.id,
      threadId: e.threadId,
      priority,
      urgencyScore,
      summary: e.subject || 'Incoming message',
      actionItem,
      suggestedDueDate,
      suggestedReply,
      executiveSummary
    };
  });

  return res.json({ success: true, source: 'heuristic', analysis: fallbackAnalysis });
});

// Dedicated Executive Summary Generator for critical email threads
app.post('/api/ai/thread-executive-summary', async (req, res) => {
  const token = req.headers['authorization'];
  const { threadId, emailId, subject, from, snippet, bodyText } = req.body;

  let threadMessagesText = '';
  let participantList: string[] = [];

  // Try to hydrate complete thread if token and threadId are provided
  if (token && threadId) {
    try {
      const threadRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`, {
        headers: { 'Authorization': token }
      });
      if (threadRes.ok) {
        const threadData = await threadRes.json();
        const rawMsgs = threadData.messages || [];
        const parsedMsgs = rawMsgs.map((m: any) => parseGmailMessage(m));
        
        participantList = Array.from(new Set(parsedMsgs.map((m: any) => m.from).filter(Boolean))) as string[];
        threadMessagesText = parsedMsgs.map((m: any, idx: number) => {
          return `--- Message #${idx + 1} from ${m.from} on ${m.date} ---\nSubject: ${m.subject}\nContent:\n${m.body || m.snippet}\n`;
        }).join('\n');
      }
    } catch (tErr) {
      console.warn('Could not hydrate thread from Gmail, using provided payload:', tErr);
    }
  }

  // Fallback text if full thread could not be fetched
  if (!threadMessagesText) {
    threadMessagesText = `Subject: ${subject || 'Untitled'}\nFrom: ${from || 'Unknown'}\nSnippet: ${snippet || ''}\nBody: ${bodyText || ''}`;
    if (from) participantList = [from];
  }

  // Generate Executive Summary with Gemini 3.8 Flash
  if (ai) {
    try {
      const prompt = `You are an elite Executive Chief of Staff & ADHD Cognitive Strategist.
Generate a high-impact, bulleted "Executive Summary" for this critical email thread to relieve cognitive load, prevent decision fatigue, and clarify immediate action steps for the user.

Conversation Thread Content:
${threadMessagesText.slice(0, 7000)}

Instructions:
1. "executiveSummaryBullets": Provide 4 to 6 structured bullet points. Format each bullet with an intuitive emoji and bold section title:
   - "📌 Situation & Objective": High-level context of why this thread exists and current state.
   - "⚡ Critical Deadlines & Stakes": Exact dates, time horizon, and consequences of delay.
   - "🎯 Key Action Items & Decision Points": Concrete micro-actions required from the user right now.
   - "👥 Stakeholders & Ownership": Key people involved and who owes what.
   - "💡 Strategic Bottom Line": Clear ADHD takeaway summarizing the most important point in 1 sentence.
2. "urgencyLevel": One of ["CRITICAL", "HIGH", "MODERATE"].
3. "suggestedDueDate": Concrete due date string if mentioned, or null.
4. "actionChecklist": Array of 1-3 micro-action strings that can be turned into tasks (e.g. ["Review revision v2 by 3pm", "Confirm calendar invite"]).
5. "suggestedDraftReply": A polite, ultra-crisp 2-3 sentence response the user can send right away to eliminate reply paralysis.
6. "suggestedTaskTitle": A short title for Google Tasks starting with "[Email Action]: ...".

Return valid JSON:
{
  "subject": "string",
  "urgencyLevel": "CRITICAL" | "HIGH" | "MODERATE",
  "suggestedDueDate": "string or null",
  "executiveSummaryBullets": [
    "📌 Situation: ...",
    "⚡ Critical Deadlines: ...",
    "🎯 Key Action Items: ...",
    "👥 Stakeholders: ...",
    "💡 Strategic Bottom Line: ..."
  ],
  "actionChecklist": ["string"],
  "suggestedDraftReply": "string",
  "suggestedTaskTitle": "string"
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = aiResponse.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (pErr) {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return res.json({
        success: true,
        source: 'gemini-3.8-flash',
        threadId,
        emailId,
        participants: participantList,
        summary: parsed
      });
    } catch (err: any) {
      console.warn('Gemini executive summary generation failed, using fallback:', err.message);
    }
  }

  // Fallback heuristic executive summary
  const senderClean = (from || 'Sender').split('<')[0].trim();
  const fallbackSummary = {
    subject: subject || 'Critical Email Thread',
    urgencyLevel: 'CRITICAL',
    suggestedDueDate: 'Today',
    executiveSummaryBullets: [
      `📌 Situation & Objective: Active thread with ${senderClean} regarding "${subject || 'Important Request'}".`,
      `⚡ Critical Deadlines & Stakes: Time-sensitive item requiring prompt review to prevent scheduling or workflow bottlenecks.`,
      `🎯 Key Action Items: Review current status, confirm required deliverables, and dispatch reply.`,
      `👥 Stakeholders & Ownership: ${senderClean} and associated collaborators awaiting response.`,
      `💡 Strategic Bottom Line: High-priority communication requiring executive attention before the end of the day.`
    ],
    actionChecklist: [
      `Review critical email thread: "${subject || 'Untitled'}"`,
      `Respond with status or deliverables to ${senderClean}`
    ],
    suggestedDraftReply: `Hi ${senderClean},\n\nReceived your message regarding ${subject || 'this update'}. I am reviewing the details now and will follow up shortly.\n\nBest,`,
    suggestedTaskTitle: `[Email Action]: ${subject || 'Review Critical Email'}`
  };

  res.json({
    success: true,
    source: 'heuristic',
    threadId,
    emailId,
    participants: participantList,
    summary: fallbackSummary
  });
});

app.post('/api/ai/draft-email-reply', async (req, res) => {
  const { email, tone, customInstructions } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email details required' });
  }

  if (ai) {
    try {
      const prompt = `You are an ADHD Cognitive Co-Pilot writing an email response for the user.
The user experiences task avoidance and perfectionist friction when drafting emails.
Write a clear, natural, thoughtful draft in the requested tone.

Email Subject: ${email.subject || ''}
From: ${email.from || ''}
Email Content: ${email.snippet || email.body || ''}

Requested Tone: ${tone || 'Quick & Direct'}
Special Instructions: ${customInstructions || 'None'}

Rules:
- Be concise (2 to 5 sentences max)
- Clear next step
- No awkward fluff or robotic jargon
- Leave placeholders like [Your Name] only if necessary.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      return res.json({ success: true, draft: aiResponse.text?.trim() || '' });
    } catch (err: any) {
      console.warn('Gemini draft error:', err.message);
    }
  }

  // Fallback draft template
  const senderName = (email.from || '').split('<')[0].replace(/["']/g, '').trim() || 'there';
  let draft = `Hi ${senderName},\n\nThanks for reaching out! I reviewed your message and will follow up shortly.\n\nBest regards,`;
  if (tone === 'Quick & Direct') {
    draft = `Hi ${senderName},\n\nUnderstood and confirmed. Thanks for flagging this!\n\nBest,`;
  } else if (tone === 'Polite Decline') {
    draft = `Hi ${senderName},\n\nThanks so much for thinking of me! Unfortunately my bandwidth is fully committed right now so I won't be able to take this on. Wishing you the best with it!\n\nWarmly,`;
  } else if (tone === 'Warm & Polished') {
    draft = `Hi ${senderName},\n\nHope you're having a great week! Thanks for sending this over. I've noted the details and look forward to collaborating.\n\nWarm regards,`;
  }

  res.json({ success: true, draft });
});

// Always serve index.html for root or SPA route navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI for ADHD server running at http://0.0.0.0:${PORT}`);
});
