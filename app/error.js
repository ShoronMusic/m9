"use client";

export default function Error() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>サーバーエラーが発生しました</h1>
      <a href="/">ホームに戻る</a>
    </div>
  );
}

// 静的生成のための設定
export const dynamic = 'force-static';
export const revalidate = false; 