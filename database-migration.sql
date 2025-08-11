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

-- 複数ジャンル情報を格納するための新しいフィールドを追加
ALTER TABLE playlist_tracks 
ADD COLUMN genre_data JSONB, -- 複数ジャンルの完全な情報を格納
ADD COLUMN style_data JSONB, -- 複数スタイルの完全な情報を格納
ADD COLUMN vocal_data JSONB; -- 複数ボーカルの完全な情報を格納

-- 新しいフィールドにコメントを追加
COMMENT ON COLUMN playlist_tracks.genre_data IS '複数ジャンルの完全な情報（JSON形式）';
COMMENT ON COLUMN playlist_tracks.style_data IS '複数スタイルの完全な情報（JSON形式）';
COMMENT ON COLUMN playlist_tracks.vocal_data IS '複数ボーカルの完全な情報（JSON形式）';

-- 新しいフィールドにインデックスを作成（JSONBフィールドの検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_genre_data ON playlist_tracks USING GIN (genre_data);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_style_data ON playlist_tracks USING GIN (style_data);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_vocal_data ON playlist_tracks USING GIN (vocal_data);

-- 既存のデータを新しいフィールドに移行するための更新クエリ
-- 注意：このクエリは既存のデータがある場合のみ実行してください
UPDATE playlist_tracks 
SET 
  genre_data = CASE 
    WHEN genre_id IS NOT NULL AND genre_name IS NOT NULL 
    THEN jsonb_build_array(
      jsonb_build_object(
        'term_id', genre_id,
        'name', genre_name,
        'slug', genre_slug
      )
    )
    ELSE NULL
  END,
  style_data = CASE 
    WHEN style_id IS NOT NULL AND style_name IS NOT NULL 
    THEN jsonb_build_array(
      jsonb_build_object(
        'term_id', style_id,
        'name', style_name,
        'slug', style_slug
      )
    )
    ELSE NULL
  END,
  vocal_data = CASE 
    WHEN vocal_id IS NOT NULL AND vocal_name IS NOT NULL 
    THEN jsonb_build_array(
      jsonb_build_object(
        'term_id', vocal_id,
        'name', vocal_name,
        'slug', NULL
      )
    )
    ELSE NULL
  END
WHERE genre_id IS NOT NULL OR style_id IS NOT NULL OR vocal_id IS NOT NULL;


