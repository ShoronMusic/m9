-- playlist_tracksテーブルに新しいカラムを追加
ALTER TABLE playlist_tracks 
ADD COLUMN genre_id INTEGER,
ADD COLUMN genre_name TEXT,
ADD COLUMN vocal_id INTEGER,
ADD COLUMN vocal_name TEXT,
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;

-- インデックスを作成（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_genre_id ON playlist_tracks(genre_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_vocal_id ON playlist_tracks(vocal_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_is_favorite ON playlist_tracks(is_favorite);

-- コメントを追加
COMMENT ON COLUMN playlist_tracks.genre_id IS 'ジャンルのID';
COMMENT ON COLUMN playlist_tracks.genre_name IS 'ジャンルの名前';
COMMENT ON COLUMN playlist_tracks.vocal_id IS 'ボーカルのID';
COMMENT ON COLUMN playlist_tracks.vocal_name IS 'ボーカルの名前';
COMMENT ON COLUMN playlist_tracks.is_favorite IS 'お気に入りフラグ';


