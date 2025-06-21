// app/page.jsx

import dynamic from 'next/dynamic';
import fs from "fs/promises";
import path from "path";

// TopPageClientを動的にインポート
const TopPageClient = dynamic(() => import("./TopPageClient"), {
  ssr: false // クライアントサイドでのみレンダリング
});

export const metadata = {
  title: "Music8 - TopPage",
  description: "Music8 のトップページです",
};

export default async function Page() {
  let topSongsData = [];
  const isRemote = process.env.NODE_ENV === "production";
  const baseUrl = isRemote
    ? process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/"
    : `file://${path.join(process.cwd(), "public", "data")}`;

  if (isRemote) {
    // リモート（本番・Github）
    const res = await fetch(`${baseUrl}/top_songs_by_style.json`);
    if (res.ok) {
      topSongsData = await res.json();
    }
  } else {
    // ローカル開発
    const filePath = path.join(process.cwd(), "public", "data", "top_songs_by_style.json");
    try {
      const file = await fs.readFile(filePath, "utf-8");
      topSongsData = JSON.parse(file);
    } catch (e) {
      topSongsData = [];
    }
  }

  return (
    <main>
      <TopPageClient topSongsData={topSongsData} />
    </main>
  );
}
