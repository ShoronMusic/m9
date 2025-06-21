# ミュージックエイト 開発環境

## プロジェクト構成

- **E:\m8** - オリジナルYouTube再生版（ポート3000）
- **E:\m9** - 新Spotify再生版（ポート3001）

## 開発サーバーの起動

### Spotify版（E:\m9）の起動

```bash
cd E:\m9
npm run dev
# または
npm run dev:spotify
```

開発サーバーが http://localhost:3001 で起動します。

### YouTube版（E:\m8）の起動

```bash
cd E:\m8
npm run dev
# または
npm run dev:youtube
```

開発サーバーが http://localhost:3000 で起動します。

## 同時開発の利点

1. **並行開発**: 両方のバージョンを同時に動作させて比較検討可能
2. **機能比較**: YouTube版とSpotify版の動作を同時に確認
3. **データ共有**: 同じデータソースを使用して両バージョンをテスト
4. **段階的移行**: 機能を段階的に移行しながらテスト

## 主な違い

### YouTube版（E:\m8）
- YouTube埋め込みプレーヤー使用
- 動画サムネイル表示
- YouTube IDベースの楽曲管理

### Spotify版（E:\m9）
- Spotify埋め込みプレーヤー使用
- Spotify IDのみの楽曲表示
- 音声特化のプレーヤー

## 開発時の注意点

1. **ポート競合**: 両方のプロジェクトが異なるポートで動作することを確認
2. **データ同期**: 必要に応じてデータファイルを同期
3. **Firebase設定**: 両プロジェクトで同じFirebaseプロジェクトを使用
4. **環境変数**: 各プロジェクトの環境変数を適切に設定

## トラブルシューティング

### ポートが使用中の場合
```bash
# ポート3001が使用中の場合
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### 依存関係の更新
```bash
npm install
npm run clean
npm run dev
```

## デプロイ

### Spotify版のデプロイ
```bash
npm run build
npm run start
```

### YouTube版のデプロイ
```bash
npm run build
npm run start
``` 