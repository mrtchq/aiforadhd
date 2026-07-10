import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse app instance if already initialized to prevent duplicate initialization
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in-memory to prevent exposing it to localStorage
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        cachedAccessToken = 'local-session';
        if (onAuthSuccess) onAuthSuccess(user, 'local-session');
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google OAuth provider.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Live standard Email/Password Sign Up
export const emailSignUp = async (email: string, password: string): Promise<User> => {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    isSigningIn = true;
    const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    cachedAccessToken = 'local-session';
    return result.user;
  } catch (error: any) {
    console.error('Email Sign-Up Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Live standard Passwordless Magic Sign-In link dispatcher
export const sendPasswordlessSignInLink = async (email: string): Promise<{ success: boolean; method: 'firebase' }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const currentOrigin = window.location.origin;
  
  // Save email locally for verification on return
  window.localStorage.setItem('emailForSignIn', normalizedEmail);

  const actionCodeSettings = {
    // Redirect back to current origin
    url: `${currentOrigin}/?email_signin_link=true`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
    return { success: true, method: 'firebase' };
  } catch (error: any) {
    console.error('Firebase sendSignInLinkToEmail failed:', error);
    throw error;
  }
};

// Live standard verification check
export const checkIsSignInLink = (url: string): boolean => {
  return isSignInWithEmailLink(auth, url);
};

// Live standard sign-in callback handler
export const completeSignInWithLink = async (email: string, href: string): Promise<User> => {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const result = await signInWithEmailLink(auth, normalizedEmail, href);
    cachedAccessToken = 'local-session';
    window.localStorage.removeItem('emailForSignIn');
    return result.user;
  } catch (error: any) {
    console.error('Passwordless completeSignInWithLink error:', error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export { app, auth, db };
