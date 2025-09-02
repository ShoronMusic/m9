import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// このAPIルートを静的生成から除外
export const dynamic = 'force-dynamic';

const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'mobile-logs.json');

// ブラウザ情報を取得
function getBrowserInfo(userAgent) {
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  if (/Edge/i.test(userAgent)) return 'Edge';
  if (/Opera/i.test(userAgent)) return 'Opera';
  return 'Unknown';
}

// OS情報を取得
function getOSInfo(userAgent) {
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  return 'Unknown';
}

// エラーカテゴリを取得
function getErrorCategory(level, type) {
  if (level === 'error') {
    if (type === 'javascript_error') return 'JavaScript Error';
    if (type === 'network_error') return 'Network Error';
    if (type === 'api_error') return 'API Error';
    return 'General Error';
  }
  if (level === 'warning') {
    if (type === 'performance') return 'Performance Warning';
    if (type === 'network') return 'Network Warning';
    return 'General Warning';
  }
  return 'Information';
}

// 重要度レベルを取得
function getSeverityLevel(level) {
  switch (level) {
    case 'error': return 'high';
    case 'warning': return 'medium';
    case 'info': return 'low';
    default: return 'low';
  }
}

// ログファイルの初期化
function initializeLogFile() {
  const logDir = path.dirname(LOG_FILE_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  if (!fs.existsSync(LOG_FILE_PATH)) {
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify([], null, 2));
  }
}

// ログを読み込み
function readLogs() {
  try {
    initializeLogFile();
    const data = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

// ログを保存
function saveLogs(logs) {
  try {
    initializeLogFile();
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error saving logs:', error);
  }
}

// POST: 新しいログエントリを追加
export async function POST(request) {
  try {
    const logEntry = await request.json();
    
    // ログエントリの検証
    if (!logEntry || !logEntry.message) {
      return NextResponse.json({ error: 'Invalid log entry' }, { status: 400 });
    }

    // ログエントリにIDとタイムスタンプを追加
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = logEntry.screenWidth ? logEntry.screenWidth <= 768 : /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = logEntry.screenWidth ? logEntry.screenWidth > 768 && logEntry.screenWidth <= 1024 : /iPad|Android(?=.*Tablet)|Kindle|Silk/i.test(userAgent);
    const isDesktop = !isMobile && !isTablet;
    
    const newLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...logEntry,
      // デバイス情報を追加
      deviceInfo: {
        userAgent,
        platform: logEntry.platform || 'unknown',
        language: logEntry.language || 'unknown',
        online: logEntry.online !== undefined ? logEntry.online : true,
        screenWidth: logEntry.screenWidth || 0,
        screenHeight: logEntry.screenHeight || 0,
        viewportWidth: logEntry.viewportWidth || 0,
        viewportHeight: logEntry.viewportHeight || 0,
        isMobile,
        isTablet,
        isDesktop,
        deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
        // ブラウザ情報
        browser: getBrowserInfo(userAgent),
        os: getOSInfo(userAgent),
      },
      // Axiom用の追加フィールド
      axiom: {
        dataset: process.env.AXIOM_DATASET,
        environment: process.env.VERCEL_ENV || 'development',
        region: process.env.VERCEL_REGION || 'unknown',
        source: 'mobile-logs-api',
        category: getErrorCategory(logEntry.level, logEntry.type),
        severity: getSeverityLevel(logEntry.level),
      }
    };

    // 既存のログを読み込み
    const logs = readLogs();
    
    // 新しいログエントリを追加
    logs.unshift(newLogEntry);
    
    // 最大1000件まで保持（古いものから削除）
    if (logs.length > 1000) {
      logs.splice(1000);
    }
    
    // ログを保存
    saveLogs(logs);
    
    // Axiomに送信
    if (process.env.AXIOM_DATASET && process.env.AXIOM_API_TOKEN) {
      try {
        const axiomResponse = await fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          },
          body: JSON.stringify([newLogEntry]),
        });

        if (!axiomResponse.ok) {
          console.warn('Axiom API error:', axiomResponse.status);
        }
      } catch (axiomError) {
        console.warn('Axiom send error:', axiomError);
      }
    }
    
    // コンソールにも出力（開発環境用）
    console.log('📱 Mobile Log:', {
      level: newLogEntry.level,
      type: newLogEntry.type,
      message: newLogEntry.message,
      device: newLogEntry.deviceInfo.isMobile ? 'Mobile' : 'Desktop',
      timestamp: newLogEntry.timestamp
    });

    return NextResponse.json({ 
      success: true, 
      id: newLogEntry.id,
      message: 'Log entry added successfully' 
    });
  } catch (error) {
    console.error('Error adding log entry:', error);
    return NextResponse.json({ error: 'Failed to add log entry' }, { status: 500 });
  }
}

// GET: ログを取得（フィルタリング・ページネーション対応）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const type = searchParams.get('type');
    const device = searchParams.get('device');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const action = searchParams.get('action');

    // ログをクリア
    if (action === 'clear') {
      saveLogs([]);
      return NextResponse.json({ 
        success: true, 
        message: 'All logs cleared' 
      });
    }

    // 古いログをクリーンアップ（30日以上前）
    if (action === 'cleanup') {
      const logs = readLogs();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const filteredLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate > thirtyDaysAgo;
      });
      
      saveLogs(filteredLogs);
      return NextResponse.json({ 
        success: true, 
        message: `Cleaned up ${logs.length - filteredLogs.length} old log entries` 
      });
    }

    // ログを読み込み
    let logs = readLogs();

    // フィルタリング
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    if (type) {
      logs = logs.filter(log => log.type === type);
    }
    
    if (device) {
      if (device === 'mobile') {
        logs = logs.filter(log => log.deviceInfo?.isMobile);
      } else if (device === 'tablet') {
        logs = logs.filter(log => log.deviceInfo?.isTablet);
      } else if (device === 'desktop') {
        logs = logs.filter(log => log.deviceInfo?.isDesktop);
      }
    }

    // ページネーション
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    // 統計情報を計算
    const stats = {
      total,
      error: logs.filter(log => log.level === 'error').length,
      warning: logs.filter(log => log.level === 'warning').length,
      info: logs.filter(log => log.level === 'info').length,
      mobile: logs.filter(log => log.deviceInfo?.isMobile).length,
      tablet: logs.filter(log => log.deviceInfo?.isTablet).length,
      desktop: logs.filter(log => log.deviceInfo?.isDesktop).length,
    };

    return NextResponse.json({
      success: true,
      logs: paginatedLogs,
      stats,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

// DELETE: ログを削除
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    if (action === 'clear') {
      saveLogs([]);
      return NextResponse.json({ 
        success: true, 
        message: 'All logs cleared' 
      });
    }

    if (id) {
      const logs = readLogs();
      const filteredLogs = logs.filter(log => log.id !== id);
      saveLogs(filteredLogs);
      return NextResponse.json({ 
        success: true, 
        message: 'Log entry deleted' 
      });
    }

    return NextResponse.json({ error: 'Invalid delete action' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting logs:', error);
    return NextResponse.json({ error: 'Failed to delete logs' }, { status: 500 });
  }
}
