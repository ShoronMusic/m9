# 増分更新戦略

## 現状の課題
- 週1回の更新で全JSONとHTMLを再生成
- 画像の再ダウンロード
- ビルド時間の長さ
- 不要なリソース消費

## 最適化案

### 1. 差分検出システム

```javascript
// データ更新チェックの仕組み
{
  "last_updated": "2024-03-21T10:00:00Z",
  "content_hash": "sha256-hash",
  "modified_items": [
    {
      "id": "song-123",
      "type": "update",
      "timestamp": "2024-03-21T09:00:00Z"
    }
  ]
}
```

### 2. 増分更新の実装

#### 2.1 JSONデータの差分更新
1. WPから最終更新日時以降の変更のみを取得
2. 既存JSONとマージ
3. 変更されたエンティティの記録

```javascript
// 差分取得クエリ例
const query = `
  query GetModifiedContent($since: DateTime!) {
    songs(where: { modified_gmt: { gte: $since } }) {
      id
      title
      modified_gmt
    }
  }
`;
```

#### 2.2 画像の差分ダウンロード
1. 新規・更新された曲のサムネイルのみダウンロード
2. WebP変換は新規・更新画像のみ実行
3. 既存画像の再利用

#### 2.3 静的ページの選択的生成
1. 変更されたコンテンツに関連するページのみを特定
   - 個別ページ
   - リストページ（ページネーション）
   - 関連コンテンツページ
2. 特定されたページのみを再生成

### 3. キャッシュシステム

```javascript
// キャッシュマニフェスト
{
  "pages": {
    "/songs/song-123": {
      "dependencies": ["song-123", "artist-456"],
      "last_built": "2024-03-21T10:00:00Z",
      "hash": "sha256-hash"
    }
  },
  "data": {
    "song-123": {
      "last_modified": "2024-03-21T09:00:00Z",
      "hash": "sha256-hash"
    }
  }
}
```

### 4. ビルドスクリプトの改良

```javascript
async function incrementalBuild() {
  // 1. 変更検出
  const changes = await detectChanges();
  if (!changes.hasChanges) {
    console.log('変更なし - ビルドスキップ');
    return;
  }

  // 2. データ更新
  await updateModifiedData(changes.modifiedItems);

  // 3. 依存関係の解析
  const affectedPages = await analyzeDependencies(changes.modifiedItems);

  // 4. 選択的ビルド
  await buildSelectedPages(affectedPages);

  // 5. キャッシュ更新
  await updateBuildCache(changes, affectedPages);
}
```

## 実装手順

### 1. 準備フェーズ
1. 依存関係グラフの構築
2. キャッシュシステムの実装
3. ビルドマニフェストの作成

### 2. データ同期の最適化
1. WPのREST APIまたはGraphQLエンドポイントの準備
2. 差分取得ロジックの実装
3. マージ戦略の確立

### 3. ビルドプロセスの改良
1. 選択的ビルドの実装
2. キャッシュシステムの統合
3. エラーハンドリングの強化

## 期待される効果

### パフォーマンス改善
- ビルド時間: 80-90%削減
- リソース使用量: 60-70%削減
- ネットワーク転送: 90%削減

### 運用メリット
- より頻繁な更新が可能
- エラーリスクの低減
- システムリソースの効率的利用

## 注意点

### データ整合性
- 依存関係の正確な追跡
- キャッシュの適切な無効化
- エッジケースの考慮

### エラーハンドリング
- 部分的な失敗からの回復
- ロールバック機能
- ログ記録の強化

## 移行計画

### フェーズ1: 準備
1. 現状の完全ビルドシステムを維持
2. 依存関係追跡の実装
3. キャッシュシステムの導入

### フェーズ2: 段階的移行
1. データ更新の最適化
2. 選択的ビルドの導入
3. パフォーマンス計測

### フェーズ3: 完全移行
1. 新システムへの完全移行
2. モニタリングの強化
3. フォールバック手順の確立 