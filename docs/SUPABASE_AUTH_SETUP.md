# Supabase Auth Setup

This application uses Supabase Auth from the Electron editor window through the preload auth bridge.

## Environment Variables

Create `.env.local` in the project root:

```text
VITE_SUPABASE_URL=https://poqwtkntyfojyjkemwci.supabase.co
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
- Keep Secure Email Change enabled unless the product owner explicitly decides otherwise.
- Decide whether email confirmation is required.
- If email confirmation is enabled, users will see the in-app “Check your email” state after sign-up.
- Email changes are requested with `supabase.auth.updateUser({ email })`; the current email remains visible until Supabase confirmation completes.

## Google OAuth

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID for a Web application.
5. Add Supabase’s Google callback URL to Google’s authorised redirect URIs:

```text
https://poqwtkntyfojyjkemwci.supabase.co/auth/v1/callback
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

If Google is not enabled, the app displays:

```text
Google sign-in is not configured yet. Enable Google in Supabase Authentication settings.
```

## Avatar Storage

Profile photos use Supabase Storage bucket:

```text
avatars
```

The app stores the active avatar at:

```text
{user.id}/avatar.{png|jpg|webp}
```

Supported file types:

- PNG
- JPEG
- WebP

Maximum file size:

```text
5 MB
```

The current implementation expects a public bucket so avatar URLs can be rendered directly in the Electron renderer. Writes remain protected by RLS.

Create the bucket:

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
```

Enable RLS policies:

```sql
create policy "Avatar files are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

Do not use a service-role key for avatar uploads.

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
