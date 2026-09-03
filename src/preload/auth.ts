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
const avatarBucket = "avatars";
const maxAvatarSizeBytes = 5 * 1024 * 1024;
const fallbackConfigError =
  "Supabase configuration is missing. Add VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.";

let supabaseClient: SupabaseClient | null = null;
const authEventCallbacks = new Set<(event: AuthEvent) => void>();

function getSupabaseUrl(): string | undefined {
  return (process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
}

function getSupabasePublishableKey(): string | undefined {
  const value = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();

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
    : typeof user.user_metadata.name === "string"
      ? user.user_metadata.name
      : undefined;
  const avatarUrl = typeof user.user_metadata.avatar_url === "string"
    ? user.user_metadata.avatar_url
    : typeof user.user_metadata.picture === "string"
      ? user.user_metadata.picture
      : undefined;
  const provider = typeof user.app_metadata.provider === "string"
    ? user.app_metadata.provider
    : undefined;

  return {
    id: user.id,
    email: user.email,
    fullName,
    avatarUrl,
    provider,
    createdAt: user.created_at
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
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("unsupported provider") || normalizedMessage.includes("provider is not enabled")) {
    return "Google sign-in is not configured yet. Enable Google in Supabase Authentication settings.";
  }

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

  if (normalizedMessage.includes("requires recent login") || normalizedMessage.includes("reauthentication")) {
    return "For security, sign out and sign back in before changing your email.";
  }

  if (normalizedMessage.includes("weak password") || normalizedMessage.includes("password")) {
    return "Use a stronger password and try again.";
  }

  if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  if (
    normalizedMessage.includes("bucket not found") ||
    normalizedMessage.includes("storage bucket") ||
    normalizedMessage.includes("object not found") ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("violates row-level security") ||
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("not authorized") ||
    normalizedMessage.includes("unauthorized")
  ) {
    return "Profile photo storage is not configured yet. Create the avatars bucket and storage policies from the setup guide.";
  }

  if (normalizedMessage.includes("expired")) {
    return "This authentication link is invalid or expired.";
  }

  if (normalizedMessage.includes("otp_expired") || normalizedMessage.includes("access_denied")) {
    return "This authentication link is invalid or expired. Request a new confirmation email and use the newest link.";
  }

  if (message === fallbackConfigError) {
    return fallbackConfigError;
  }

  return "Authentication failed. Please try again.";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message = typeof errorRecord.message === "string"
      ? errorRecord.message
      : undefined;
    const errorDescription = typeof errorRecord.error_description === "string"
      ? errorRecord.error_description
      : undefined;
    const errorCode = typeof errorRecord.error === "string"
      ? errorRecord.error
      : typeof errorRecord.error_code === "string"
        ? errorRecord.error_code
        : undefined;

    return [message, errorDescription, errorCode].filter(Boolean).join(" ");
  }

  return String(error);
}

async function emitCurrentAuthState(user?: User): Promise<void> {
  const { data } = await getSupabaseClient().auth.getSession();
  const session = user && data.session
    ? {
        ...data.session,
        user
      }
    : data.session;
  emitAuthEvent({
    type: "state",
    state: toAuthState(session)
  });
}

function getAvatarExtension(type: string): string | undefined {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/jpeg") {
    return "jpg";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return undefined;
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

async function updateProfile(input: { fullName: string }): Promise<AuthActionResult> {
  try {
    const fullName = input.fullName.trim();

    if (!fullName) {
      return { ok: false, message: "Enter a display name." };
    }

    const { data, error } = await getSupabaseClient().auth.updateUser({
      data: {
        full_name: fullName
      }
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    const { data: sessionData } = await getSupabaseClient().auth.getSession();
    const session = sessionData.session
      ? {
          ...sessionData.session,
          user: data.user
        }
      : sessionData.session;

    emitAuthEvent({
      type: "state",
      state: toAuthState(session)
    });

    return { ok: true, message: "Profile updated." };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function updateEmail(input: { email: string }): Promise<AuthActionResult> {
  try {
    const email = input.email.trim();

    if (!email) {
      return { ok: false, message: "Enter an email address." };
    }

    const { data, error } = await getSupabaseClient().auth.updateUser(
      { email },
      { emailRedirectTo: callbackUrl }
    );

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    await emitCurrentAuthState(data.user);
    return {
      ok: true,
      message: "Confirmation instructions have been sent. Your email will update after the required confirmation is completed.",
      pendingEmail: typeof data.user?.new_email === "string" ? data.user.new_email : email
    };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function updateAvatar(input: { file: File }): Promise<AuthActionResult> {
  try {
    const file = input.file;
    const extension = getAvatarExtension(file.type);

    if (!extension) {
      return { ok: false, message: "Use a PNG, JPEG, or WebP image." };
    }

    if (file.size > maxAvatarSizeBytes) {
      return { ok: false, message: "Choose an image smaller than 5 MB." };
    }

    const { data: userData, error: userError } = await getSupabaseClient().auth.getUser();

    if (userError || !userData.user) {
      return { ok: false, message: friendlyAuthError(userError ?? new Error("No authenticated user.")) };
    }

    const path = `${userData.user.id}/avatar.${extension}`;
    const { error: uploadError } = await getSupabaseClient().storage
      .from(avatarBucket)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600"
      });

    if (uploadError) {
      return { ok: false, message: friendlyAuthError(uploadError) };
    }

    const { data: publicUrlData } = getSupabaseClient().storage
      .from(avatarBucket)
      .getPublicUrl(path);

    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const { data, error } = await getSupabaseClient().auth.updateUser({
      data: {
        avatar_url: avatarUrl
      }
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    await emitCurrentAuthState(data.user);
    return { ok: true, message: "Profile photo updated." };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function removeAvatar(): Promise<AuthActionResult> {
  try {
    const { data: userData, error: userError } = await getSupabaseClient().auth.getUser();

    if (userError || !userData.user) {
      return { ok: false, message: friendlyAuthError(userError ?? new Error("No authenticated user.")) };
    }

    await getSupabaseClient().storage.from(avatarBucket).remove([
      `${userData.user.id}/avatar.png`,
      `${userData.user.id}/avatar.jpg`,
      `${userData.user.id}/avatar.webp`
    ]);

    const { data, error } = await getSupabaseClient().auth.updateUser({
      data: {
        avatar_url: null
      }
    });

    if (error) {
      return { ok: false, message: friendlyAuthError(error) };
    }

    await emitCurrentAuthState(data.user);
    return { ok: true, message: "Profile photo removed." };
  } catch (error: unknown) {
    return { ok: false, message: friendlyAuthError(error) };
  }
}

async function handleAuthCallback(urlValue: string): Promise<void> {
  try {
    const url = new URL(urlValue);
    const code = url.searchParams.get("code");
    const type = url.searchParams.get("type");
    const errorDescription = url.searchParams.get("error_description") ??
      url.searchParams.get("error_code") ??
      url.searchParams.get("error");
    const accessToken = url.hash ? new URLSearchParams(url.hash.slice(1)).get("access_token") : null;
    const refreshToken = url.hash ? new URLSearchParams(url.hash.slice(1)).get("refresh_token") : null;

    if (errorDescription) {
      emitAuthEvent({ type: "error", message: friendlyAuthError(new Error(errorDescription)) });
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
  updateProfile,
  updateEmail,
  updateAvatar,
  removeAvatar,
  onAuthEvent: (callback) => {
    authEventCallbacks.add(callback);
    return () => {
      authEventCallbacks.delete(callback);
    };
  }
};
