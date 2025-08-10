'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: 40, textAlign: "center" }}>
          <h1>予期しないエラーが発生しました</h1>
          <p>アプリケーションで予期しないエラーが発生しました。</p>
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
            href="/"
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
            ホームに戻る
          </a>
        </div>
      </body>
    </html>
  );
}
