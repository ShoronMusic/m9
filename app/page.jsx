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
  title: "TuneDive - TopPage",
  description: "TuneDive のトップページです",
  openGraph: {
    title: "TuneDive - TopPage",
    description: "TuneDive のトップページです",
  },
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
    const DATA_DIR = process.env.DATA_DIR || "https://xs867261.xsrv.jp/data/data";

    console.log('Page - Environment:', process.env.NODE_ENV);
    console.log('Page - isRemote:', isRemote);
    console.log('Page - DATA_DIR:', DATA_DIR);

    if (isRemote) {
      // リモート（本番・Vercel）
      try {
        const url = `${DATA_DIR}/top_songs_by_style.json`;
        console.log('Page - Fetching from:', url);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
        
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'User-Agent': 'TuneDive-App/1.0',
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        console.log('Page - Response status:', res.status);
        console.log('Page - Response ok:', res.ok);
        
        if (res.ok) {
          topSongsData = await res.json();
          console.log('Page - Data fetched successfully, items:', topSongsData.length);
        } else {
          console.error(`Page - Failed to fetch data: ${res.status} ${res.statusText}`);
          topSongsData = [];
        }
      } catch (error) {
        console.error('Page - Error fetching remote data:', error);
        topSongsData = [];
      }
    } else {
      // ローカル開発
      const filePath = path.join(process.cwd(), "public", "data", "top_songs_by_style.json");
      try {
        console.log('Page - Reading local file:', filePath);
        const file = await fs.readFile(filePath, "utf-8");
        topSongsData = JSON.parse(file);
        console.log('Page - Local data loaded, items:', topSongsData.length);
      } catch (e) {
        console.error('Page - Error reading local file:', e);
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
          <p>環境変数の設定を確認してください。</p>
          <p>Error: {error.message}</p>
        </div>
      </main>
    );
  }
}
