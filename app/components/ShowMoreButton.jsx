// src/components/ShowMoreButton.jsx

'use client';

import React from 'react';
import styles from './ShowMoreButton.module.css'; // CSSモジュールのインポート

export default function ShowMoreButton({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} className={styles.showMoreButton}>
      {loading ? 'Loading...' : 'Show More'}
    </button>
  );
}
