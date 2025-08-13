// スタイルIDからスタイル名を取得する共通関数
export function getStyleName(styleId) {
  const styleMap = {
    2844: 'Pop',
    2845: 'Alternative',
    4686: 'Dance',
    2846: 'Electronica',
    2847: 'R&B',
    2848: 'Hip-Hop',
    6703: 'Rock',
    2849: 'Metal',
    2873: 'Others'
  };
  return styleMap[styleId] || 'Unknown';
}

// スタイル名からスタイルIDを取得する関数
export function getStyleId(styleName) {
  const styleNameMap = {
    'Pop': 2844,
    'Alternative': 2845,
    'Dance': 4686,
    'Electronica': 2846,
    'R&B': 2847,
    'Hip-Hop': 2848,
    'Rock': 6703,
    'Metal': 2849,
    'Others': 2873
  };
  return styleNameMap[styleName] || null;
}

// 全スタイルの一覧を取得する関数
export function getAllStyles() {
  return [
    { id: 2844, name: 'Pop' },
    { id: 2845, name: 'Alternative' },
    { id: 4686, name: 'Dance' },
    { id: 2846, name: 'Electronica' },
    { id: 2847, name: 'R&B' },
    { id: 2848, name: 'Hip-Hop' },
    { id: 6703, name: 'Rock' },
    { id: 2849, name: 'Metal' },
    { id: 2873, name: 'Others' }
  ];
}

