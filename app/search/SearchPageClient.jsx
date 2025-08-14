'use client';

import React, { useRef } from 'react';
import SearchBox from '../components/SearchBox';

export default function SearchPageClient() {
  const searchBoxRef = useRef(null);

  const handleSearchExampleClick = (setQuery) => {
    // この関数はSearchBox内で使用される
  };

  const handleExampleClick = (example) => {
    if (searchBoxRef.current) {
      searchBoxRef.current.setQuery(example);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            曲を検索
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            アーティスト名や曲名を入力して、お気に入りの曲を見つけましょう
          </p>
        </div>

        {/* 検索ボックス */}
        <div className="mb-8">
          <SearchBox ref={searchBoxRef} onSearchExampleClick={handleSearchExampleClick} />
        </div>

        {/* 検索のヒント */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            検索のヒント
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 text-xl">🎤</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">アーティスト名</h3>
              <p className="text-sm text-gray-600">
                「David Kushner」のように<br />
                アーティスト名だけで検索
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">🎵</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">曲名</h3>
              <p className="text-sm text-gray-600">
                「Heavens Sirens」のように<br />
                曲名だけで検索
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 text-xl">🔍</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">組み合わせ</h3>
              <p className="text-sm text-gray-600">
                「David Kushner - Heavens Sirens」<br />
                アーティスト名と曲名を組み合わせて検索
              </p>
            </div>
          </div>
        </div>

        {/* 人気の検索例 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            人気の検索例
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              'Mariah Carey',
              'Kehlani',
              'Sugar Sweet',
              'Butterfly Effect',
              'DISCONNECTED',
              'LONELY AVENUE'
            ].map((example, index) => (
              <button
                key={index}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors duration-200"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
