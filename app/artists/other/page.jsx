// src/app/artists/other/page.jsx

// サーバーコンポーネントなので "use client" は不要です

export const metadata = {
  title: 'Artists Index (Other) | Music8',
  description: 'Explore artists whose names do not start with an English alphabet letter. Discover the total number of artists available.',
};

import Layout from '../../components/Layout';
import OtherArtists from './OtherArtists';
import styles from './OtherArtists.module.css';
import fs from 'fs/promises';
import path from 'path';

export const revalidate = 43200; // 12時間ごとにISR

const OtherArtistsPage = async () => {
  const INITIAL_LIMIT = 20;
  const REMAINING_LIMIT = 9999;

  // 0-9アーティストデータを全ページ分取得
  let initialCategories = [];
  let totalCount = 0;
  let totalArtistsCount = 0;
  let pageNum = 1;
  // ISR/SSG/SSRでローカル・リモート自動切り替え
  const isRemote = process.env.NODE_ENV === "production" || process.env.DATA_BASE_URL?.startsWith("http");
  const dirPath = isRemote
    ? null
    : path.join(process.cwd(), 'public', 'data', 'artistlist', '0-9');
  while (true) {
    let json = null;
    try {
      if (isRemote) {
        // 外部サーバーからfetch
        const baseUrl = process.env.DATA_BASE_URL || "https://xs867261.xsrv.jp/data/data/";
        const res = await fetch(`${baseUrl}artistlist/0-9/${pageNum}.json`);
        if (!res.ok) break;
        json = await res.json();
      } else {
        // ローカルファイル
        const filePath = path.join(dirPath, `${pageNum}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        json = JSON.parse(data);
      }
      if (!json.artists || json.artists.length === 0) break;
      initialCategories.push(...json.artists);
      if (json.totalCount) totalCount = json.totalCount;
      if (json.total) totalCount = json.total;
      pageNum++;
    } catch {
      break;
    }
  }

  // 総アーティスト数（全件数）
  totalArtistsCount = totalCount;

  return (
    <Layout pageTitle="Artists Index (Other) | Music8">
      <div className={styles.artistIndexContainer}>
        <OtherArtists 
          initialCategories={initialCategories} 
          totalArtistsCount={totalArtistsCount} 
          totalCount={totalCount} 
        />
      </div>
    </Layout>
  );
};

export default OtherArtistsPage;
