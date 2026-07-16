# Supabase Auth Setup

This application uses Supabase Auth from the Electron editor window through the preload auth bridge.

## Environment Variables

Create `.env.local` in the project root:

```text
VITE_SUPABASE_URL=https://slhjkxwlpkknmbkhjlvp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Do not use a Supabase secret key or service-role key in this desktop client.
Paste the publishable key value directly. Do not wrap the key in angle brackets.

## Redirect URLs

The Electron auth callback URL used by the app is:

```text
teleprompter://auth/callback
```

Add this URL in:

```text
Supabase Dashboard
→ Authentication
→ URL Configuration
→ Redirect URLs
```

Use the same URL for:

- Google OAuth callback return to the app
- password recovery links
- email confirmation links

## Email and Password

Enable email/password auth:

```text
Supabase Dashboard
→ Authentication
→ Sign In / Providers
→ Email
```

Recommended settings:

- Enable Email provider.
- Decide whether email confirmation is required.
- If email confirmation is enabled, users will see the in-app “Check your email” state after sign-up.

## Google OAuth

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID for a Web application.
5. Add Supabase’s Google callback URL to Google’s authorised redirect URIs:

```text
https://slhjkxwlpkknmbkhjlvp.supabase.co/auth/v1/callback
```

6. Copy the Google Client ID and Client Secret.
7. Open:

```text
Supabase Dashboard
→ Authentication
→ Sign In / Providers
→ Google
```

8. Enable Google and paste the Google Client ID and Client Secret.
9. Add the Electron callback URL to Supabase’s redirect allow list:

```text
teleprompter://auth/callback
```

Do not enable Supabase’s “OAuth Server” feature. It is not required for signing users into this desktop app with Google.

## Electron Callback Behaviour

The app registers the custom protocol:

```text
teleprompter://
```

OAuth and recovery links return to:

```text
teleprompter://auth/callback
```

The Electron main process receives the deep link and forwards it to the preload auth service. The preload service exchanges the one-time auth code with Supabase and does not expose access tokens through app IPC.

## Remember Me

Supabase sessions are stored through a custom storage adapter:

- Remember Me enabled: session persists in `localStorage`.
- Remember Me disabled: session is stored in `sessionStorage`, so it clears when the app window/session is closed.

## Required Manual Setup

Before auth is functional, replace the placeholder in `.env.local`:

```text
VITE_SUPABASE_PUBLISHABLE_KEY=<paste-publishable-key-here>
```

with the project’s Supabase publishable key, without the surrounding angle brackets.
