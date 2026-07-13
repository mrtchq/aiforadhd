import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { getApps, initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";

dotenv.config();

// Usage limit configuration
const ANONYMOUS_DAILY_SECONDS = 300;
const WORKSPACE_INTEGRATION_SCOPES = {
  tasks: ["https://www.googleapis.com/auth/tasks"],
  calendar: ["https://www.googleapis.com/auth/calendar"],
  drive_docs: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ],
} as const;
type WorkspaceIntegration = keyof typeof WORKSPACE_INTEGRATION_SCOPES;
const SUPPORTED_WORKSPACE_SCOPES: Set<string> = new Set(
  Object.values(WORKSPACE_INTEGRATION_SCOPES).flatMap((scopes) => [...scopes])
);
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const LIVE_AUTH_TICKET_TTL_SECONDS = 5 * 60;
const OAUTH_PKCE_COOKIE = "quill_google_pkce";
const GOOGLE_TOKEN_COLLECTION = "googleOAuthRefreshTokens";

interface GoogleVaultRecord {
  uid: string;
  refreshTokenCiphertext: string;
  kmsKeyName: string;
  googleSub?: string;
  email?: string;
  displayName?: string;
  picture?: string;
  scopes?: string[];
  connectedAt?: unknown;
  updatedAt?: unknown;
  lastRefreshAt?: unknown;
  lastTokenExpiresAt?: string | null;
}

interface SignedPayload {
  exp: number;
  nonce: string;
  purpose: string;
  uid: string;
  [key: string]: unknown;
}

interface OAuthStatePayload extends SignedPayload {
  purpose: "google-oauth";
  pkceHash: string;
  requestedScopes: string[];
  requestedIntegrations: WorkspaceIntegration[];
}

interface LiveTicketPayload extends SignedPayload {
  purpose: "live-ws";
}

let adminInitialized = false;
let firestoreClient: Firestore | null = null;
let kmsClient: KeyManagementServiceClient | null = null;

function getAppUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is required for Google OAuth callbacks.");
  }
  return appUrl.replace(/\/+$/, "");
}

function getOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/oauth/google/callback`;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function getStateSecret(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET is required for signed OAuth state.");
  }
  return Buffer.from(secret, "utf8");
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sha256Base64Url(input: string): string {
  return base64Url(crypto.createHash("sha256").update(input).digest());
}

function signPayload(payload: SignedPayload): string {
  const encoded = base64Url(JSON.stringify(payload));
  const signature = base64Url(crypto.createHmac("sha256", getStateSecret()).update(encoded).digest());
  return `${encoded}.${signature}`;
}

function verifySignedPayload<T extends SignedPayload>(token: string, purpose: string): T {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new Error("Invalid signed payload.");
  }
  const expected = base64Url(crypto.createHmac("sha256", getStateSecret()).update(encoded).digest());
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid signed payload signature.");
  }
  const payload = JSON.parse(fromBase64Url(encoded).toString("utf8")) as T;
  if (payload.purpose !== purpose) {
    throw new Error("Invalid signed payload purpose.");
  }
  if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Signed payload expired.");
  }
  return payload;
}

function signedCookieValue(value: string): string {
  const signature = base64Url(crypto.createHmac("sha256", getStateSecret()).update(value).digest());
  return `${value}.${signature}`;
}

function verifySignedCookieValue(value: string | undefined): string {
  if (!value) {
    throw new Error("Missing OAuth PKCE cookie.");
  }
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) {
    throw new Error("Invalid OAuth PKCE cookie.");
  }
  const raw = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const expected = base64Url(crypto.createHmac("sha256", getStateSecret()).update(raw).digest());
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid OAuth PKCE cookie signature.");
  }
  return raw;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (cookieHeader || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}

function buildCookie(name: string, value: string, options: { maxAge?: number; path?: string; httpOnly?: boolean } = {}): string {
  const secureFlag = process.env.NODE_ENV === "production" ? " Secure;" : "";
  const maxAge = options.maxAge === undefined ? "" : ` Max-Age=${options.maxAge};`;
  const httpOnly = options.httpOnly === false ? "" : " HttpOnly;";
  return `${name}=${encodeURIComponent(value)};${maxAge} Path=${options.path || "/"};${httpOnly}${secureFlag} SameSite=Lax`;
}

function clearCookie(name: string, path = "/"): string {
  return `${name}=; Max-Age=0; Path=${path}; HttpOnly; SameSite=Lax`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function supportedWorkspaceScopes(scopes: string[] = []): string[] {
  return uniqueStrings(scopes).filter((scope) => SUPPORTED_WORKSPACE_SCOPES.has(scope));
}

function parseRequestedIntegrations(input: unknown): WorkspaceIntegration[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Request body must include a non-empty integrations array.");
  }

  const allowed = new Set(Object.keys(WORKSPACE_INTEGRATION_SCOPES));
  const integrations = uniqueStrings(input);
  if (integrations.length !== input.length || integrations.some((key) => !allowed.has(key))) {
    throw new Error("Request body includes an unsupported Google Workspace integration.");
  }

  return integrations as WorkspaceIntegration[];
}

function scopesForIntegrations(integrations: WorkspaceIntegration[]): string[] {
  return uniqueStrings(integrations.flatMap((integration) => [...WORKSPACE_INTEGRATION_SCOPES[integration]]));
}

function integrationsFromScopes(scopes: string[] = []): WorkspaceIntegration[] {
  const granted = new Set(supportedWorkspaceScopes(scopes));
  return (Object.keys(WORKSPACE_INTEGRATION_SCOPES) as WorkspaceIntegration[]).filter((integration) =>
    WORKSPACE_INTEGRATION_SCOPES[integration].every((scope) => granted.has(scope))
  );
}

function parseTokenResponseScopes(scope: unknown): string[] {
  return typeof scope === "string" ? scope.split(/\s+/).filter(Boolean) : [];
}

function initFirebaseAdmin() {
  if (!adminInitialized) {
    if (!getApps().length) {
      initializeApp();
    }
    adminInitialized = true;
  }
}

async function verifyFirebaseIdTokenFromHeader(req: express.Request): Promise<DecodedIdToken> {
  initFirebaseAdmin();
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error("Missing Firebase ID token.");
  }
  return getAuth().verifyIdToken(match[1], true);
}

function getFirestoreClient(): Firestore {
  if (!firestoreClient) {
    firestoreClient = new Firestore({
      databaseId: getRequiredEnv("FIRESTORE_DATABASE_ID"),
    });
  }
  return firestoreClient;
}

function getKmsClient(): KeyManagementServiceClient {
  if (!kmsClient) {
    kmsClient = new KeyManagementServiceClient();
  }
  return kmsClient;
}

function getOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: getOAuthRedirectUri(),
  });
}

async function encryptRefreshToken(uid: string, refreshToken: string): Promise<string> {
  const keyName = getRequiredEnv("KMS_KEY_NAME");
  const [result] = await getKmsClient().encrypt({
    name: keyName,
    plaintext: Buffer.from(refreshToken, "utf8"),
    additionalAuthenticatedData: Buffer.from(uid, "utf8"),
  });
  if (!result.ciphertext) {
    throw new Error("KMS encryption returned no ciphertext.");
  }
  return Buffer.from(result.ciphertext as Uint8Array).toString("base64");
}

async function decryptRefreshToken(uid: string, ciphertextBase64: string, kmsKeyName = getRequiredEnv("KMS_KEY_NAME")): Promise<string> {
  const [result] = await getKmsClient().decrypt({
    name: kmsKeyName,
    ciphertext: Buffer.from(ciphertextBase64, "base64"),
    additionalAuthenticatedData: Buffer.from(uid, "utf8"),
  });
  if (!result.plaintext) {
    throw new Error("KMS decryption returned no plaintext.");
  }
  return Buffer.from(result.plaintext as Uint8Array).toString("utf8");
}

async function getVaultRecord(uid: string): Promise<GoogleVaultRecord | null> {
  const snap = await getFirestoreClient().collection(GOOGLE_TOKEN_COLLECTION).doc(uid).get();
  return snap.exists ? (snap.data() as GoogleVaultRecord) : null;
}

async function saveVaultRecord(uid: string, record: Partial<GoogleVaultRecord>) {
  await getFirestoreClient().collection(GOOGLE_TOKEN_COLLECTION).doc(uid).set({
    uid,
    ...record,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function deleteVaultRecord(uid: string) {
  await getFirestoreClient().collection(GOOGLE_TOKEN_COLLECTION).doc(uid).delete();
}

async function getGoogleAccessTokenForUid(uid: string | null): Promise<string> {
  if (!uid) {
    throw new Error("Connect Google Workspace before using this tool.");
  }
  const record = await getVaultRecord(uid);
  if (!record?.refreshTokenCiphertext) {
    throw new Error("Google Workspace is not connected.");
  }
  const refreshToken = await decryptRefreshToken(uid, record.refreshTokenCiphertext, record.kmsKeyName);
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const accessTokenResponse = await oauthClient.getAccessToken();
  const accessToken = accessTokenResponse.token;
  if (!accessToken) {
    throw new Error("Google did not return an access token.");
  }
  const credentials = oauthClient.credentials;
  await saveVaultRecord(uid, {
    lastRefreshAt: FieldValue.serverTimestamp(),
    lastTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
  });
  return accessToken;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<Record<string, string | undefined>> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return {};
  }
  const data = await response.json() as Record<string, string | undefined>;
  return data;
}

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
  const cookies = parseCookies(req.headers.cookie);
  let anonId = cookies.quill_anon_id || null;

  if (!anonId) {
    anonId = "anon_" + crypto.randomBytes(16).toString("hex");
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    res.setHeader("Set-Cookie", buildCookie("quill_anon_id", anonId, { maxAge }));
    console.log("[Auth] Issued new anonymous visitor cookie.");
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

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(self)");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // Enable JSON request body parsing
  app.use(express.json());

  // Standard API health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/oauth/google/status", async (req, res) => {
    try {
      const decoded = await verifyFirebaseIdTokenFromHeader(req);
      const record = await getVaultRecord(decoded.uid);
      res.json({
        connected: Boolean(record?.refreshTokenCiphertext),
        email: record?.email || null,
        displayName: record?.displayName || null,
        picture: record?.picture || null,
        scopes: supportedWorkspaceScopes(record?.scopes || []),
        connectedIntegrations: integrationsFromScopes(record?.scopes || []),
        updatedAt: record?.updatedAt || null,
        lastRefreshAt: record?.lastRefreshAt || null,
      });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Unauthorized" });
    }
  });

  app.post("/api/oauth/google/start", async (req, res) => {
    try {
      const decoded = await verifyFirebaseIdTokenFromHeader(req);
      const requestedIntegrations = parseRequestedIntegrations(req.body?.integrations);
      const requestedScopes = scopesForIntegrations(requestedIntegrations);
      const existing = await getVaultRecord(decoded.uid);
      const existingScopes = supportedWorkspaceScopes(existing?.scopes || []);
      const authorizationScopes = uniqueStrings([...existingScopes, ...requestedScopes]);
      const hasUsableRefreshToken = Boolean(existing?.refreshTokenCiphertext);
      const codeVerifier = base64Url(crypto.randomBytes(64));
      const codeChallenge = sha256Base64Url(codeVerifier);
      const statePayload: OAuthStatePayload = {
        purpose: "google-oauth",
        uid: decoded.uid,
        nonce: base64Url(crypto.randomBytes(16)),
        exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
        pkceHash: sha256Base64Url(codeVerifier),
        requestedScopes,
        requestedIntegrations,
      };
      const state = signPayload(statePayload);
      const oauthClient = getOAuthClient();
      const authorizationUrl = oauthClient.generateAuthUrl({
        access_type: "offline",
        ...(hasUsableRefreshToken ? {} : { prompt: "consent" }),
        scope: authorizationScopes,
        include_granted_scopes: true,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      });
      res.setHeader("Set-Cookie", buildCookie(OAUTH_PKCE_COOKIE, signedCookieValue(codeVerifier), {
        maxAge: OAUTH_STATE_TTL_SECONDS,
        path: "/api/oauth/google/callback",
      }));
      res.json({ authorizationUrl });
    } catch (err: any) {
      const message = err.message || "";
      const status = /Missing Firebase|token|Unauthorized/i.test(message) ? 401 : /integrations|unsupported/i.test(message) ? 400 : 500;
      res.status(status).json({ error: err.message || "Failed to start Google OAuth." });
    }
  });

  app.get("/api/oauth/google/callback", async (req, res) => {
    const appUrl = process.env.APP_URL?.replace(/\/+$/, "") || "/";
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) {
        throw new Error("Missing OAuth callback code or state.");
      }
      const statePayload = verifySignedPayload<OAuthStatePayload>(state, "google-oauth");
      const cookies = parseCookies(req.headers.cookie);
      const codeVerifier = verifySignedCookieValue(cookies[OAUTH_PKCE_COOKIE]);
      if (sha256Base64Url(codeVerifier) !== statePayload.pkceHash) {
        throw new Error("OAuth PKCE verifier mismatch.");
      }

      const oauthClient = getOAuthClient();
      const tokenResult = await oauthClient.getToken({ code, codeVerifier });
      const tokens = tokenResult.tokens;
      const existing = await getVaultRecord(statePayload.uid);
      if (!tokens.refresh_token && !existing?.refreshTokenCiphertext) {
        throw new Error("Google did not return a refresh token. Revoke the app in your Google Account permissions and try connecting again.");
      }
      const refreshTokenCiphertext = tokens.refresh_token
        ? await encryptRefreshToken(statePayload.uid, tokens.refresh_token)
        : existing!.refreshTokenCiphertext;
      const kmsKeyName = tokens.refresh_token ? getRequiredEnv("KMS_KEY_NAME") : existing!.kmsKeyName;
      const accessToken = tokens.access_token || "";
      const userInfo = accessToken ? await fetchGoogleUserInfo(accessToken) : {};
      const grantedScopes = supportedWorkspaceScopes([
        ...(existing?.scopes || []),
        ...(statePayload.requestedScopes || []),
        ...parseTokenResponseScopes(tokens.scope),
      ]);

      await saveVaultRecord(statePayload.uid, {
        refreshTokenCiphertext,
        kmsKeyName,
        googleSub: userInfo.sub || existing?.googleSub,
        email: userInfo.email || existing?.email,
        displayName: userInfo.name || existing?.displayName,
        picture: userInfo.picture || existing?.picture,
        scopes: grantedScopes,
        connectedAt: existing?.connectedAt || FieldValue.serverTimestamp(),
        lastTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      });

      res.setHeader("Set-Cookie", clearCookie(OAUTH_PKCE_COOKIE, "/api/oauth/google/callback"));
      res.redirect(`${appUrl}/?workspace=connected`);
    } catch (err: any) {
      console.error("[OAuth] Google callback failed:", err.message || err);
      res.setHeader("Set-Cookie", clearCookie(OAUTH_PKCE_COOKIE, "/api/oauth/google/callback"));
      res.redirect(`${appUrl}/?workspace=error`);
    }
  });

  app.delete("/api/oauth/google/disconnect", async (req, res) => {
    try {
      const decoded = await verifyFirebaseIdTokenFromHeader(req);
      const record = await getVaultRecord(decoded.uid);
      if (record?.refreshTokenCiphertext) {
        const refreshToken = await decryptRefreshToken(decoded.uid, record.refreshTokenCiphertext, record.kmsKeyName);
        try {
          await getOAuthClient().revokeToken(refreshToken);
        } catch (revokeErr: any) {
          console.warn("[OAuth] Google token revoke failed; deleting local vault record:", revokeErr.message || revokeErr);
        }
      }
      await deleteVaultRecord(decoded.uid);
      res.json({ success: true });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Failed to disconnect Google Workspace." });
    }
  });

  app.post("/api/live/auth-ticket", async (req, res) => {
    try {
      const decoded = await verifyFirebaseIdTokenFromHeader(req);
      const ticket: LiveTicketPayload = {
        purpose: "live-ws",
        uid: decoded.uid,
        nonce: base64Url(crypto.randomBytes(16)),
        exp: Math.floor(Date.now() / 1000) + LIVE_AUTH_TICKET_TTL_SECONDS,
      };
      res.json({ ticket: signPayload(ticket), expiresIn: LIVE_AUTH_TICKET_TTL_SECONDS });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Unauthorized" });
    }
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
    console.log(`[Upgrade] Upgrade request received. Pathname: "${pathname}"`);
    
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

  async function handleGetWorkspaceOverview(workspaceUid: string | null) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
    const cleanToken = await getGoogleAccessTokenForUid(workspaceUid);
    
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

  async function handleAddGoogleTasks(args: any, workspaceUid: string | null) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
    const cleanToken = await getGoogleAccessTokenForUid(workspaceUid);
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

      console.log("[Workspace] Creating Google task.");

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

  async function handleCreateCalendarEvent(args: any, workspaceUid: string | null) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
    const cleanToken = await getGoogleAccessTokenForUid(workspaceUid);
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

  async function handleWriteGoogleDoc(args: any, workspaceUid: string | null) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
    const cleanToken = await getGoogleAccessTokenForUid(workspaceUid);
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

  async function handleManageKeepNotes(args: any, workspaceUid: string | null) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
    const cleanToken = await getGoogleAccessTokenForUid(workspaceUid);
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

  async function handleAddGoogleReminders(args: any, workspaceUid: string | null, locations: any[]) {
    if (!workspaceUid) {
      throw new Error("Connect Google Workspace before using this tool.");
    }
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
    
    const taskRes = await handleAddGoogleTasks(addArgs, workspaceUid);
    
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
      // Parse the connection URL query parameters to retrieve session config safely inside try-catch
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

      let workspaceUid: string | null = null;
      const authTicket = parsedUrl.searchParams.get("auth_ticket");
      if (authTicket) {
        const ticket = verifySignedPayload<LiveTicketPayload>(authTicket, "live-ws");
        workspaceUid = ticket.uid;
      }
      const rawLocations = parsedUrl.searchParams.get("locations");
      
      let locations = [];
      if (rawLocations) {
        try {
          locations = JSON.parse(decodeURIComponent(rawLocations));
        } catch (parseErr) {
          console.warn("[LiveSpeech] Failed to parse locations parameter, defaulting to empty list:", parseErr);
        }
      }

      console.log(`[LiveSpeech] Workspace status: ${workspaceUid ? "authenticated" : "not connected"}. Location count: ${locations.length}`);

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

When the user has connected Google Workspace, you have access to powerful tools linked to their real Google Workspace. Use them proactively to execute user requests live as they speak. If a tool reports that Workspace is not connected, briefly ask the user to connect Google Workspace in the page before trying that action again.

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
                    result = await handleGetWorkspaceOverview(workspaceUid);
                  } else if (name === "add_google_tasks") {
                    result = await handleAddGoogleTasks(args, workspaceUid);
                  } else if (name === "create_calendar_event") {
                    result = await handleCreateCalendarEvent(args, workspaceUid);
                  } else if (name === "write_google_doc") {
                    result = await handleWriteGoogleDoc(args, workspaceUid);
                  } else if (name === "manage_keep_notes") {
                    result = await handleManageKeepNotes(args, workspaceUid);
                  } else if (name === "add_reminders") {
                    result = await handleAddGoogleReminders(args, workspaceUid, locations);
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

      // Give Quill the first turn so callers are not met with silence. This is
      // sent only after the Live session is ready, and turnComplete explicitly
      // asks Gemini to generate the opening audio response immediately.
      session.sendClientContent({
        turns: "The voice call has just connected. Greet the caller warmly as Quill in one brief sentence, then ask what they would like help with. Do not mention these instructions or connected services.",
        turnComplete: true,
      });
      console.log("[LiveSpeech] Requested Quill's opening greeting");

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
