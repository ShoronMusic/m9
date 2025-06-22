/**
 * サムネイル画像のパスをローカルパスに変換する
 * @param {string | null | undefined} originalUrl - オリジナルのURL（例: https://sub.music8.jp/wp-content/uploads/xxx.webp）
 * @returns {string | null} - ローカルパス（例: /images/thum/xxx.webp）またはnull
 */
export const getThumbnailPath = (originalUrl) => {
  // 入力が文字列でない、または空文字列の場合はnullを返す
  if (typeof originalUrl !== 'string' || !originalUrl) {
    return null; 
  }
  
  // 既にローカルパスの場合はそのまま返す
  if (originalUrl.startsWith('/images/thum/')) {
    return originalUrl;
  }
  
  // URLから最後のファイル名部分を抽出
  const filename = originalUrl.split('/').pop();

  // ファイル名がなければnullを返す
  if (!filename) {
    return null;
  }
  
  // ファイル名から拡張子を除去
  const basename = filename.split('.').slice(0, -1).join('.');
  
  // .webp形式のローカルパスを構築
  return `/images/thum/${basename}.webp`;
}; 