import { NextResponse } from 'next/server';

// このAPIルートを静的生成から除外
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // テスト用のエラーログを作成
    const testLogEntry = {
      timestamp: new Date().toISOString(),
      userAgent: 'Test User Agent',
      url: 'https://example.com/test',
      message: 'Test error message',
      stack: 'Test stack trace',
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      deviceInfo: {
        userAgent: 'Test User Agent',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 667,
        viewportWidth: 375,
        viewportHeight: 667,
        language: 'ja-JP',
        platform: 'iPhone',
        cookieEnabled: true,
        onLine: true,
      },
      errorType: 'test_error',
      severity: 'info',
      context: {
        action: 'test_log',
        pageTitle: 'Test Page',
        referrer: 'https://example.com/previous',
        timestamp: Date.now(),
      },
      vercelRegion: process.env.VERCEL_REGION,
      vercelEnv: process.env.VERCEL_ENV,
    };

    // Axiomに送信
    if (process.env.AXIOM_DATASET && process.env.AXIOM_API_TOKEN) {
      const response = await fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
        },
        body: JSON.stringify([testLogEntry]),
      });

      if (response.ok) {
        return NextResponse.json({ 
          success: true, 
          message: 'Test log sent to Axiom successfully',
          logEntry: testLogEntry
        });
      } else {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (textError) {
          errorText = 'Failed to read error response';
        }
        
        return NextResponse.json({ 
          success: false, 
          error: `Axiom API error: ${response.status}`,
          response: errorText
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Axiom environment variables not configured' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test log error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
