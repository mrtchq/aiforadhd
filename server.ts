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

// Always serve index.html for root or SPA route navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI for ADHD server running at http://0.0.0.0:${PORT}`);
});
