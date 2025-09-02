'use client';

import { useState, useCallback, useRef } from 'react';
import errorLogger from '@/lib/errorLogger';

// エラーの種類を定義
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  AUTHENTICATION: 'AUTHENTICATION',
  VALIDATION: 'VALIDATION',
  PERMISSION: 'PERMISSION',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  UNKNOWN: 'UNKNOWN'
};

// エラーの重要度を定義
export const ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// エラー情報の構造
export const createError = (message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, details = null) => ({
  id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  message,
  type,
  severity,
  details,
  timestamp: new Date().toISOString(),
  url: typeof window !== 'undefined' ? window.location.href : '',
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
});

export const useErrorHandler = (options = {}) => {
  const {
    onError,
    onErrorResolved,
    maxErrors = 10,
    autoResolveDelay = 5000,
    enableLogging = true,
    enableReporting = true
  } = options;

  const [errors, setErrors] = useState([]);
  const [isHandling, setIsHandling] = useState(false);
  const autoResolveTimers = useRef(new Map());

  // エラーを追加
  const addError = useCallback((error) => {
    const errorObj = typeof error === 'string' ? createError(error) : error;
    
    setErrors(prevErrors => {
      const newErrors = [errorObj, ...prevErrors].slice(0, maxErrors);
      return newErrors;
    });

    // 自動解決タイマーを設定
    if (autoResolveDelay > 0 && errorObj.severity !== ERROR_SEVERITY.CRITICAL) {
      const timer = setTimeout(() => {
        resolveError(errorObj.id);
      }, autoResolveDelay);
      
      autoResolveTimers.current.set(errorObj.id, timer);
    }

    // エラーログを記録
    if (enableLogging) {
      console.error('Error occurred:', errorObj);
    }

    // エラーログを送信
    errorLogger.logError(new Error(errorObj.message), {
      errorType: errorObj.type,
      severity: errorObj.severity,
      context: errorObj.context,
      errorId: errorObj.id,
    });

    // 外部のエラーハンドラーを呼び出し
    if (onError) {
      onError(errorObj);
    }

    return errorObj.id;
  }, [maxErrors, autoResolveDelay, enableLogging, onError]);

  // エラーを解決
  const resolveError = useCallback((errorId) => {
    setErrors(prevErrors => {
      const newErrors = prevErrors.filter(error => error.id !== errorId);
      return newErrors;
    });

    // 自動解決タイマーをクリア
    if (autoResolveTimers.current.has(errorId)) {
      clearTimeout(autoResolveTimers.current.get(errorId));
      autoResolveTimers.current.delete(errorId);
    }

    // エラー解決のコールバックを呼び出し
    if (onErrorResolved) {
      onErrorResolved(errorId);
    }
  }, [onErrorResolved]);

  // 複数のエラーを解決
  const resolveMultipleErrors = useCallback((errorIds) => {
    errorIds.forEach(resolveError);
  }, [resolveError]);

  // すべてのエラーを解決
  const resolveAllErrors = useCallback(() => {
    const errorIds = errors.map(error => error.id);
    resolveMultipleErrors(errorIds);
  }, [errors, resolveMultipleErrors]);

  // エラーをクリア（非推奨、resolveErrorを使用してください）
  const clearError = useCallback((errorId) => {
    console.warn('clearError is deprecated, use resolveError instead');
    resolveError(errorId);
  }, [resolveError]);

  // エラーをクリア（非推奨、resolveAllErrorsを使用してください）
  const clearAllErrors = useCallback(() => {
    console.warn('clearAllErrors is deprecated, use resolveAllErrors instead');
    resolveAllErrors();
  }, [resolveAllErrors]);

  // エラーの種類別にフィルタリング
  const getErrorsByType = useCallback((type) => {
    return errors.filter(error => error.type === type);
  }, [errors]);

  // エラーの重要度別にフィルタリング
  const getErrorsBySeverity = useCallback((severity) => {
    return errors.filter(error => error.severity === severity);
  }, [errors]);

  // アクティブなエラーの数を取得
  const getActiveErrorCount = useCallback(() => {
    return errors.length;
  }, [errors]);

  // 特定の種類のエラーが存在するかチェック
  const hasErrorType = useCallback((type) => {
    return errors.some(error => error.type === type);
  }, [errors]);

  // 特定の重要度のエラーが存在するかチェック
  const hasErrorSeverity = useCallback((severity) => {
    return errors.some(error => error.severity === severity);
  }, [errors]);

  // エラーを報告
  const reportError = useCallback(async (errorId) => {
    if (!enableReporting) return;

    const error = errors.find(e => e.id === errorId);
    if (!error) return;

    try {
      // エラー報告のAPIエンドポイントに送信
      const response = await fetch('/api/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...error,
          reportedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('Error reported successfully:', errorId);
        return true;
      } else {
        console.error('Failed to report error:', response.status);
        return false;
      }
    } catch (reportError) {
      console.error('Error reporting failed:', reportError);
      return false;
    }
  }, [errors, enableReporting]);

  // エラーハンドリングの状態
  const errorState = {
    errors,
    isHandling,
    activeCount: getActiveErrorCount(),
    hasNetworkErrors: hasErrorType(ERROR_TYPES.NETWORK),
    hasAuthErrors: hasErrorType(ERROR_TYPES.AUTHENTICATION),
    hasCriticalErrors: hasErrorSeverity(ERROR_SEVERITY.CRITICAL)
  };

  // エラーハンドリングのアクション
  const errorActions = {
    addError,
    resolveError,
    resolveMultipleErrors,
    resolveAllErrors,
    clearError, // 非推奨
    clearAllErrors, // 非推奨
    getErrorsByType,
    getErrorsBySeverity,
    reportError
  };

  return {
    ...errorState,
    ...errorActions
  };
};
