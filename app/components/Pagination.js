'use client';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  // 最大10件までのページ番号のみ表示
  let pages = [];
  if (totalPages <= 10) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    if (currentPage <= 6) {
      pages = [...Array(10).keys()].map(i => i + 1);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 5) {
      pages = [1, '...'];
      pages = pages.concat(Array.from({ length: 10 }, (_, i) => totalPages - 9 + i));
    } else {
      pages = [1, '...'];
      pages = pages.concat(Array.from({ length: 7 }, (_, i) => currentPage - 3 + i));
      pages.push('...');
      pages.push(totalPages);
    }
  }

  const handleClick = (pageNumber) => {
    if (typeof pageNumber === 'number' && !isNaN(pageNumber) && pageNumber > 0 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
    }
  };

  return (
    <div className="flex justify-center items-center space-x-2" style={{ margin: '24px 0', padding: '12px 0' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClick(currentPage - 1);
        }}
        disabled={currentPage === 1}
        className="px-4 py-2 mx-2 rounded-md bg-gray-200 disabled:opacity-50"
        style={{ marginRight: '12px' }}
      >
        Previous
      </button>

      {pages.map((page, idx) => (
        page === '...'
          ? <span key={`ellipsis-${idx}`} style={{ margin: '0 8px', color: '#888' }}>...</span>
          : (
            <button
              key={page}
              onClick={(e) => { e.stopPropagation(); handleClick(page); }}
              className={`px-4 py-2 mx-1 rounded-md ${
                currentPage === page
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
              style={{ margin: '0 4px' }}
            >
              {page}
            </button>
          )
      ))}

      <button
        onClick={(e) => { e.stopPropagation(); handleClick(currentPage + 1); }}
        disabled={currentPage === totalPages}
        className="px-4 py-2 mx-2 rounded-md bg-gray-200 disabled:opacity-50"
        style={{ marginLeft: '12px' }}
      >
        Next
      </button>
    </div>
  );
} 
