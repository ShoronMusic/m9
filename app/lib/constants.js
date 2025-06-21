import path from 'path';

// データファイルのルートディレクトリを定義
export const DATA_ROOT = path.join(process.cwd(), 'public', 'data');

// その他の定数
export const ITEMS_PER_PAGE = 20;
export const DEFAULT_THUMBNAIL = '/images/default-thumbnail.jpg'; 