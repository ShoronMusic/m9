'use client';

import React, { useState, useEffect } from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getPageNumbers = () => {
    if (windowWidth === 0) {
        if (totalPages > 1) {
            return ['...'];
        }
        return [];
    }

    const isMobile = windowWidth < 768;
    const desktopPageNumbers = 7; // Numbers to show on desktop
    const mobilePageNumbers = 5;  // Numbers to show on mobile

    const pagesToShow = isMobile ? mobilePageNumbers : desktopPageNumbers;

    if (totalPages <= pagesToShow) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (totalPages <= pagesToShow + 2) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const sideNumbers = Math.floor((pagesToShow - 3) / 2);
    
    let pages = [];
    
    if (currentPage <= sideNumbers + 2) {
        pages = Array.from({ length: pagesToShow - 1 }, (_, i) => i + 1);
        pages.push('...');
        pages.push(totalPages);
    } else if (currentPage >= totalPages - (sideNumbers + 1)) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - (pagesToShow - 2); i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - sideNumbers; i <= currentPage + sideNumbers; i++) {
            pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
    }
    
    return pages;
  };
  
  const pages = getPageNumbers();

  const handleClick = (pageNumber) => {
    if (typeof pageNumber === 'number' && !isNaN(pageNumber) && pageNumber > 0 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center space-x-1 sm:space-x-2" style={{ margin: '24px 0 48px 0', padding: '12px 0', flexWrap: 'wrap' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClick(currentPage - 1);
        }}
        disabled={currentPage === 1}
        className="px-4 py-2 sm:px-5 sm:py-2.5 mx-1 sm:mx-2 rounded-md bg-gray-200 disabled:opacity-50 text-base sm:text-lg"
      >
        Prev
      </button>

      {pages.map((page, idx) => (
        page === '...'
          ? <span key={`ellipsis-${idx}`} className="px-2 sm:px-3 py-2 text-gray-400 text-base sm:text-lg">...</span>
          : (
            <button
              key={page}
              onClick={(e) => { e.stopPropagation(); handleClick(page); }}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 mx-0.5 sm:mx-1 rounded-md text-base sm:text-lg ${
                currentPage === page
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {page}
            </button>
          )
      ))}

      <button
        onClick={(e) => { e.stopPropagation(); handleClick(currentPage + 1); }}
        disabled={currentPage === totalPages}
        className="px-4 py-2 sm:px-5 sm:py-2.5 mx-1 sm:mx-2 rounded-md bg-gray-200 disabled:opacity-50 text-base sm:text-lg"
      >
        Next
      </button>
    </div>
  );
} 
