import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>404 - ページが見つかりません</h1>
      <p className={styles.message}>お探しのページは存在しないか、移動された可能性があります。</p>
      <a href="/" className={styles.link}>ホームに戻る</a>
    </div>
  );
} 