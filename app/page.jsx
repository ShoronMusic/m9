// app/page.jsx

import dynamicImport from 'next/dynamic';
import fs from "fs/promises";
import path from "path";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

// TopPageClientを動的にインポート
const TopPageClient = dynamicImport(() => import("./TopPageClient"), {
  ssr: false // クライアントサイドでのみレンダリング
});

export const metadata = {
  title: "Music8 - TopPage",
  description: "Music8 のトップページです",
};

// キャッシュ設定を追加
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Page() {
  try {
    // セッションからaccessTokenを取得
    let accessToken = null;
    try {
      const session = await getServerSession(authOptions);
      accessToken = session?.accessToken || null;
    } catch (sessionError) {
      console.error('Error getting session:', sessionError);
      // セッションエラーでも続行
    }

    let topSongsData = [];
    const isRemote = process.env.NODE_ENV === "production";
    const baseUrl = isRemote
      ? process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/"
      : `file://${path.join(process.cwd(), "public", "data")}`;

    if (isRemote) {
      // リモート（本番・Github）
      try {
        console.log('Fetching data from:', `${baseUrl}/top_songs_by_style.json`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
        
        const res = await fetch(`${baseUrl}/top_songs_by_style.json`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'User-Agent': 'Music8-App/1.0',
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          topSongsData = await res.json();
          console.log('Data fetched successfully, items:', topSongsData.length);
        } else {
          console.error(`Failed to fetch data: ${res.status} ${res.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching remote data:', error);
        topSongsData = [];
      }
    } else {
      // ローカル開発
      const filePath = path.join(process.cwd(), "public", "data", "top_songs_by_style.json");
      try {
        const file = await fs.readFile(filePath, "utf-8");
        topSongsData = JSON.parse(file);
      } catch (e) {
        console.error('Error reading local file:', e);
        topSongsData = [];
      }
    }

    return (
      <main>
        <TopPageClient topSongsData={topSongsData} accessToken={accessToken} />
      </main>
    );
  } catch (error) {
    console.error('Critical error in Page component:', error);
    return (
      <main>
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h1>エラーが発生しました</h1>
          <p>申し訳ございませんが、ページの読み込み中にエラーが発生しました。</p>
          <p>しばらく時間をおいてから再度お試しください。</p>
        </div>
      </main>
    );
  }
}
