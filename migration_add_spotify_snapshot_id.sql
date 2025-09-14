-- Migration: Add spotify_snapshot_id column to playlists table
-- This column will track Spotify playlist changes using snapshot_id

-- Add the new column
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS spotify_snapshot_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.playlists.spotify_snapshot_id IS 'SpotifyプレイリストのスナップショットID（変更検知用）';

-- Update existing synced playlists to have a default snapshot_id
-- This will be updated when they are next synced
UPDATE public.playlists 
SET spotify_snapshot_id = 'initial' 
WHERE spotify_playlist_id IS NOT NULL 
  AND spotify_snapshot_id IS NULL;

