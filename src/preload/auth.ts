import { ipcRenderer } from "electron";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  type AuthActionResult,
  type AuthConfigStatus,
  type AuthEvent,
  type AuthSession,
  type AuthState,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
  type TeleprompterAuthApi
} from "../shared/auth";
import { ipcChannels } from "../shared/ipc";

const callbackUrl = "teleprompter://auth/callback";
const rememberStorageKey = "teleprompter.auth.rememberMe";
const authStorageKeyPrefix = "sb-";
const fallbackConfigError = "Supabase configuration is missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.";

let supabaseClient: SupabaseClient | null = null;
const authEventCallbacks = new Set<(event: AuthEvent) => void>();

function getSupabaseUrl(): string | undefined {
  return process.env.VITE_SUPABASE_URL?.trim();
}

function getSupabasePublishableKey(): string | undefined {
  const value = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!value) {
    return undefined;
  }

  if (value.startsWith("<") && value.endsWith(">")) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function getConfigStatus(): AuthConfigStatus {
  const supabaseUrl = getSupabaseUrl();
  const supabasePublishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabasePublishableKey || supabasePublishableKey.includes("paste-publishable-key-here")) {
    return {
      configured: false,
      message: fallbackConfigError
    };
  }

  if (!supabasePublishableKey.startsWith("sb_publishable_") && !supabasePublishableKey.startsWith("eyJ")) {
    return {
      configured: false,
      message: "Supabase publishable key format looks invalid. Paste the publishable key without angle brackets."
    };
  }

  try {
    const url = new URL(supabaseUrl);

    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      return {
        configured: false,
        message: "Supabase URL must be a valid https://*.supabase.co project URL."
      };
    }
  } catch {
    return {
      configured: false,
      message: "Supabase URL is invalid."
    };
  }

  return { configured: true };
}

function isPersistentAuthEnabled(): boolean {
  return window.localStorage.getItem(rememberStorageKey) === "1";
}

function setPersistentAuthEnabled(enabled: boolean): void {
  window.localStorage.setItem(rememberStorageKey, enabled ? "1" : "0");
}

function clearStoredAuthSessions(): void {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);

      if (key?.startsWith(authStorageKeyPrefix) || key === "supabase.auth.token") {
        storage.removeItem(key);
      }
    }
  }
}

const authStorage = {
  getItem(key: string): string | null {
    return isPersistentAuthEnabled()
      ? window.localStorage.getItem(key)
      : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (isPersistentAuthEnabled()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

function sanitizeUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  const fullName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : undefined;

  return {
    id: user.id,
    email: user.email,
    fullName
  };
}

function sanitizeSession(session: Session | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    expiresAt: session.expires_at,
    tokenType: session.token_type
  };
}

function toAuthState(session: Session | null, loading = false): AuthState {
  return {
    user: sanitizeUser(session?.user ?? null),
    session: sanitizeSession(session),
    loading,
    config: getConfigStatus()
  };
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid api key") || normalizedMessage.includes("api key")) {
    return "Supabase publishable key is invalid. Check .env.local and paste the publishable key without angle brackets.";
  }

  if (normalizedMessage.includes("invalid login") || normalizedMessage.includes("invalid credentials")) {
    return "The email or password is incorrect.";
  }

  if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already exists")) {
    return "An account with this email already exists.";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }

  if (normalizedMessage.includes("weak password") || normalizedMessage.includes("password")) {
    return "Use a stronger password and try again.";
  }

  if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  if (normalizedMessage.includes("expired")) {
    return "This authentication link is invalid or expired.";
  }

  if (message === fallbackConfigError) {
    return fallbackConfigError;
  }

  return "Authentication failed. Please try again.";
}

function emitAuthEvent(event: AuthEvent): void {
  for (const callback of authEventCallbacks) {
    callback(event);
  }
}

function getSupabaseClient(): SupabaseClient {
  const config = getConfigStatus();

  if (!config.configured) {
    throw new Error(config.message ?? fallbackConfigError);
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storage: authStorage
      }
    }
  );

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    emitAuthEvent({
      type: "state",
      state: toAuthState(session)
    });
  });

  return supabaseClient;
}

async function getState(): Promise<AuthState> {
  const config = getConfigStatus();

  if (!config.configured) {
    return {
      user: null,
      session: null,
      loading: false,
      config
    };
  }

  const { data, error } = await getSupabaseClient().auth.getSession();

  if (error) {
    return {
      user: null,
      session: null,
      loading: false,
      config
    };
  }

  return toAuthState(data.session);
}

async function signIn(input: SignInInput): Promise<AuthActionResult> {
  try {
    setPersistentAuthEnabled(input.remember);
    clearStoredAuthSessions();
    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email: input.email,
      password: input.password
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function signUp(input: SignUpInput): Promise<AuthActionResult> {
  try {
    setPersistentAuthEnabled(input.remember);
    clearStoredAuthSessions();
    const { data, error } = await getSupabaseClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName
        },
        emailRedirectTo: callbackUrl
      }
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    return {
      ok: true,
      needsEmailConfirmation: !data.session
    };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function signInWithGoogle(): Promise<AuthActionResult> {
  try {
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true
      }
    });

    if (error || !data.url) {
      return { ok: false, message: friendlyAuthError(error ?? new Error("OAuth URL was not returned.")) };
    }

    await ipcRenderer.invoke(ipcChannels.authOpenExternalUrl, data.url);
    return { ok: true, message: "Continue in your browser to finish signing in." };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function signOut(): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    clearStoredAuthSessions();
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function sendPasswordReset(email: string): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function updatePassword(password: string): Promise<AuthActionResult> {
  try {
    const { error } = await getSupabaseClient().auth.updateUser({ password });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function handleAuthCallback(urlValue: string): Promise<void> {
  try {
    const url = new URL(urlValue);
    const code = url.searchParams.get("code");
    const type = url.searchParams.get("type");
    const errorDescription = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    const accessToken = url.hash ? new URLSearchParams(url.hash.slice(1)).get("access_token") : null;
    const refreshToken = url.hash ? new URLSearchParams(url.hash.slice(1)).get("refresh_token") : null;

    if (errorDescription) {
      emitAuthEvent({ type: "error", message: errorDescription });
      return;
    }

    let session: Session | null = null;

    if (code) {
      const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(code);

      if (error) {
        emitAuthEvent({ type: "error", message: friendlyAuthError(error) });
        return;
      }

      session = data.session;
    } else if (accessToken && refreshToken) {
      const { data, error } = await getSupabaseClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        emitAuthEvent({ type: "error", message: friendlyAuthError(error) });
        return;
      }

      session = data.session;
    }

    if (!session) {
      emitAuthEvent({ type: "error", message: "This authentication link is invalid or expired." });
      return;
    }

    emitAuthEvent({
      type: type === "recovery" ? "recovery" : "state",
      state: toAuthState(session)
    });
  } catch (error: unknown) {
    emitAuthEvent({ type: "error", message: friendlyAuthError(error) });
  }
}

ipcRenderer.on(ipcChannels.authCallbackEvent, (_event, url: string) => {
  void handleAuthCallback(url);
});

export const teleprompterAuthApi: TeleprompterAuthApi = {
  getState,
  signIn,
  signUp,
  signInWithGoogle,
  signOut,
  sendPasswordReset,
  updatePassword,
  onAuthEvent: (callback) => {
    authEventCallbacks.add(callback);
    return () => {
      authEventCallbacks.delete(callback);
    };
  }
};
