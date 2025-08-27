'use client';

import { useState, useEffect } from 'react';
import { ERROR_TYPES, ERROR_SEVERITY } from './useErrorHandler';
import styles from './UnifiedErrorDisplay.module.css';

export default function UnifiedErrorDisplay({ 
  errors = [], 
  onResolve, 
  onReport,
  maxDisplayed = 3,
  showDetails = false,
  position = 'top-right' // 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'center'
}) {
  const [visibleErrors, setVisibleErrors] = useState([]);
  const [expandedErrors, setExpandedErrors] = useState(new Set());

  // 表示するエラーを制限
  useEffect(() => {
    setVisibleErrors(errors.slice(0, maxDisplayed));
  }, [errors, maxDisplayed]);

  // エラーを解決
  const handleResolve = (errorId) => {
    if (onResolve) {
      onResolve(errorId);
    }
  };

  // エラーを報告
  const handleReport = async (errorId) => {
    if (onReport) {
      await onReport(errorId);
    }
  };

  // エラーの詳細表示を切り替え
  const toggleErrorDetails = (errorId) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  // エラーの種類に応じたアイコンを取得
  const getErrorIcon = (type) => {
    switch (type) {
      case ERROR_TYPES.NETWORK:
        return '📡';
      case ERROR_TYPES.AUTHENTICATION:
        return '🔐';
      case ERROR_TYPES.VALIDATION:
        return '⚠️';
      case ERROR_TYPES.PERMISSION:
        return '🚫';
      case ERROR_TYPES.RATE_LIMIT:
        return '⏱️';
      case ERROR_TYPES.SERVER:
        return '🖥️';
      case ERROR_TYPES.CLIENT:
        return '💻';
      default:
        return '❌';
    }
  };

  // エラーの重要度に応じた色を取得
  const getErrorColor = (severity) => {
    switch (severity) {
      case ERROR_SEVERITY.LOW:
        return styles.low;
      case ERROR_SEVERITY.MEDIUM:
        return styles.medium;
      case ERROR_SEVERITY.HIGH:
        return styles.high;
      case ERROR_SEVERITY.CRITICAL:
        return styles.critical;
      default:
        return styles.medium;
    }
  };

  // エラーの重要度に応じたラベルを取得
  const getErrorSeverityLabel = (severity) => {
    switch (severity) {
      case ERROR_SEVERITY.LOW:
        return '低';
      case ERROR_SEVERITY.MEDIUM:
        return '中';
      case ERROR_SEVERITY.HIGH:
        return '高';
      case ERROR_SEVERITY.CRITICAL:
        return '緊急';
      default:
        return '中';
    }
  };

  // エラーの種類に応じたラベルを取得
  const getErrorTypeLabel = (type) => {
    switch (type) {
      case ERROR_TYPES.NETWORK:
        return 'ネットワーク';
      case ERROR_TYPES.AUTHENTICATION:
        return '認証';
      case ERROR_TYPES.VALIDATION:
        return '検証';
      case ERROR_TYPES.PERMISSION:
        return '権限';
      case ERROR_TYPES.RATE_LIMIT:
        return 'レート制限';
      case ERROR_TYPES.SERVER:
        return 'サーバー';
      case ERROR_TYPES.CLIENT:
        return 'クライアント';
      default:
        return '不明';
    }
  };

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.container} ${styles[position]}`}>
      {visibleErrors.map((error) => (
        <div 
          key={error.id} 
          className={`${styles.errorItem} ${getErrorColor(error.severity)}`}
        >
          <div className={styles.errorHeader}>
            <div className={styles.errorIcon}>
              {getErrorIcon(error.type)}
            </div>
            <div className={styles.errorInfo}>
              <div className={styles.errorMessage}>
                {error.message}
              </div>
              <div className={styles.errorMeta}>
                <span className={styles.errorType}>
                  {getErrorTypeLabel(error.type)}
                </span>
                <span className={styles.errorSeverity}>
                  {getErrorSeverityLabel(error.severity)}
                </span>
                <span className={styles.errorTime}>
                  {new Date(error.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className={styles.errorActions}>
              {showDetails && (
                <button
                  onClick={() => toggleErrorDetails(error.id)}
                  className={styles.detailsButton}
                  aria-label="詳細を表示"
                >
                  {expandedErrors.has(error.id) ? '▼' : '▶'}
                </button>
              )}
              <button
                onClick={() => handleResolve(error.id)}
                className={styles.resolveButton}
                aria-label="エラーを解決"
              >
                ✕
              </button>
            </div>
          </div>

          {showDetails && expandedErrors.has(error.id) && (
            <div className={styles.errorDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>エラーID:</span>
                <span className={styles.detailValue}>{error.id}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>URL:</span>
                <span className={styles.detailValue}>{error.url}</span>
              </div>
              {error.details && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>詳細:</span>
                  <span className={styles.detailValue}>{JSON.stringify(error.details)}</span>
                </div>
              )}
              <div className={styles.detailActions}>
                <button
                  onClick={() => handleReport(error.id)}
                  className={styles.reportButton}
                >
                  エラーを報告
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {errors.length > maxDisplayed && (
        <div className={styles.moreErrors}>
          <span>他 {errors.length - maxDisplayed} 件のエラーがあります</span>
        </div>
      )}
    </div>
  );
}
