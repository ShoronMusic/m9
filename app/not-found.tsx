import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>ページが見つかりません</h1>
      <p>お探しのページは存在しないか、移動または削除された可能性があります。</p>
      <Link 
        href="/"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          fontSize: '16px',
          textDecoration: 'none',
          backgroundColor: '#007bff',
          color: 'white',
          borderRadius: '4px',
          margin: '10px'
        }}
      >
        ホームに戻る
      </Link>
    </div>
  );
} 