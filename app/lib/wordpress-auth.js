/**
 * WordPressの認証関連のユーティリティ関数
 */

/**
 * JWTトークンを取得する
 * @returns {Promise<string>} JWTトークン
 */
export async function getJwtToken() {
  const tokenUrl = 'https://sub.music8.jp/wp-json/jwt-auth/v1/token';
  const username = process.env.WP_USERNAME;
  const password = process.env.WP_APP_PASSWORD;

  if (!username || !password) {
    throw new Error('WordPressの認証情報が設定されていません');
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error('JWTトークンの取得に失敗しました');
  }

  const data = await res.json();
  return data.token;
}

/**
 * 認証ヘッダーを生成する
 * @returns {Promise<string>} 認証ヘッダー
 */
export async function getAuthHeader() {
  const token = await getJwtToken();
  return `Bearer ${token}`;
}

/**
 * 認証付きのリクエストを実行する
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @returns {Promise<Response>} レスポンス
 */
export async function fetchWithAuth(url, options = {}) {
  const authHeader = await getAuthHeader();
  const headers = {
    ...options.headers,
    'Authorization': authHeader,
  };

  return fetch(url, {
    ...options,
    headers,
  });
} 