// components/ScrollToTopButton.js
"use client";
import React from 'react';

const ScrollToTopButton = () => {
  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button onClick={scrollToTop} className="scroll-to-top-button">
      ↑ Back to Top
    </button>
  );
};

export default ScrollToTopButton;
