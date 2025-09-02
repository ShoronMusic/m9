// エラーログ送信機能
class ErrorLogger {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.deviceInfo = this.getDeviceInfo();
    this.errorQueue = [];
    this.isOnline = navigator.onLine;
    
    // ネットワーク状態の監視
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushErrorQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // セッションID生成
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // デバイス情報取得
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*\bMobile\b)/i.test(userAgent);
    
    return {
      userAgent,
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    };
  }

  // ユーザーID設定
  setUserId(userId) {
    this.userId = userId;
  }

  // エラーログ送信
  async logError(error, context = {}) {
    const errorData = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      errorType: context.errorType || 'client_error',
      severity: context.severity || 'error',
      context: {
        ...context,
        pageTitle: document.title,
        referrer: document.referrer,
        timestamp: Date.now(),
      },
    };

    // オフラインの場合はキューに保存
    if (!this.isOnline) {
      this.errorQueue.push(errorData);
      this.saveErrorQueue();
      return;
    }

    try {
      await this.sendToServer(errorData);
    } catch (sendError) {
      console.error('Failed to send error log:', sendError);
      // 送信失敗時はキューに保存
      this.errorQueue.push(errorData);
      this.saveErrorQueue();
    }
  }

  // サーバーに送信
  async sendToServer(errorData) {
    const response = await fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // エラーキューをローカルストレージに保存
  saveErrorQueue() {
    try {
      localStorage.setItem('tunedive_error_queue', JSON.stringify(this.errorQueue));
    } catch (error) {
      console.error('Failed to save error queue:', error);
    }
  }

  // エラーキューをローカルストレージから復元
  loadErrorQueue() {
    try {
      const saved = localStorage.getItem('tunedive_error_queue');
      if (saved) {
        this.errorQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load error queue:', error);
      this.errorQueue = [];
    }
  }

  // キューに保存されたエラーを送信
  async flushErrorQueue() {
    if (this.errorQueue.length === 0) return;

    const errorsToSend = [...this.errorQueue];
    this.errorQueue = [];

    for (const errorData of errorsToSend) {
      try {
        await this.sendToServer(errorData);
      } catch (error) {
        console.error('Failed to flush error:', error);
        // 送信失敗時はキューに戻す
        this.errorQueue.push(errorData);
      }
    }

    // 送信成功したエラーをローカルストレージから削除
    if (this.errorQueue.length === 0) {
      localStorage.removeItem('tunedive_error_queue');
    } else {
      this.saveErrorQueue();
    }
  }

  // 認証エラーのログ
  logAuthError(error, context = {}) {
    this.logError(error, {
      ...context,
      errorType: 'auth_error',
      severity: 'warning',
    });
  }

  // ネットワークエラーのログ
  logNetworkError(error, context = {}) {
    this.logError(error, {
      ...context,
      errorType: 'network_error',
      severity: 'warning',
    });
  }

  // パフォーマンスエラーのログ
  logPerformanceError(error, context = {}) {
    this.logError(error, {
      ...context,
      errorType: 'performance_error',
      severity: 'info',
    });
  }

  // ユーザーアクションエラーのログ
  logUserActionError(error, context = {}) {
    this.logError(error, {
      ...context,
      errorType: 'user_action_error',
      severity: 'error',
    });
  }
}

// シングルトンインスタンス
const errorLogger = new ErrorLogger();

// 初期化時にキューを復元
errorLogger.loadErrorQueue();

export default errorLogger;
