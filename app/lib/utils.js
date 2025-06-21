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
  
  // ローカルパスを構築
  return `/images/thum/${filename}`;
}; 