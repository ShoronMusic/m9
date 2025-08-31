import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

      // Supabaseにログを保存
      const { data, error } = await supabase
        .from('mobile_logs')
        .insert([{
          level: logEntry.level,
          type: logEntry.type,
          message: logEntry.message,
          details: logEntry.details,
          timestamp: logEntry.timestamp,
          user_agent: logEntry.userAgent,
          platform: logEntry.platform,
          language: logEntry.language,
          online: logEntry.online,
          screen_width: logEntry.screenWidth,
          screen_height: logEntry.screenHeight,
          viewport_width: logEntry.viewportWidth,
          viewport_height: logEntry.viewportHeight,
          url: logEntry.url,
          hostname: logEntry.hostname,
          environment: logEntry.environment
        }])
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        return new Response(JSON.stringify({ error: 'Failed to save log to database' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log(`Remote mobile log saved to Supabase: ${logEntry.type} - ${logEntry.message}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Remote log saved to database successfully',
        logId: data[0]?.id,
        totalLogs: 'stored in database'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
      
      // クエリビルダーを作成
      let query = supabase
        .from('mobile_logs')
        .select('*', { count: 'exact' });
      
      // フィルタリング
      if (level && level !== 'all') {
        query = query.eq('level', level);
      }
      
      if (type && type !== 'all') {
        query = query.eq('type', type);
      }
      
      // 並び順（最新順）
      query = query.order('timestamp', { ascending: false });
      
      // ページネーション
      query = query.range(offset, offset + limit - 1);
      
      const { data: logs, error, count } = await query;
      
      if (error) {
        console.error('Supabase select error:', error);
        return new Response(JSON.stringify({ error: 'Failed to retrieve logs from database' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // 統計情報を取得
      const { count: totalCount } = await supabase
        .from('mobile_logs')
        .select('*', { count: 'exact', head: true });
      
      const { count: errorCount } = await supabase
        .from('mobile_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'error');
      
      const { count: warningCount } = await supabase
        .from('mobile_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'warning');
      
      const { count: infoCount } = await supabase
        .from('mobile_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'info');
      
      const stats = {
        total: totalCount || 0,
        filtered: logs?.length || 0,
        errors: errorCount || 0,
        warnings: warningCount || 0,
        info: infoCount || 0
      };
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          logs: logs || [],
          stats,
          pagination: {
            total: totalCount || 0,
            limit,
            offset,
            hasMore: (offset + limit) < (totalCount || 0)
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
