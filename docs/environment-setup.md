# Environment Variables Setup

## Required Environment Variables

To enable all features, you need to set up the following environment variables:

### Supabase Configuration
Create a `.env.local` file in the root directory with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### NextAuth Configuration
```
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret
```

### Spotify Configuration
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Getting Supabase Credentials

1. Go to [Supabase](https://supabase.com) and create an account
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and anon/public key
5. For the service role key, go to Settings > API > Project API keys

## Current Status

- **Without Supabase**: Play history tracking is disabled but the app will work normally
- **With Supabase**: Full play history tracking and user management features are enabled

## Error Resolution

The 500 Internal Server Error for `/api/play-history` was caused by missing Supabase environment variables. This has been fixed to gracefully handle the missing configuration.

