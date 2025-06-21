// app/mypage/Pagination.js

"use client";
import React from 'react';

const Pagination = ({ totalPages, currentPage, onPageChange }) => {
  const pageNeighbours = 2;

  // from～to の連続した数値の配列を生成する関数
  const createPageRange = (from, to, step = 1) => {
    let i = from;
    const range = [];
    while (i <= to) {
      range.push(i);
      i += step;
    }
    return range;
  };

  // ページネーションに表示する範囲（必要に応じて省略記号「...」を挟む）の算出
  const paginationRange = () => {
    // 中央部に表示する数字の合計（currentPageの左右に pageNeighbours 分ずつ＋ currentPage 自体と最初と最後）
    const totalNumbers = pageNeighbours * 2 + 3;
    // 最初と最後のページ＋中央部の表示分
    const totalBlocks = totalNumbers + 2;

    if (totalPages > totalBlocks) {
      // 中央に表示する開始／終了ページ
      const startPage = Math.max(2, currentPage - pageNeighbours);
      const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);
      let pages = createPageRange(startPage, endPage);

      // もし先頭の隣接範囲が2より大きければ「...」を追加
      if (startPage > 2) {
        pages = ['...', ...pages];
      }
      // 末尾の隣接範囲が totalPages - 1 より小さければ「...」を追加
      if (endPage < totalPages - 1) {
        pages = [...pages, '...'];
      }

      return [1, ...pages, totalPages];
    }

    // 総ページ数がそれほど多くない場合はすべて表示
    return createPageRange(1, totalPages);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
      {paginationRange().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          style={{
            padding: '10px',
            margin: '5px',
            backgroundColor: currentPage === page ? 'blue' : 'white',
            color: currentPage === page ? 'white' : 'black',
            cursor: 'pointer',
            pointerEvents: page === '...' ? 'none' : 'auto',
          }}
        >
          {page}
        </button>
      ))}
    </div>
  );
};

export default Pagination;
