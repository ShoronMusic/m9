/**
 * WordPressのメディア関連のユーティリティ関数
 */
import { fetchWithAuth } from './wordpress-auth';

const API_BASE_URL = 'https://sub.music8.jp/wp-json/wp/v2';

/**
 * メディア一覧を取得する
 * @param {Object} options - 取得オプション
 * @param {number} options.per_page - 1ページあたりの件数
 * @param {number} options.page - ページ番号
 * @param {string} options.after - この日時以降のメディア
 * @returns {Promise<Array>} メディア一覧
 */
export async function getMediaList(options = {}) {
  const { per_page = 100, page = 1, after } = options;
  let url = `${API_BASE_URL}/media?per_page=${per_page}&page=${page}`;
  
  if (after) {
    url += `&after=${after}`;
  }

  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error('メディア一覧の取得に失敗しました');
  }

  return response.json();
}

/**
 * メディアの詳細を取得する
 * @param {number} mediaId - メディアID
 * @returns {Promise<Object>} メディアの詳細
 */
export async function getMediaDetail(mediaId) {
  const response = await fetchWithAuth(`${API_BASE_URL}/media/${mediaId}`);
  if (!response.ok) {
    throw new Error('メディアの詳細取得に失敗しました');
  }

  return response.json();
}

/**
 * メディアをアップロードする
 * @param {Buffer} fileBuffer - ファイルのバッファ
 * @param {string} fileName - ファイル名
 * @param {string} mimeType - MIMEタイプ
 * @returns {Promise<Object>} アップロード結果
 */
export async function uploadMedia(fileBuffer, fileName, mimeType) {
  const response = await fetchWithAuth(`${API_BASE_URL}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error('メディアのアップロードに失敗しました');
  }

  return response.json();
}

/**
 * メディアを削除する
 * @param {number} mediaId - メディアID
 * @returns {Promise<boolean>} 削除結果
 */
export async function deleteMedia(mediaId) {
  const response = await fetchWithAuth(`${API_BASE_URL}/media/${mediaId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('メディアの削除に失敗しました');
  }

  return true;
} 