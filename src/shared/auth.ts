export type AuthProvider = "google";

export type AuthConfigStatus = {
  configured: boolean;
  message?: string;
};

export type AuthUser = {
  id: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  provider?: string;
  createdAt?: string;
};

export type AuthSession = {
  expiresAt?: number;
  tokenType?: string;
};

export type AuthState = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  config: AuthConfigStatus;
};

export type SignInInput = {
  email: string;
  password: string;
  remember: boolean;
};

export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
  remember: boolean;
};

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  needsEmailConfirmation?: boolean;
  pendingEmail?: string;
};

export type AuthEvent =
  | { type: "state"; state: AuthState }
  | { type: "recovery"; state: AuthState }
  | { type: "error"; message: string };

export type TeleprompterAuthApi = {
  getState: () => Promise<AuthState>;
  signIn: (input: SignInInput) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string) => Promise<AuthActionResult>;
  updateProfile: (input: { fullName: string }) => Promise<AuthActionResult>;
  updateEmail: (input: { email: string }) => Promise<AuthActionResult>;
  updateAvatar: (input: { file: File }) => Promise<AuthActionResult>;
  removeAvatar: () => Promise<AuthActionResult>;
  onAuthEvent: (callback: (event: AuthEvent) => void) => () => void;
};
