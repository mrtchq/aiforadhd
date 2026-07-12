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

  // Secure Todoist OAuth 2.0 Code Exchange Proxy
  app.post("/api/todoist/exchange", async (req, res) => {
    try {
      const { code, client_id, client_secret, redirect_uri } = req.body;
      
      if (!code || !client_id || !client_secret || !redirect_uri) {
        return res.status(400).json({ error: "Missing required parameters (code, client_id, client_secret, or redirect_uri)" });
      }

      console.log(`[OAuthProxy] Exchanging code for token using Client ID: ${client_id}`);

      const response = await fetch("https://todoist.com/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id,
          client_secret,
          code,
          redirect_uri
        }).toString()
      });

      const data: any = await response.json();
      
      if (!response.ok) {
        console.error("[OAuthProxy] Exchange failed from Todoist:", data);
        return res.status(response.status).json({ error: data.error || "Failed to exchange code" });
      }

      console.log("[OAuthProxy] Access token retrieved successfully!");
      return res.json(data);

    } catch (err: any) {
      console.error("[OAuthProxy] Error in proxy endpoint:", err);
      return res.status(500).json({ error: err.message || "Internal server error during exchange" });
    }
  });

  // Secure Todoist Connection Verification Test Endpoint
  app.post("/api/todoist/test", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Missing Todoist API token to test" });
      }
      
      console.log("[TodoistTest] Verifying connectivity for token...");
      const response = await fetch("https://api.todoist.com/api/v1/projects", {
        headers: { Authorization: `Bearer ${token.trim()}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[TodoistTest] Token verification failed: ${response.statusText} (Status ${response.status})`);
        return res.json({ 
          success: false, 
          error: `${response.statusText} (${response.status})${errorText ? ': ' + errorText : ''}` 
        });
      }
      
      const rawText = await response.text().catch(() => "");
      let projects;
      try {
        projects = JSON.parse(rawText);
      } catch (e: any) {
        throw new Error(`Invalid response: Failed to parse JSON from Todoist. Raw: ${rawText.substring(0, 500)}`);
      }
      
      if (!Array.isArray(projects)) {
        throw new Error(`Invalid response: Expected an array of projects from Todoist. Got type: ${typeof projects}, Raw response: ${rawText.substring(0, 500)}`);
      }
      console.log(`[TodoistTest] Verification successful. Retrieved ${projects.length} projects.`);
      return res.json({ success: true, projects_count: projects.length });
    } catch (err: any) {
      console.error("[TodoistTest] Error validating token:", err);
      return res.json({ success: false, error: err.message || "Connection failed unexpectedly" });
    }
  });

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

  // Helper handlers for Todoist API calls

  async function handleGetOverview(token: string | null) {
    if (!token) {
      throw new Error("Todoist API token is missing. Please connect your Todoist account.");
    }
    const cleanToken = token.trim();
    
    const projectsRes = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (!projectsRes.ok) {
      const errorText = await projectsRes.text().catch(() => "");
      throw new Error(`Todoist projects fetch failed: ${projectsRes.statusText} (${projectsRes.status})${errorText ? ' - ' + errorText : ''}`);
    }
    const rawProjects = await projectsRes.text().catch(() => "");
    let projects;
    try {
      projects = JSON.parse(rawProjects);
    } catch (e: any) {
      throw new Error(`Todoist projects JSON parse failed. Raw: ${rawProjects.substring(0, 500)}`);
    }
    if (!Array.isArray(projects)) {
      throw new Error(`Invalid response: Expected projects array, got: ${rawProjects.substring(0, 500)}`);
    }
    
    const tasksRes = await fetch("https://api.todoist.com/api/v1/tasks", {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (!tasksRes.ok) {
      const errorText = await tasksRes.text().catch(() => "");
      throw new Error(`Todoist tasks fetch failed: ${tasksRes.statusText} (${tasksRes.status})${errorText ? ' - ' + errorText : ''}`);
    }
    const tasks = await tasksRes.json();
    if (!Array.isArray(tasks)) {
      throw new Error(`Invalid response: Expected tasks array, got: ${JSON.stringify(tasks)}`);
    }
    
    return {
      projects: projects.map((p: any) => ({ id: p.id, name: p.name })),
      tasks: tasks.map((t: any) => ({
        id: t.id,
        content: t.content,
        description: t.description,
        project_id: t.project_id,
        parent_id: t.parent_id,
        priority: t.priority
      }))
    };
  }

  async function handleAddTasks(args: any, token: string | null) {
    if (!token) {
      throw new Error("Todoist API token is missing. Please connect your Todoist account.");
    }
    const cleanToken = token.trim();
    const tasksToAdd = args.tasks;
    if (!Array.isArray(tasksToAdd)) {
      throw new Error("Invalid arguments: 'tasks' must be an array.");
    }
    
    const createdTasks = [];
    const errors = [];
    for (const task of tasksToAdd) {
      // Defensive ID check: Todoist IDs are strictly numeric strings.
      // Omit placeholder or non-numeric values (like "Inbox", "null", "undefined", or empty string)
      let projectId = undefined;
      if (task.project_id && typeof task.project_id === "string" && /^\d+$/.test(task.project_id)) {
        projectId = task.project_id;
      }
      
      let parentId = undefined;
      if (task.parent_id && typeof task.parent_id === "string" && /^\d+$/.test(task.parent_id)) {
        parentId = task.parent_id;
      }

      const bodyPayload: any = {
        content: task.content,
      };
      if (projectId) bodyPayload.project_id = projectId;
      if (parentId) bodyPayload.parent_id = parentId;
      if (task.description) bodyPayload.description = task.description;
      if (task.priority && typeof task.priority === "number" && task.priority >= 1 && task.priority <= 4) {
        bodyPayload.priority = task.priority;
      }

      console.log("[LiveSpeech] Creating task in Todoist:", bodyPayload);

      const response = await fetch("https://api.todoist.com/api/v1/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const errMsg = `Failed to add task "${task.content}": ${response.statusText} (Status ${response.status})${errorText ? ' - ' + errorText : ''}`;
        console.error(errMsg);
        errors.push(errMsg);
        continue;
      }
      
      const data = await response.json();
      createdTasks.push({
        id: data.id,
        content: data.content,
        project_id: data.project_id,
        parent_id: data.parent_id,
        priority: data.priority
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

  async function handleFindProjects(args: any, token: string | null) {
    if (!token) {
      throw new Error("Todoist API token is missing. Please connect your Todoist account.");
    }
    const cleanToken = token.trim();
    const query = (args.query || "").toLowerCase();
    
    const response = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Todoist projects fetch failed: ${response.statusText} (${response.status})${errorText ? ' - ' + errorText : ''}`);
    }
    const projects = await response.json();
    if (!Array.isArray(projects)) {
      throw new Error(`Invalid response: Expected projects array, got: ${JSON.stringify(projects)}`);
    }
    
    const matches = projects
      .filter((p: any) => p.name && p.name.toLowerCase().includes(query))
      .map((p: any) => ({ id: p.id, name: p.name }));
      
    return { matches };
  }

  async function handleReorderObjects(args: any, token: string | null) {
    if (!token) {
      throw new Error("Todoist API token is missing. Please connect your Todoist account.");
    }
    const cleanToken = token.trim();
    const { task_id, project_id, parent_id } = args;
    if (!task_id) throw new Error("Missing 'task_id' parameter.");
    
    const body: any = {};
    if (project_id && typeof project_id === "string" && /^\d+$/.test(project_id)) {
      body.project_id = project_id;
    }
    if (parent_id && typeof parent_id === "string" && /^\d+$/.test(parent_id)) {
      body.parent_id = parent_id;
    }
    
    const response = await fetch(`https://api.todoist.com/api/v1/tasks/${task_id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Failed to move/reorder task: ${response.statusText} (${response.status})${errorText ? ' - ' + errorText : ''}`);
    }
    
    const data = await response.json();
    return { success: true, task_id: data.id, project_id: data.project_id, parent_id: data.parent_id };
  }

  async function handleAddReminders(args: any, token: string | null, locations: any[]) {
    if (!token) {
      throw new Error("Todoist API token is missing. Please connect your Todoist account.");
    }
    const cleanToken = token.trim();
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
    const taskResponse = await fetch("https://api.todoist.com/api/v1/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: task_text,
        description,
        labels: ["Geofence", resolvedName.replace(/\s+/g, "_")]
      })
    });
    
    if (!taskResponse.ok) {
      const errorText = await taskResponse.text().catch(() => "");
      throw new Error(`Failed to create task in Todoist: ${taskResponse.statusText} (${taskResponse.status})${errorText ? ' - ' + errorText : ''}`);
    }
    
    const createdTask = await taskResponse.json();
    
    return {
      success: true,
      task: {
        id: createdTask.id,
        content: createdTask.content,
        description: createdTask.description
      },
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

      const todoistToken = parsedUrl.searchParams.get("todoist_token");
      const rawLocations = parsedUrl.searchParams.get("locations");
      
      let locations = [];
      if (rawLocations) {
        try {
          locations = JSON.parse(decodeURIComponent(rawLocations));
        } catch (parseErr) {
          console.warn("[LiveSpeech] Failed to parse locations parameter, defaulting to empty list:", parseErr);
        }
      }

      console.log(`[LiveSpeech] Client loaded credentials: ${todoistToken ? "Todoist connected (token present)" : "Todoist NOT connected"}. Location count: ${locations.length}`);

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
                  description: "Create a geofenced reminder for a task at a specific location (e.g. office, home). This resolves the location to coordinates, radius, and trigger.",
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
                  name: "get_overview",
                  description: "Queries the complete project and task structure from the user's Todoist account to get an overview of active projects, sections, and tasks.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {}
                  }
                },
                {
                  name: "add_tasks",
                  description: "Batch create one or more tasks or sub-tasks in Todoist. Perfect for 'Brain Dump' list-speaking or adding a structured breakdown of a project.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      tasks: {
                        type: Type.ARRAY,
                        description: "List of tasks to create",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            content: { type: Type.STRING, description: "The task content" },
                            parent_id: { type: Type.STRING, description: "Optional parent task ID to nest this task under" },
                            project_id: { type: Type.STRING, description: "Optional project ID to create this task in" },
                            description: { type: Type.STRING, description: "Optional task description" },
                            priority: { type: Type.INTEGER, description: "Priority level 1-4 (1 is normal, 4 is urgent)" }
                          },
                          required: ["content"]
                        }
                      }
                    },
                    required: ["tasks"]
                  }
                },
                {
                  name: "find_projects",
                  description: "Searches for projects in the user's Todoist account that match a search string.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "The name or search term of the project to find" }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "reorder_objects",
                  description: "Moves a task to a different project or parent task in Todoist. Useful for organizing tasks during brain dump sweeps.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      task_id: { type: Type.STRING, description: "The unique ID of the task to move" },
                      project_id: { type: Type.STRING, description: "The target project ID to move the task into" },
                      parent_id: { type: Type.STRING, description: "Optional target parent task ID to nest the task under" }
                    },
                    required: ["task_id", "project_id"]
                  }
                }
              ]
            }
          ],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }, // Empathetic, welcoming tone
          },
          systemInstruction: `You are Quill, an extremely warm, empathetic, and friendly ADHD coaching assistant. Speak directly and concisely because ADHD brains appreciate brevity, clear structure, and direct answers.

Help the user clear their mental clutter, break down massive overwhelming tasks into simple immediate micro-steps, and schedule location-based reminders. Be incredibly encouraging, shame-free, and practical. Always ask one simple question at a time to keep the user from getting overwhelmed. Always be supportive of starting over. Your core motto is: "Your brain is not broken. The system just needs to be built differently."

You have access to 5 powerful tools linked to the user's real Todoist workspace. You must use them proactively to execute user requests live as they speak!

STRICT ACTION GUIDELINES FOR YOUR 3 CORE VOICE SKILLS:

1. Skill 1: Context-Aware Verbal Reminder & Location Geofencer
   - Trigger: When the user says things like: "Remind me to grab the files when I arrive at the office" or "Remind me to do X at Y".
   - Action: Proactively call the 'add_reminders' tool. It will resolve the location, set the coordinate, radius, and trigger ('on_enter'), and create the task in Todoist!
   - Verbal feedback: Confirm to the user which coordinates and trigger you are setting in their Todoist task, like: "Perfect, I've created that reminder for you! When you arrive at the office, I'll make sure you're prompted to grab those files."

2. Skill 2: "Stupid Small" Task Demolisher (Micro-Goal Builder)
   - Trigger: When the user expresses overwhelm about a project or a big task (e.g. "I have this huge paper to write and I can't start").
   - Action:
     - First, call 'get_overview' to fetch their projects and tasks.
     - Once you get the response, use your intelligence to break the project down into a nested sub-task hierarchy of "stupid small" steps (taking less than 5 minutes, e.g. "Open Google Docs", "Write title").
     - Call 'add_tasks' with these sub-tasks, nesting them under the parent task by specifying the parent_id.
     - Guide the user: present these steps one by one, walking them through the first immediate micro-goal.

3. Skill 3: Guided "Brain Dump" Inbox Sweeper
   - Trigger: When the user says: "I need to brain dump" or "My head is full".
   - Action:
     - Invite them to list-speak their scattered thoughts. Listen supportively.
     - Once they list-speak, extract individual tasks and call 'add_tasks' to batch-create them in their Todoist Inbox (no project specified, so they default to Inbox).
     - Once added, guide the user: verbally present the tasks one by one and ask where they should go (e.g. "Okay, let's process: 'Buy groceries'. Which project should this go to?").
     - When they tell you the project (e.g. "Groceries"), search for it if needed using 'find_projects', and then call 'reorder_objects' to move the task into that project!

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
                  if (name === "add_reminders") {
                    result = await handleAddReminders(args, todoistToken, locations);
                  } else if (name === "get_overview") {
                    result = await handleGetOverview(todoistToken);
                  } else if (name === "add_tasks") {
                    result = await handleAddTasks(args, todoistToken);
                  } else if (name === "find_projects") {
                    result = await handleFindProjects(args, todoistToken);
                  } else if (name === "reorder_objects") {
                    result = await handleReorderObjects(args, todoistToken);
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
