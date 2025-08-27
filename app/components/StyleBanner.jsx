import Link from 'next/link';
import styles from './StyleBanner.module.css';

// 日付を YYYY.MM.DD 形式にフォーマットするヘルパー関数
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const StyleBanner = ({ style, updateDate }) => {
  if (!style) return null;

  const { name, slug, totalSongs } = style;
  const formattedDate = formatDate(updateDate);

  // TuneDiveコンセプトカラーに基づいたグラデーション
  // スカイブルーからダークブルーのグラデーション
  const backgroundStyle = {
    background: `linear-gradient(135deg, #06b6d4 0%, #1e3a8a 100%)`,
  };

  return (
    <Link href={`/styles/${slug}/`} className={styles.bannerLink}>
      <div className={styles.bannerContainer} style={backgroundStyle}>
        {/* 白いオーバーレイ */}
        <div className={styles.whiteOverlay}></div>

        {/* 上部テキスト */}
        <div className={styles.topTextContainer}>
          <span className={styles.topLeftText}>Style</span>
          <span className={styles.topRightText}>{formattedDate}</span>
        </div>

        {/* 中央の半透明黒帯 */}
        <div className={styles.centerOverlay}>
           {/* 中央テキスト */}
          <div className={styles.centerTextContainer}>
            <h2 className={styles.styleName}>{name}</h2>
            <p className={styles.songCount}>{totalSongs} songs</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default StyleBanner; 