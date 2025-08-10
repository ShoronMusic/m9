'use client';

export default function StyleDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>スタイル詳細でエラーが発生しました</h1>
      <p>スタイルの詳細情報の読み込み中にエラーが発生しました。</p>
      <button
        onClick={() => reset()}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          margin: '10px'
        }}
      >
        再試行
      </button>
      <a 
        href="/styles"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          fontSize: '16px',
          textDecoration: 'none',
          backgroundColor: '#6c757d',
          color: 'white',
          borderRadius: '4px',
          margin: '10px'
        }}
      >
        スタイル一覧に戻る
      </a>
    </div>
  );
}
