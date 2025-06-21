'use client';

import dynamic from 'next/dynamic';

// TopPageClientを動的にインポート
const TopPageClient = dynamic(() => import("../TopPageClient"), {
  ssr: false // クライアントサイドでのみレンダリング
});

export default function TopPageWrapper({ topSongsData }) {
  return <TopPageClient topSongsData={topSongsData} />;
} 