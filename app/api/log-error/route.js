import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const errorData = await request.json();
    
    // エラーデータの検証
    if (!errorData || !errorData.message) {
      return NextResponse.json({ error: 'Invalid error data' }, { status: 400 });
    }

    // エラーログの構造化
    const logEntry = {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      url: errorData.url || 'unknown',
      message: errorData.message,
      stack: errorData.stack,
      userId: errorData.userId,
      sessionId: errorData.sessionId,
      deviceInfo: errorData.deviceInfo,
      errorType: errorData.errorType || 'unknown',
      severity: errorData.severity || 'error',
      // Vercel環境情報
      vercelRegion: process.env.VERCEL_REGION,
      vercelEnv: process.env.VERCEL_ENV,
    };

    // 外部ログサービスに送信（例：LogRocket）
    if (process.env.LOGROCKET_APP_ID) {
      await sendToLogRocket(logEntry);
    }

    // 外部ログサービスに送信（例：Sentry）
    if (process.env.SENTRY_DSN) {
      await sendToSentry(logEntry);
    }

    // 外部ログサービスに送信（例：Axiom）
    if (process.env.AXIOM_DATASET) {
      await sendToAxiom(logEntry);
    }

    // コンソールログ（開発環境用）
    console.error('Client Error:', logEntry);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging failed:', error);
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}

// LogRocketに送信
async function sendToLogRocket(logEntry) {
  try {
    const response = await fetch(`https://api.logrocket.com/v1/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LOGROCKET_API_KEY}`,
      },
      body: JSON.stringify({
        appId: process.env.LOGROCKET_APP_ID,
        logs: [logEntry],
      }),
    });
    
    if (!response.ok) {
      console.error('LogRocket API error:', response.status);
    }
  } catch (error) {
    console.error('LogRocket send error:', error);
  }
}

// Sentryに送信
async function sendToSentry(logEntry) {
  try {
    const response = await fetch(`https://sentry.io/api/0/projects/${process.env.SENTRY_ORG}/${process.env.SENTRY_PROJECT}/events/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        message: logEntry.message,
        level: logEntry.severity,
        tags: {
          errorType: logEntry.errorType,
          device: logEntry.deviceInfo?.isMobile ? 'mobile' : 'desktop',
        },
        extra: logEntry,
      }),
    });
    
    if (!response.ok) {
      console.error('Sentry API error:', response.status);
    }
  } catch (error) {
    console.error('Sentry send error:', error);
  }
}

// Axiomに送信
async function sendToAxiom(logEntry) {
  try {
    const response = await fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
      },
      body: JSON.stringify([logEntry]),
    });
    
    if (!response.ok) {
      console.error('Axiom API error:', response.status);
    }
  } catch (error) {
    console.error('Axiom send error:', error);
  }
}
