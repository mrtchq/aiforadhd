import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";

dotenv.config();

// Usage limit configuration
const ANONYMOUS_DAILY_SECONDS = 300;

interface UsageRecord {
  usedSeconds: number;
  lastActive: number; // Unix timestamp
  resetAt: string;    // ISO timestamp
  activeSessionId?: string;
  sessionStart?: number;
}

const USAGE_FILE = path.join(process.cwd(), "usage_db.json");
let usageStore: Record<string, UsageRecord> = {};

function loadUsageStore() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      usageStore = JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8"));
      console.log(`[UsageDB] Loaded ${Object.keys(usageStore).length} usage records.`);
    }
  } catch (err) {
    console.error("[UsageDB] Failed to load usage store, starting fresh:", err);
    usageStore = {};
  }
}

function saveUsageStore() {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usageStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[UsageDB] Failed to save usage store:", err);
  }
}

// Load usage database at startup
loadUsageStore();

function getNextResetTime(): Date {
  const reset = new Date();
  reset.setHours(24, 0, 0, 0); // Next midnight local/system time
  return reset;
}

function getOrCreateVisitorId(req: any, res: any): string {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/quill_anon_id=([^;]+)/);
  let anonId = match ? match[1] : null;

  if (!anonId) {
    anonId = "anon_" + crypto.randomBytes(16).toString("hex");
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    const secureFlag = process.env.NODE_ENV === "production" ? "Secure;" : "";
    res.setHeader(
      "Set-Cookie",
      `quill_anon_id=${anonId}; Max-Age=${maxAge}; Path=/; HttpOnly; ${secureFlag} SameSite=Lax`
    );
    console.log(`[Auth] Issued new anonymous ID: ${anonId}`);
  }
  return anonId;
}

function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex");
}

function findRecordBySessionId(sessionId: string): { hashed: string; record: UsageRecord } | null {
  for (const [hashed, record] of Object.entries(usageStore)) {
    if (record.activeSessionId === sessionId) {
      return { hashed, record };
    }
  }
  return null;
}

// Lazy-initialization of Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Enable JSON request body parsing
  app.use(express.json());

  // Standard API health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Server-authoritative Quill usage and entitlement routes
  app.get("/api/quill/entitlement", (req, res) => {
    try {
      const anonId = getOrCreateVisitorId(req, res);
      const hashed = hashId(anonId);
      
      const now = new Date();
      let record = usageStore[hashed];
      const nextReset = getNextResetTime();
      
      if (!record || new Date(record.resetAt) <= now) {
        record = {
          usedSeconds: 0,
          lastActive: Date.now(),
          resetAt: nextReset.toISOString(),
        };
        usageStore[hashed] = record;
        saveUsageStore();
      }
      
      const remainingSeconds = Math.max(0, ANONYMOUS_DAILY_SECONDS - record.usedSeconds);
      
      res.json({
        allowed: remainingSeconds > 0,
        remainingSeconds,
        dailyLimitSeconds: ANONYMOUS_DAILY_SECONDS,
        usedSeconds: record.usedSeconds,
        resetAt: record.resetAt,
        accessType: "anonymous_beta",
        reason: remainingSeconds > 0 ? null : "daily_limit_exhausted"
      });
    } catch (err: any) {
      console.error("[Entitlement] Error processing entitlement:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/quill/session/start", (req, res) => {
    try {
      const anonId = getOrCreateVisitorId(req, res);
      const hashed = hashId(anonId);
      
      const now = new Date();
      let record = usageStore[hashed];
      const nextReset = getNextResetTime();
      
      if (!record || new Date(record.resetAt) <= now) {
        record = {
          usedSeconds: 0,
          lastActive: Date.now(),
          resetAt: nextReset.toISOString(),
        };
        usageStore[hashed] = record;
      }
      
      const remainingSeconds = Math.max(0, ANONYMOUS_DAILY_SECONDS - record.usedSeconds);
      if (remainingSeconds <= 0) {
        return res.status(403).json({ error: "Daily allowance exhausted", resetAt: record.resetAt });
      }
      
      // Check for an active session. Expire stale sessions (no heartbeat for > 30 seconds)
      const heartbeatTimeout = 30000;
      if (record.activeSessionId && record.lastActive && (Date.now() - record.lastActive < heartbeatTimeout)) {
        return res.status(409).json({ error: "Duplicate active session detected in another tab." });
      }
      
      const sessionId = "sess_" + crypto.randomBytes(12).toString("hex");
      record.activeSessionId = sessionId;
      record.sessionStart = Date.now();
      record.lastActive = Date.now();
      usageStore[hashed] = record;
      saveUsageStore();
      
      res.json({
        sessionId,
        remainingSeconds,
        resetAt: record.resetAt
      });
    } catch (err: any) {
      console.error("[SessionStart] Error starting session:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/quill/session/heartbeat", (req, res) => {
    try {
      const anonId = getOrCreateVisitorId(req, res);
      const hashed = hashId(anonId);
      const { sessionId } = req.body;
      
      let record = usageStore[hashed];
      if (!record || record.activeSessionId !== sessionId) {
        return res.status(400).json({ error: "Invalid or inactive session." });
      }
      
      const now = Date.now();
      const elapsedMs = now - (record.lastActive || now);
      const elapsedSeconds = Math.round(elapsedMs / 1000);
      
      if (elapsedSeconds > 0) {
        record.usedSeconds = Math.min(ANONYMOUS_DAILY_SECONDS, record.usedSeconds + elapsedSeconds);
      }
      record.lastActive = now;
      usageStore[hashed] = record;
      saveUsageStore();
      
      const remainingSeconds = Math.max(0, ANONYMOUS_DAILY_SECONDS - record.usedSeconds);
      
      res.json({
        remainingSeconds,
        usedSeconds: record.usedSeconds,
        resetAt: record.resetAt,
        sessionActive: remainingSeconds > 0
      });
    } catch (err: any) {
      console.error("[Heartbeat] Error processing heartbeat:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/quill/session/end", (req, res) => {
    try {
      const anonId = getOrCreateVisitorId(req, res);
      const hashed = hashId(anonId);
      const { sessionId } = req.body;
      
      let record = usageStore[hashed];
      if (record && record.activeSessionId === sessionId) {
        const now = Date.now();
        const elapsedMs = now - (record.lastActive || now);
        const elapsedSeconds = Math.round(elapsedMs / 1000);
        
        if (elapsedSeconds > 0) {
          record.usedSeconds = Math.min(ANONYMOUS_DAILY_SECONDS, record.usedSeconds + elapsedSeconds);
        }
        record.activeSessionId = undefined;
        record.sessionStart = undefined;
        record.lastActive = Date.now();
        usageStore[hashed] = record;
        saveUsageStore();
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("[SessionEnd] Error ending session:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/quill/feedback", (req, res) => {
    try {
      const { rating, feedbackText, sessionId } = req.body;
      const FEEDBACK_FILE = path.join(process.cwd(), "feedback_db.json");
      
      let feedbackList = [];
      if (fs.existsSync(FEEDBACK_FILE)) {
        try {
          feedbackList = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf-8"));
        } catch (e) {
          feedbackList = [];
        }
      }
      
      const entry = {
        id: "feed_" + crypto.randomBytes(8).toString("hex"),
        rating,
        feedbackText,
        sessionId,
        timestamp: new Date().toISOString()
      };
      
      feedbackList.push(entry);
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackList, null, 2), "utf-8");
      console.log(`[Feedback] Saved feedback:`, entry);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Feedback] Error saving feedback:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Google Workspace API connectivity is tested and initiated directly on the client side using Firebase Auth.

  // Handle WebSocket upgrades for speech call
  server.on("upgrade", (request, socket, head) => {
    const rawUrl = request.url || "";
    const pathname = rawUrl.split("?")[0];
    console.log(`[Upgrade] Upgrade request received. Pathname: "${pathname}", Full URL: "${rawUrl}"`);
    
    if (pathname === "/api/live-ws") {
      console.log("[Upgrade] Matching /api/live-ws. Upgrading socket connection...");
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log("[Upgrade] Socket upgraded successfully. Emitting connection event.");
        wss.emit("connection", ws, request);
      });
    } else {
      // Allow other middlewares or handlers (like Vite dev server HMR) to upgrade their own connections.
      // Do not destroy the socket here.
      console.log(`[Upgrade] Non-matching path "${pathname}". Skipping upgrade to let other services handle it.`);
    }
  });

  // Helper handlers for Google Workspace API calls

  async function handleGetWorkspaceOverview(googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    
    // 1. Get task list or find "Quill ADHD" list
    let listId = "@default";
    try {
      const listsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (listsRes.ok) {
        const listsData = await listsRes.json();
        const quillList = listsData.items?.find((l: any) => l.title === "Quill ADHD");
        if (quillList) {
          listId = quillList.id;
        } else {
          // Create "Quill ADHD" list
          const createListRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ title: "Quill ADHD" })
          });
          if (createListRes.ok) {
            const newList = await createListRes.json();
            listId = newList.id;
          }
        }
      }
    } catch (err) {
      console.error("[Workspace] Failed to find or create Quill ADHD task list, falling back to @default:", err);
    }

    // 2. Fetch tasks from our list
    let tasks: any[] = [];
    try {
      const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=false`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        tasks = (tasksData.items || []).map((t: any) => ({
          id: t.id,
          content: t.title,
          description: t.notes || "",
          project_id: listId,
          parent_id: t.parent || null
        }));
      }
    } catch (err) {
      console.error("[Workspace] Failed to fetch Google tasks:", err);
    }

    // 3. Fetch upcoming Google Calendar events
    let events: any[] = [];
    try {
      const nowISO = new Date().toISOString();
      const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${nowISO}&maxResults=10&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (calRes.ok) {
        const calData = await calRes.json();
        events = (calData.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary,
          description: e.description || "",
          startTime: e.start?.dateTime || e.start?.date,
          endTime: e.end?.dateTime || e.end?.date,
          location: e.location || ""
        }));
      }
    } catch (err) {
      console.error("[Workspace] Failed to fetch Google Calendar events:", err);
    }

    return { tasks, events, listId };
  }

  async function handleAddGoogleTasks(args: any, googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const tasksToAdd = args.tasks;
    if (!Array.isArray(tasksToAdd)) {
      throw new Error("Invalid arguments: 'tasks' must be an array.");
    }

    // Get "Quill ADHD" task list id
    let listId = "@default";
    try {
      const listsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (listsRes.ok) {
        const listsData = await listsRes.json();
        const quillList = listsData.items?.find((l: any) => l.title === "Quill ADHD");
        if (quillList) listId = quillList.id;
      }
    } catch (e) {}

    const createdTasks = [];
    const errors = [];

    for (const task of tasksToAdd) {
      const bodyPayload: any = {
        title: task.content,
      };
      if (task.description) bodyPayload.notes = task.description;
      if (task.due) bodyPayload.due = task.due;
      if (task.parent_id) bodyPayload.parent = task.parent_id;

      console.log("[Workspace] Creating Google task:", bodyPayload);

      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const errMsg = `Failed to add Google task "${task.content}": ${response.statusText} (Status ${response.status})${errorText ? ' - ' + errorText : ''}`;
        console.error(errMsg);
        errors.push(errMsg);
        continue;
      }

      const data = await response.json();
      createdTasks.push({
        id: data.id,
        content: data.title,
        description: data.notes || "",
        parent_id: data.parent || null
      });
    }

    if (createdTasks.length === 0 && errors.length > 0) {
      return { success: false, error: errors.join("; "), created_count: 0, tasks: [] };
    }

    return {
      success: true,
      created_count: createdTasks.length,
      tasks: createdTasks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async function handleCreateCalendarEvent(args: any, googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const { summary, description, startTime, endTime } = args;
    if (!summary) throw new Error("Missing 'summary' parameter.");
    if (!startTime) throw new Error("Missing 'startTime' parameter.");
    if (!endTime) throw new Error("Missing 'endTime' parameter.");

    const bodyPayload = {
      summary,
      description: description || "",
      start: { dateTime: startTime },
      end: { dateTime: endTime }
    };

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Failed to create calendar event: ${response.statusText} (${response.status})${errorText ? ' - ' + errorText : ''}`);
    }

    const data = await response.json();
    return {
      success: true,
      id: data.id,
      summary: data.summary,
      startTime: data.start?.dateTime,
      endTime: data.end?.dateTime,
      htmlLink: data.htmlLink
    };
  }

  async function handleWriteGoogleDoc(args: any, googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const { title, text, documentId } = args;
    if (!text) throw new Error("Missing 'text' parameter.");

    let docId = documentId;
    let actualTitle = title || "Quill ADHD Brainstorm";

    if (!docId) {
      // Create document
      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: actualTitle })
      });
      if (!createRes.ok) {
        const errorText = await createRes.text().catch(() => "");
        throw new Error(`Failed to create Google Doc: ${createRes.statusText} (${createRes.status})${errorText ? ' - ' + errorText : ''}`);
      }
      const newDoc = await createRes.json();
      docId = newDoc.documentId;
    }

    // Append text to document
    const appendBody = {
      requests: [
        {
          insertText: {
            text: text + "\n",
            endOfSegmentLocation: {}
          }
        }
      ]
    };

    const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(appendBody)
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text().catch(() => "");
      throw new Error(`Failed to write text to Google Doc: ${updateRes.statusText} (${updateRes.status})${errorText ? ' - ' + errorText : ''}`);
    }

    return {
      success: true,
      documentId: docId,
      title: actualTitle,
      appendedLength: text.length
    };
  }

  async function handleCreateGmailDraft(args: any, googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const { to, subject, body } = args;
    if (!to) throw new Error("Missing 'to' parameter.");
    if (!subject) throw new Error("Missing 'subject' parameter.");
    if (!body) throw new Error("Missing 'body' parameter.");

    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body
    ];
    const email = emailLines.join('\r\n');
    const base64Safe = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          raw: base64Safe
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Failed to create Gmail draft: ${response.statusText} (${response.status})${errorText ? ' - ' + errorText : ''}`);
    }

    const data = await response.json();
    return {
      success: true,
      id: data.id,
      messageId: data.message?.id
    };
  }

  async function handleManageKeepNotes(args: any, googleAccessToken: string | null) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const { action, notes } = args;
    if (!action) throw new Error("Missing 'action' parameter.");

    // Search for quill_keep_notes.json
    let fileId: string | null = null;
    try {
      const query = encodeURIComponent("name='quill_keep_notes.json' and trashed=false");
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          fileId = searchData.files[0].id;
        }
      }
    } catch (err) {
      console.error("[Drive] Failed to search for notes file:", err);
    }

    if (action === "get") {
      if (fileId) {
        // Fetch file contents
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${cleanToken}` }
        });
        if (contentRes.ok) {
          try {
            const data = await contentRes.json();
            return { success: true, notes: Array.isArray(data) ? data : [] };
          } catch (e) {
            return { success: true, notes: [] };
          }
        }
      }
      return { success: true, notes: [] };
    } else if (action === "save") {
      if (!notes || !Array.isArray(notes)) {
        throw new Error("Missing or invalid 'notes' parameter for action 'save'.");
      }

      if (!fileId) {
        // Create file
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "quill_keep_notes.json",
            mimeType: "application/json"
          })
        });
        if (createRes.ok) {
          const fileData = await createRes.json();
          fileId = fileData.id;
        } else {
          const errorText = await createRes.text().catch(() => "");
          throw new Error(`Failed to create Keep notes file on Google Drive: ${createRes.statusText} (${createRes.status}) - ${errorText}`);
        }
      }

      // Upload content
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(notes)
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => "");
        throw new Error(`Failed to write note data to Google Drive: ${uploadRes.statusText} (${uploadRes.status}) - ${errorText}`);
      }

      return { success: true, count: notes.length };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  async function handleAddGoogleReminders(args: any, googleAccessToken: string | null, locations: any[]) {
    if (!googleAccessToken) {
      throw new Error("Google access token is missing. Please sign in with Google.");
    }
    const cleanToken = googleAccessToken.trim();
    const { task_text, location, trigger = "on_enter" } = args;
    if (!task_text) throw new Error("Missing 'task_text' parameter.");
    if (!location) throw new Error("Missing 'location' parameter.");

    const locNameNormalized = location.toLowerCase();
    const matchedLocation = locations.find((l: any) => l.name.toLowerCase() === locNameNormalized);

    let lat = 37.7749;
    let lng = -122.4194;
    let radius = 100;
    let resolvedName = location;
    let isResolved = false;

    if (matchedLocation) {
      lat = matchedLocation.lat;
      lng = matchedLocation.lng;
      radius = matchedLocation.radius || 100;
      resolvedName = matchedLocation.name;
      isResolved = true;
    }

    const description = `📍 Geofence Reminder: Trigger ${trigger} at ${resolvedName} (${lat}, ${lng}) with radius ${radius}m.`;
    
    // Create as a task in Google Tasks under "Quill ADHD"
    const addArgs = {
      tasks: [{
        content: task_text,
        description
      }]
    };
    
    const taskRes = await handleAddGoogleTasks(addArgs, cleanToken);
    
    return {
      success: true,
      task: taskRes.tasks?.[0] || { content: task_text, description },
      geofence: {
        location: resolvedName,
        lat,
        lng,
        radius,
        trigger,
        is_resolved: isResolved
      }
    };
  }

  // WebSocket connection handler for Gemini 3.1 Live Speech API
  wss.on("connection", async (clientWs: WebSocket, request: any) => {
    console.log("[LiveSpeech] New client connected to speech socket");

    let session: any = null;
    let maxDurationTimer: NodeJS.Timeout | null = null;
    let sessionId: string | null = null;

    try {
      // Parse the connection URL query parameters to retrieve user credentials and config safely inside try-catch
      const parsedUrl = new URL(request.url || "", "http://localhost");
      
      sessionId = parsedUrl.searchParams.get("sessionId");
      if (!sessionId) {
        throw new Error("Missing sessionId parameter for voice call authorization.");
      }
      const sessionData = findRecordBySessionId(sessionId);
      if (!sessionData) {
        throw new Error("Invalid or inactive voice call session.");
      }
      const { hashed, record } = sessionData;
      const remainingSeconds = Math.max(0, ANONYMOUS_DAILY_SECONDS - record.usedSeconds);
      if (remainingSeconds <= 0) {
        throw new Error("Your daily allowance has been fully used.");
      }

      console.log(`[LiveSpeech] Session ${sessionId} authorized. Remaining time: ${remainingSeconds}s`);

      // Set a maximum duration timer for the call to enforce the strict 5-minute quota
      maxDurationTimer = setTimeout(() => {
        console.log(`[LiveSpeech] Daily limit reached for session ${sessionId}. Closing socket.`);
        try {
          clientWs.send(JSON.stringify({ error: "Daily limit reached. Call ended." }));
          clientWs.close();
        } catch (err) {}
      }, remainingSeconds * 1000);

      const googleAccessToken = parsedUrl.searchParams.get("google_access_token");
      const rawLocations = parsedUrl.searchParams.get("locations");
      
      let locations = [];
      if (rawLocations) {
        try {
          locations = JSON.parse(decodeURIComponent(rawLocations));
        } catch (parseErr) {
          console.warn("[LiveSpeech] Failed to parse locations parameter, defaulting to empty list:", parseErr);
        }
      }

      console.log(`[LiveSpeech] Client loaded credentials: ${googleAccessToken ? "Google Workspace connected (token present)" : "Google Workspace NOT connected"}. Location count: ${locations.length}`);

      const ai = getGeminiClient();

      // Establish real-time connection to Gemini 3.1 Flash Live
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [
            {
              functionDeclarations: [
                {
                  name: "add_reminders",
                  description: "Create a geofenced reminder for a task at a specific location (e.g. office, home). This resolves the location to coordinates, radius, and trigger, and saves the task in Google Tasks.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      task_text: { type: Type.STRING, description: "The content/text of the task to remind about" },
                      location: { type: Type.STRING, description: "The name of the location (e.g. 'office', 'home', 'grocery')" },
                      trigger: { type: Type.STRING, description: "Trigger action, either 'on_enter' or 'on_leave'", enum: ["on_enter", "on_leave"] }
                    },
                    required: ["task_text", "location"]
                  }
                },
                {
                  name: "get_workspace_overview",
                  description: "Queries active Google Tasks (from the 'Quill ADHD' task list) and Google Calendar events (for today) to give the user a clear picture of their active focus items.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "add_google_tasks",
                  description: "Batch create one or more tasks or sub-tasks in Google Tasks under the 'Quill ADHD' list. Great for brain dumps, breaking down goals, or planning schedules.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      tasks: {
                        type: Type.ARRAY,
                        description: "List of tasks to create",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            content: { type: Type.STRING, description: "The task title/content" },
                            description: { type: Type.STRING, description: "Optional notes/details for the task" },
                            due: { type: Type.STRING, description: "Optional due date in ISO format, e.g., '2026-07-12T00:00:00.000Z'" },
                            parent_id: { type: Type.STRING, description: "Optional parent task ID to nest this task under" }
                          },
                          required: ["content"]
                        }
                      }
                    },
                    required: ["tasks"]
                  }
                },
                {
                  name: "create_calendar_event",
                  description: "Creates a calendar event on the user's Google Calendar. Perfect for helping them block out time for a specific task immediately to defeat procrastination.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      summary: { type: Type.STRING, description: "The event title" },
                      description: { type: Type.STRING, description: "Optional details/description of the event" },
                      startTime: { type: Type.STRING, description: "ISO 8601 date-time string, e.g., '2026-07-12T10:00:00Z'" },
                      endTime: { type: Type.STRING, description: "ISO 8601 date-time string, e.g., '2026-07-12T11:00:00Z'" }
                    },
                    required: ["summary", "startTime", "endTime"]
                  }
                },
                {
                  name: "write_google_doc",
                  description: "Creates a new Google Doc or appends text to an existing Google Doc. Excellent for brainstorming, outlining projects, or compiling thoughts from the verbal call.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Optional title when creating a new document (e.g. 'Project Outline')" },
                      text: { type: Type.STRING, description: "The text content to append or write to the document" },
                      documentId: { type: Type.STRING, description: "Optional document ID to append to if a document is already active" }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "create_gmail_draft",
                  description: "Creates an email draft in Gmail to help the user follow up or send a message. Extremely ADHD-friendly for starting emails they've been procrastinating on.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      to: { type: Type.STRING, description: "Recipient email address" },
                      subject: { type: Type.STRING, description: "The subject line of the email" },
                      body: { type: Type.STRING, description: "The body content of the email draft" }
                    },
                    required: ["to", "subject", "body"]
                  }
                },
                {
                  name: "manage_keep_notes",
                  description: "Manages the user's ADHD Keep Note-Cards (which are synced to Google Drive). Retrieve existing note cards, or save the entire board after updating tags, pins, or contents.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING, description: "The action to perform: 'get' to retrieve notes, 'save' to overwrite notes with updated data", enum: ["get", "save"] },
                      notes: {
                        type: Type.ARRAY,
                        description: "The list of notes to save (required for action='save')",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING, description: "Unique note identifier" },
                            title: { type: Type.STRING, description: "Note title" },
                            content: { type: Type.STRING, description: "Note text content" },
                            color: { type: Type.STRING, description: "Color class/tag for the card (e.g. 'slate', 'blue', 'amber', 'rose')" },
                            isPinned: { type: Type.BOOLEAN, description: "Whether this note card is pinned to the top" }
                          },
                          required: ["id", "title", "content"]
                        }
                      }
                    },
                    required: ["action"]
                  }
                }
              ]
            }
          ],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }, // Empathetic, welcoming tone
          },
          systemInstruction: `You are Quill, an extremely warm, empathetic, and friendly ADHD coaching assistant. Speak directly and concisely because ADHD brains appreciate brevity, clear structure, and direct answers.

Help the user clear their mental clutter, break down massive overwhelming tasks into simple immediate micro-steps, schedule calendar blocks, and save note-cards. Be incredibly encouraging, shame-free, and practical. Always ask one simple question at a time to keep the user from getting overwhelmed. Always be supportive of starting over. Your core motto is: "Your brain is not broken. The system just needs to be built differently."

You have access to 7 powerful tools linked to the user's real Google Workspace. You must use them proactively to execute user requests live as they speak!

STRICT ACTION GUIDELINES FOR YOUR CORE VOICE SKILLS:

1. Skill 1: Context-Aware Verbal Reminder & Location Geofencer
   - Trigger: When the user says things like: "Remind me to grab the files when I arrive at the office" or "Remind me to do X at Y".
   - Action: Proactively call the 'add_reminders' tool. It will resolve the location, set the coordinate, radius, and trigger, and save the task in Google Tasks!
   - Verbal feedback: Confirm to the user which location and trigger you are setting, like: "Perfect, I've created that geofenced reminder! When you arrive at the office, I'll make sure you're prompted to grab those files."

2. Skill 2: "Stupid Small" Task Demolisher (Micro-Goal Builder)
   - Trigger: When the user expresses overwhelm about a project or a big task (e.g. "I have this huge paper to write and I can't start").
   - Action:
     - First, call 'get_workspace_overview' to fetch their active focus tasks and calendar.
     - Once you get the response, use your intelligence to break the project down into a nested sub-task hierarchy of "stupid small" steps (taking less than 5 minutes, e.g. "Open Google Docs", "Write title").
     - Call 'add_google_tasks' with these sub-tasks to save them under 'Quill ADHD'.
     - Guide the user: present these steps one by one, walking them through the first immediate micro-goal.

3. Skill 3: Guided "Brain Dump" Inbox Sweeper & Google Docs Brainstormer
   - Trigger: When the user says: "I need to brain dump" or "My head is full".
   - Action:
     - Invite them to list-speak their scattered thoughts. Listen supportively.
     - Once they list-speak, extract individual tasks and call 'add_google_tasks' to save them in their Google Tasks list.
     - If they are brainstorming ideas (e.g. planning a party or a product), call 'write_google_doc' to save these ideas in a beautifully titled Google Document so they don't lose them!
     - If they have writer's block on an email, call 'create_gmail_draft' to write it for them in Gmail!
     - If they need to schedule a dedicated focus session, call 'create_calendar_event' to lock it in immediately.

4. Skill 4: Interactive Notes Board (Google Keep-style cards)
   - Trigger: When the user says "Save a note card", "Let me see my notes", or wants to update notes.
   - Action: Call 'manage_keep_notes' with 'get' or 'save' to view, create, or update note cards backed up to Google Drive.

Keep your tone deeply compassionate, brief, and supportive. Always take direct action with these tools when requested!`,
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  // Forward base64 PCM audio chunk from Gemini back to the client
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // Check for tool calls (toolCall is at the root of LiveServerMessage)
            if (message.toolCall?.functionCalls) {
              for (const call of message.toolCall.functionCalls) {
                const { name, args, id } = call;
                console.log(`[LiveSpeech] Received tool call from model: ${name}`, args);

                let result = {};
                try {
                  if (name === "get_workspace_overview") {
                    result = await handleGetWorkspaceOverview(googleAccessToken);
                  } else if (name === "add_google_tasks") {
                    result = await handleAddGoogleTasks(args, googleAccessToken);
                  } else if (name === "create_calendar_event") {
                    result = await handleCreateCalendarEvent(args, googleAccessToken);
                  } else if (name === "write_google_doc") {
                    result = await handleWriteGoogleDoc(args, googleAccessToken);
                  } else if (name === "create_gmail_draft") {
                    result = await handleCreateGmailDraft(args, googleAccessToken);
                  } else if (name === "manage_keep_notes") {
                    result = await handleManageKeepNotes(args, googleAccessToken);
                  } else if (name === "add_reminders") {
                    result = await handleAddGoogleReminders(args, googleAccessToken, locations);
                  } else {
                    result = { error: "Unsupported tool call" };
                  }

                  // Inform client side about successful execution to update UI in real-time
                  clientWs.send(JSON.stringify({
                    toolExecuted: name,
                    args,
                    result
                  }));

                } catch (toolErr: any) {
                  console.error(`[LiveSpeech] Error executing tool ${name}:`, toolErr);
                  result = { error: toolErr.message || "Failed to execute tool" };
                }

                if (session) {
                  session.sendToolResponse({
                    functionResponses: [{
                      name,
                      response: { output: result },
                      id
                    }]
                  });
                  console.log(`[LiveSpeech] Sent response back for tool call ${name}`);
                }
              }
            }
          },
        },
      });

      console.log("[LiveSpeech] Successfully connected to Gemini Live session");

      clientWs.on("message", (rawData) => {
        try {
          const parsed = JSON.parse(rawData.toString());
          if (parsed.type === "ping" || parsed.ping) {
            clientWs.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (parsed.audio && session) {
            // Forward raw audio from user microphone to Gemini Live API
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (err) {
          console.error("[LiveSpeech] Error processing client audio payload:", err);
        }
      });

    } catch (err: any) {
      console.error("[LiveSpeech] Failed to initialize Gemini session:", err);
      try {
        clientWs.send(JSON.stringify({ error: err.message || "Failed to establish AI speech session." }));
      } catch (sendErr) {
        console.error("[LiveSpeech] Could not send initialization error to client:", sendErr);
      }
      setTimeout(() => {
        try {
          clientWs.close();
        } catch (closeErr) {}
      }, 500);
      return;
    }

    clientWs.on("close", () => {
      console.log("[LiveSpeech] Client connection closed. Cleaning up Gemini session.");
      
      if (maxDurationTimer) {
        clearTimeout(maxDurationTimer);
      }

      if (sessionId) {
        const latestSessionData = findRecordBySessionId(sessionId);
        if (latestSessionData) {
          const { hashed: h, record: r } = latestSessionData;
          const now = Date.now();
          const elapsedMs = now - (r.lastActive || now);
          const elapsedSeconds = Math.round(elapsedMs / 1000);
          if (elapsedSeconds > 0) {
            r.usedSeconds = Math.min(ANONYMOUS_DAILY_SECONDS, r.usedSeconds + elapsedSeconds);
          }
          r.activeSessionId = undefined;
          r.sessionStart = undefined;
          r.lastActive = now;
          usageStore[h] = r;
          saveUsageStore();
          console.log(`[LiveSpeech] Connection closed. Session: ${sessionId}, elapsed: ${elapsedSeconds}s, total used: ${r.usedSeconds}s`);
        }
      }

      if (session) {
        try {
          session.close();
        } catch (e) {
          // already closed
        }
      }
    });

    clientWs.on("error", (err) => {
      console.error("[LiveSpeech] WebSocket connection error:", err);
      if (session) {
        try {
          session.close();
        } catch (e) {
          // already closed
        }
      }
    });
  });

  // Vite Integration for development vs production serving
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Mounting Vite Middleware (Development)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving Static Dist Files (Production)");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
});
