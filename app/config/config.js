/**
 * Music8 アプリケーション設定
 */

// import { DATA_PATHS, API_PATHS, CDN_PATHS } from './paths'; // 不要なインポートをコメントアウト

/**
 * 環境設定
 */
export const ENV = {
  development: 'development',
  production: 'production',
  test: 'test'
};

/**
 * 現在の環境
 */
export const currentEnv = process.env.NODE_ENV || ENV.development;

/**
 * サイト基本設定
 */
export const SITE_CONFIG = {
  name: 'Music8',
  description: 'Discover and enjoy music videos from various artists and genres.',
  url: {
    development: 'http://localhost:3000',
    production: 'https://music8.jp'
  },
  email: 'contact@music8.jp'
};

/**
 * ページネーション設定
 */
export const PAGINATION = {
  itemsPerPage: 20,
  maxDisplayPages: 5
};

/**
 * 画像設定
 */
export const IMAGE_CONFIG = {
  thumbnails: {
    width: 300,
    height: 300,
    quality: 80,
    formats: ['webp', 'jpg']
  },
  artists: {
    width: 400,
    height: 400,
    quality: 85,
    formats: ['webp', 'jpg']
  }
};

/**
 * API設定
 */
export const API_CONFIG = {
  timeout: 10000,
  retries: 3,
  endpoints: {
    songs: '/api/songs',
    artists: '/api/artists',
    styles: '/api/styles',
    genres: '/api/genres'
  }
};

/**
 * キャッシュ設定
 */
export const CACHE_CONFIG = {
  staticData: {
    maxAge: 60 * 60, // 1時間
    staleWhileRevalidate: 60 * 5 // 5分
  },
  api: {
    maxAge: 60 * 5, // 5分
    staleWhileRevalidate: 60 // 1分
  }
};

/**
 * スタイル設定
 */
export const STYLE_CONFIG = {
  list: [
    { id: 'pop', name: 'Pop', description: 'Popular music including mainstream hits and chart-toppers.' },
    { id: 'dance', name: 'Dance', description: 'Electronic dance music and club hits.' },
    { id: 'alternative', name: 'Alternative', description: 'Alternative rock and indie music.' },
    { id: 'electronica', name: 'Electronica', description: 'Electronic music including ambient and experimental.' },
    { id: 'rb', name: 'R&B', description: 'Rhythm and blues, soul, and contemporary R&B.' },
    { id: 'hip-hop', name: 'Hip-hop', description: 'Hip-hop and rap music.' },
    { id: 'rock', name: 'Rock', description: 'Rock music from classic to modern.' },
    { id: 'metal', name: 'Metal', description: 'Heavy metal and its various subgenres.' },
    { id: 'others', name: 'Others', description: 'Other music styles and genres.' }
  ],
  defaultSort: 'name',
  defaultOrder: 'asc'
};

/**
 * メタデータ設定
 */
export const META_CONFIG = {
  title: {
    default: 'Music8 - Discover Music Videos',
    template: '%s | Music8'
  },
  description: {
    default: 'Discover and enjoy music videos from various artists and genres on Music8.',
    maxLength: 155
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Music8'
  }
};

/**
 * エラーメッセージ
 */
export const ERROR_MESSAGES = {
  notFound: 'The requested resource was not found.',
  serverError: 'An error occurred while processing your request.',
  networkError: 'Unable to connect to the server. Please check your internet connection.',
  timeoutError: 'The request timed out. Please try again.',
  invalidData: 'The data received was invalid or incomplete.'
};

/**
 * 機能フラグ
 */
export const FEATURES = {
  enableCache: true,
  enablePrefetch: true,
  enableImageOptimization: true,
  enableAnalytics: currentEnv === ENV.production,
  enableErrorReporting: currentEnv === ENV.production
};

/**
 * アプリケーション設定をまとめたオブジェクト
 */
export const config = {
  env: currentEnv,
  site: SITE_CONFIG,
  pagination: PAGINATION,
  image: IMAGE_CONFIG,
  api: API_CONFIG,
  cache: CACHE_CONFIG,
  style: STYLE_CONFIG,
  meta: META_CONFIG,
  errors: ERROR_MESSAGES,
  features: FEATURES
};

export default config;