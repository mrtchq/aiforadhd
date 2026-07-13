import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('openid');
provider.addScope('email');
provider.addScope('profile');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;

export interface WorkspaceStatus {
  connected: boolean;
  email?: string | null;
  displayName?: string | null;
  picture?: string | null;
  scopes?: string[];
  connectedIntegrations?: WorkspaceIntegration[];
}

export type WorkspaceIntegration = 'tasks' | 'calendar' | 'drive_docs';

const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in before connecting Google Workspace.');
  }
  const idToken = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
};

export const getFirebaseIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
};

export const getWorkspaceStatus = async (): Promise<WorkspaceStatus> => {
  const response = await authorizedFetch('/api/oauth/google/status');
  if (!response.ok) {
    throw new Error('Could not load Google Workspace connection status.');
  }
  return response.json();
};

export const createLiveAuthTicket = async (): Promise<string | null> => {
  if (!auth.currentUser) return null;
  const response = await authorizedFetch('/api/live/auth-ticket', { method: 'POST' });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.ticket || null;
};

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, status: WorkspaceStatus) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!isSigningIn) {
        try {
          const status = await getWorkspaceStatus();
          if (onAuthSuccess) onAuthSuccess(user, status);
        } catch {
          if (onAuthSuccess) onAuthSuccess(user, { connected: false });
        }
      }
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<User> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const connectWorkspace = async (integrations: WorkspaceIntegration[]): Promise<void> => {
  const response = await authorizedFetch('/api/oauth/google/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrations }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.authorizationUrl) {
    throw new Error(data.error || 'Failed to start Google Workspace authorization.');
  }
  window.location.assign(data.authorizationUrl);
};

export const disconnectWorkspace = async () => {
  const response = await authorizedFetch('/api/oauth/google/disconnect', { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to disconnect Google Workspace.');
  }
};

export const logout = async () => {
  await auth.signOut();
};
