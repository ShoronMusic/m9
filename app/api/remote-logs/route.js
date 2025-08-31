import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs', 'remote');
const LOG_FILE = path.join(LOGS_DIR, 'remote-mobile-logs.json');

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
    console.error('Failed to read remote logs:', error);
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
    console.error('Failed to write remote logs:', error);
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
      id: logEntry.id || `remote_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toISOString(),
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
      }
    };
    
    logs.unshift(newLogEntry);
    
    // 最大ログ数を制限（5000件）
    const maxLogs = 5000;
    if (logs.length > maxLogs) {
      logs.splice(maxLogs);
    }
    
    // ログを保存
    if (writeLogs(logs)) {
      console.log(`Remote mobile log saved: ${newLogEntry.type} - ${newLogEntry.message}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Remote log saved successfully',
        logId: newLogEntry.id,
        totalLogs: logs.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Failed to save remote log' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error saving remote mobile log:', error);
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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const level = searchParams.get('level');
    const type = searchParams.get('type');
    
    // ログを読み込み
    const logs = readLogs();
    
    // フィルタリング
    let filteredLogs = logs;
    
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (type && type !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.type === type);
    }
    
    // ページネーション
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    
    // 統計情報を計算
    const stats = {
      total: logs.length,
      filtered: filteredLogs.length,
      errors: logs.filter(log => log.level === 'error').length,
      warnings: logs.filter(log => log.level === 'warning').length,
      info: logs.filter(log => log.level === 'info').length,
      devices: logs.reduce((acc, log) => {
        const platform = log.platform || 'unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {})
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        logs: paginatedLogs,
        stats,
        pagination: {
          total: filteredLogs.length,
          limit,
          offset,
          hasMore: offset + limit < filteredLogs.length
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error retrieving remote mobile logs:', error);
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
          message: 'All remote logs cleared successfully'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to clear remote logs' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (action === 'cleanup') {
      // 古いログをクリーンアップ（14日以上前）
      const logs = readLogs();
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const filteredLogs = logs.filter(log => 
        new Date(log.timestamp) > fourteenDaysAgo
      );
      
      if (writeLogs(filteredLogs)) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Old remote logs cleaned up successfully',
          removedCount: logs.length - filteredLogs.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Failed to cleanup remote logs' }), {
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
    console.error('Error deleting remote mobile logs:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
