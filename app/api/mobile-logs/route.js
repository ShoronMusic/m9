import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs', 'mobile');
const LOG_FILE = path.join(LOGS_DIR, 'simple-mobile-logs.json');

// ログディレクトリとファイルの初期化
function ensureLogDirectory() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
  }
}

// ログファイルからログを読み込み
function readLogs() {
  try {
    ensureLogDirectory();
    const data = fs.readFileSync(LOG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
}

// ログファイルにログを書き込み
function writeLogs(logs) {
  try {
    ensureLogDirectory();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write logs:', error);
    return false;
  }
}

// ログの保存（POST）
export async function POST(request) {
  try {
    const logEntry = await request.json();
    
    // ログエントリの検証
    if (!logEntry || !logEntry.timestamp) {
      return new Response(JSON.stringify({ error: 'Invalid log entry' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 既存のログを読み込み
    const logs = readLogs();
    
    // 新しいログエントリを追加
    const newLogEntry = {
      ...logEntry,
      id: logEntry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toISOString(),
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
    
    logs.unshift(newLogEntry);
    
    // 最大ログ数を制限（1000件）
    const maxLogs = 1000;
    if (logs.length > maxLogs) {
      logs.splice(maxLogs);
    }
    
    // ログを保存
    if (writeLogs(logs)) {
      console.log(`Simple mobile log saved: ${newLogEntry.type} - ${newLogEntry.message}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Log saved successfully',
        logId: newLogEntry.id,
        totalLogs: logs.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to save log' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error saving simple mobile log:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ログの取得（GET）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // ログを読み込み
    const logs = readLogs();
    
    // ページネーション
    const paginatedLogs = logs.slice(offset, offset + limit);
    
    // 統計情報を計算
    const stats = {
      total: logs.length,
      errors: logs.filter(log => log.level === 'error').length,
      warnings: logs.filter(log => log.level === 'warning').length,
      info: logs.filter(log => log.level === 'info').length,
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        logs: paginatedLogs,
        stats,
        pagination: {
          total: logs.length,
          limit,
          offset,
          hasMore: offset + limit < logs.length
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error retrieving simple mobile logs:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ログの削除（DELETE）
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'clear') {
      // すべてのログをクリア
      if (writeLogs([])) {
        return new Response(JSON.stringify({
          success: true,
          message: 'All logs cleared successfully'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to clear logs' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (action === 'cleanup') {
      // 古いログをクリーンアップ（7日以上前）
      const logs = readLogs();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > sevenDaysAgo
      );
      
      if (writeLogs(filteredLogs)) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Old logs cleaned up successfully',
          removedCount: logs.length - filteredLogs.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to cleanup logs' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error deleting simple mobile logs:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
