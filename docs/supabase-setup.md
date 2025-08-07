# Supabase セットアップガイド

## 1. Supabaseアカウント作成

1. [Supabase](https://supabase.com) にアクセス
2. "Start your project" をクリック
3. GitHubアカウントでログイン
4. "New Project" をクリック

## 2. プロジェクト作成

### 基本設定
- **Organization**: デフォルトまたは新規作成
- **Project name**: `tunedive-db`
- **Database password**: 強力なパスワードを設定（忘れずに保存）
- **Region**: `Northeast Asia (Tokyo)` を推奨
- **Pricing plan**: Free tier

### 作成完了後
- **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
- **anon public key**: `eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **service_role key**: `eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 3. データベーステーブル作成

### SQL Editorで実行

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spotify_id TEXT UNIQUE NOT NULL,
  spotify_email TEXT,
  spotify_display_name TEXT,
  spotify_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 視聴履歴テーブル
CREATE TABLE play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  song_id BIGINT NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  play_duration INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- お気に入りテーブル
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  song_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- インデックス作成
CREATE INDEX idx_play_history_user_id ON play_history(user_id);
CREATE INDEX idx_play_history_track_id ON play_history(track_id);
CREATE INDEX idx_play_history_played_at ON play_history(played_at);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_track_id ON favorites(track_id);

-- RLS (Row Level Security) 設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = spotify_id);

CREATE POLICY "Users can insert own play history" ON play_history
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT spotify_id FROM users WHERE id = user_id));

CREATE POLICY "Users can view own play history" ON play_history
  FOR SELECT USING (auth.uid()::text = (SELECT spotify_id FROM users WHERE id = user_id));

CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT spotify_id FROM users WHERE id = user_id));

CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT USING (auth.uid()::text = (SELECT spotify_id FROM users WHERE id = user_id));

CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid()::text = (SELECT spotify_id FROM users WHERE id = user_id));
```

## 4. 環境変数設定

### .env.local ファイルに追加

```bash
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 既存のSpotify設定
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3001
```

## 5. Supabaseクライアント設定

### パッケージインストール

```bash
npm install @supabase/supabase-js
```

### クライアント設定ファイル作成

```javascript
// app/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバーサイド用（Service Role Key使用）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

## 6. テスト

### 接続テスト

```javascript
// テスト用API
// app/api/test-db/route.js
import { NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful' 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 7. トラブルシューティング

### よくある問題

1. **環境変数が読み込まれない**
   - `.env.local` ファイルが正しい場所にあるか確認
   - サーバーを再起動

2. **RLSエラー**
   - ポリシーが正しく設定されているか確認
   - 認証が正しく動作しているか確認

3. **接続エラー**
   - URLとキーが正しいか確認
   - ネットワーク接続を確認

## 8. セットアップ完了後の確認手順

### 1. 環境変数の確認
```bash
# .env.localファイルが存在するか確認
ls -la .env.local

# 環境変数が読み込まれているか確認
echo $NEXT_PUBLIC_SUPABASE_URL
```

### 2. データベース接続テスト
```bash
# 開発サーバーを起動
npm run dev

# ブラウザで以下にアクセス
# http://localhost:3001/api/test-db
```

### 3. 期待される結果
```json
{
  "success": true,
  "message": "Database connection successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. エラーが発生した場合
- 環境変数が正しく設定されているか確認
- Supabaseプロジェクトの設定を確認
- テーブルが正しく作成されているか確認

## 9. 次のステップ

1. 環境変数を設定
2. Supabaseクライアントをインストール
3. APIエンドポイントを実装
4. フロントエンドでテスト
5. 視聴履歴機能の実装
6. マイページでの表示確認
