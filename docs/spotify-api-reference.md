# Spotify Web API リファレンス

## 概要
このドキュメントは、Spotify Web APIで取得できる項目をカテゴリー別に整理したリファレンスです。M9プロジェクトでの実装に活用できます。

## 更新履歴
- 2025-01-15: 初版作成

---

## 🎵 楽曲情報 (Tracks)

### 基本情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `id` | string | Spotify Track ID | ⭐⭐⭐ |
| `name` | string | 曲名 | ⭐⭐⭐ |
| `duration_ms` | number | 再生時間（ミリ秒） | ⭐⭐ |
| `explicit` | boolean | 露骨な内容フラグ | ⭐ |
| `disc_number` | number | ディスク番号 | ⭐ |
| `track_number` | number | トラック番号 | ⭐ |

### 音声特性
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `acousticness` | number | アコースティック度 (0-1) | ⭐⭐ |
| `danceability` | number | ダンス性 (0-1) | ⭐⭐⭐ |
| `energy` | number | エネルギー (0-1) | ⭐⭐⭐ |
| `instrumentalness` | number | インスト曲度 (0-1) | ⭐⭐ |
| `key` | number | 調性 (0-11) | ⭐ |
| `liveness` | number | ライブ感 (0-1) | ⭐⭐ |
| `loudness` | number | 音量 (dB) | ⭐ |
| `mode` | number | 調性の種類 (0=短調, 1=長調) | ⭐ |
| `speechiness` | number | スピーチ度 (0-1) | ⭐ |
| `tempo` | number | テンポ (BPM) | ⭐⭐ |
| `time_signature` | number | 拍子記号 | ⭐ |
| `valence` | number | ポジティブ度 (0-1) | ⭐⭐⭐ |

### メタデータ
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `popularity` | number | 人気度 (0-100) | ⭐⭐⭐ |
| `is_playable` | boolean | 再生可能フラグ | ⭐⭐ |
| `is_local` | boolean | ローカルファイルフラグ | ⭐ |
| `available_markets` | array | 利用可能市場 | ⭐ |

---

## 👤 アーティスト情報 (Artists)

### 基本情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `id` | string | Spotify Artist ID | ⭐⭐⭐ |
| `name` | string | アーティスト名 | ⭐⭐⭐ |
| `type` | string | タイプ ("artist") | ⭐ |
| `uri` | string | Spotify URI | ⭐⭐ |

### 詳細情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `followers` | object | フォロワー数 | ⭐⭐ |
| `popularity` | number | 人気度 (0-100) | ⭐⭐⭐ |
| `genres` | array | ジャンル配列 | ⭐⭐⭐ |
| `images` | array | プロフィール画像 | ⭐⭐ |
| `external_urls` | object | 外部リンク | ⭐ |

### 関連情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `related_artists` | array | 関連アーティスト | ⭐⭐ |
| `top_tracks` | array | 人気曲 | ⭐⭐ |
| `albums` | array | アルバム一覧 | ⭐⭐ |

---

## 💿 アルバム情報 (Albums)

### 基本情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `id` | string | Spotify Album ID | ⭐⭐⭐ |
| `name` | string | アルバム名 | ⭐⭐⭐ |
| `album_type` | string | アルバムタイプ | ⭐⭐ |
| `total_tracks` | number | 総トラック数 | ⭐⭐ |
| `release_date` | string | リリース日 | ⭐⭐⭐ |
| `release_date_precision` | string | 日付精度 | ⭐ |

### 詳細情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `popularity` | number | 人気度 (0-100) | ⭐⭐⭐ |
| `images` | array | アルバム画像 | ⭐⭐⭐ |
| `external_urls` | object | 外部リンク | ⭐ |
| `available_markets` | array | 利用可能市場 | ⭐ |

---

## 📋 プレイリスト情報 (Playlists)

### 基本情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `id` | string | Spotify Playlist ID | ⭐⭐⭐ |
| `name` | string | プレイリスト名 | ⭐⭐⭐ |
| `description` | string | 説明 | ⭐⭐ |
| `owner` | object | 作成者情報 | ⭐⭐ |
| `public` | boolean | 公開フラグ | ⭐⭐ |
| `collaborative` | boolean | コラボレーティブフラグ | ⭐⭐ |

### 詳細情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `followers` | object | フォロワー数 | ⭐⭐ |
| `images` | array | プレイリスト画像 | ⭐⭐ |
| `tracks` | object | トラック一覧 | ⭐⭐⭐ |
| `total_tracks` | number | 総トラック数 | ⭐⭐ |

### メタデータ
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `snapshot_id` | string | スナップショットID | ⭐ |
| `external_urls` | object | 外部リンク | ⭐ |
| `created_at` | string | 作成日時 | ⭐⭐ |
| `updated_at` | string | 更新日時 | ⭐⭐ |

---

## 👤 ユーザー情報 (Users)

### 基本情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `id` | string | Spotify User ID | ⭐⭐⭐ |
| `display_name` | string | 表示名 | ⭐⭐ |
| `email` | string | メールアドレス | ⭐ |
| `country` | string | 国 | ⭐ |
| `product` | string | サブスクリプションタイプ | ⭐⭐ |

### 詳細情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `images` | array | プロフィール画像 | ⭐⭐ |
| `followers` | object | フォロワー数 | ⭐ |
| `birthdate` | string | 誕生日 | ⭐ |
| `external_urls` | object | 外部リンク | ⭐ |

---

## 🎧 再生状態情報 (Playback)

### 現在再生中
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `is_playing` | boolean | 再生中フラグ | ⭐⭐⭐ |
| `progress_ms` | number | 再生進捗（ミリ秒） | ⭐⭐⭐ |
| `timestamp` | number | タイムスタンプ | ⭐⭐ |
| `context` | object | 再生コンテキスト | ⭐⭐ |

### デバイス情報
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `device_id` | string | デバイスID | ⭐⭐ |
| `device_name` | string | デバイス名 | ⭐ |
| `device_type` | string | デバイスタイプ | ⭐ |
| `volume_percent` | number | 音量 (%) | ⭐⭐ |

---

## ❤️ ライブラリ情報 (Library)

### お気に入り曲
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `added_at` | string | 追加日時 | ⭐⭐⭐ |
| `track` | object | 楽曲情報 | ⭐⭐⭐ |

### お気に入りアーティスト
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `added_at` | string | 追加日時 | ⭐⭐ |
| `artist` | object | アーティスト情報 | ⭐⭐ |

### お気に入りアルバム
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `added_at` | string | 追加日時 | ⭐⭐ |
| `album` | object | アルバム情報 | ⭐⭐ |

---

## 🔍 検索・推奨情報 (Search & Recommendations)

### 検索結果
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `tracks` | object | 楽曲検索結果 | ⭐⭐⭐ |
| `artists` | object | アーティスト検索結果 | ⭐⭐ |
| `albums` | object | アルバム検索結果 | ⭐⭐ |
| `playlists` | object | プレイリスト検索結果 | ⭐⭐ |

### 推奨楽曲
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `seeds` | array | シード情報 | ⭐⭐ |
| `tracks` | array | 推奨楽曲一覧 | ⭐⭐⭐ |

---

## 📊 分析情報 (Audio Analysis)

### セクション分析
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `start` | number | 開始時間 | ⭐ |
| `duration` | number | 持続時間 | ⭐ |
| `confidence` | number | 信頼度 | ⭐ |
| `loudness` | number | 音量 | ⭐ |
| `tempo` | number | テンポ | ⭐⭐ |
| `key` | number | 調性 | ⭐ |
| `mode` | number | 調性の種類 | ⭐ |
| `time_signature` | number | 拍子記号 | ⭐ |

### セグメント分析
| 項目 | 型 | 説明 | M9活用度 |
|------|----|----|---------|
| `start` | number | 開始時間 | ⭐ |
| `duration` | number | 持続時間 | ⭐ |
| `confidence` | number | 信頼度 | ⭐ |
| `loudness_start` | number | 開始音量 | ⭐ |
| `loudness_max` | number | 最大音量 | ⭐ |
| `loudness_max_time` | number | 最大音量時間 | ⭐ |
| `pitches` | array | ピッチ配列 | ⭐ |
| `timbre` | array | 音色配列 | ⭐ |

---

## 🎯 M9プロジェクトでの活用優先度

### 優先度：高 (⭐⭐⭐)
- 楽曲の基本情報（名前、アーティスト、アルバム）
- 音声特性（danceability, energy, valence）
- プレイリスト情報
- ユーザーのお気に入り情報
- 再生状態管理
- 検索・推奨機能

### 優先度：中 (⭐⭐)
- 楽曲の詳細分析データ
- アーティストの関連情報
- アルバム情報
- デバイス管理

### 優先度：低 (⭐)
- 詳細な音声分析
- 著作権・メタデータ
- 統計情報

---

## 📝 実装時の注意点

### API制限
- レート制限: リクエスト数制限
- スコープ権限: 必要な権限の設定
- トークン管理: アクセストークンの有効期限

### データ処理
- エラーハンドリング: API エラーの適切な処理
- キャッシュ戦略: 頻繁に使用するデータのキャッシュ
- 非同期処理: API呼び出しの非同期処理

### セキュリティ
- トークン保護: アクセストークンの安全な管理
- ユーザー認証: 適切な認証フロー
- データプライバシー: ユーザーデータの適切な処理

---

## 🔗 関連リンク

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
- [M9プロジェクト開発ドキュメント](./DEVELOPMENT.md) 