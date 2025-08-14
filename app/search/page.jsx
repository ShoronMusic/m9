import React from 'react';
import SearchPageClient from './SearchPageClient';

export const metadata = {
  title: '曲検索 - TuneDive',
  description: 'アーティスト名や曲名で曲を検索できます',
};

export default function SearchPage() {
  return <SearchPageClient />;
}
