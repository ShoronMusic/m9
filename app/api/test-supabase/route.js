import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/authOptions';
import { supabaseAdmin, supabase } from '../../lib/supabase';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 環境変数の確認
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseAdmin: !!supabaseAdmin,
      supabase: !!supabase
    };

    // Supabase接続テスト
    let connectionTest = { success: false, error: null };
    if (supabaseAdmin) {
      try {
        // 簡単なクエリで接続をテスト
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('count')
          .limit(1);
        
        if (error) {
          connectionTest = { success: false, error: error.message };
        } else {
          connectionTest = { success: true, data: data };
        }
      } catch (error) {
        connectionTest = { success: false, error: error.message };
      }
    } else {
      connectionTest = { success: false, error: 'Supabase admin client not initialized' };
    }

    // テーブル構造の確認
    let tableInfo = { users: false, play_history: false };
    if (supabaseAdmin) {
      try {
        // usersテーブルの確認
        const { data: usersData, error: usersError } = await supabaseAdmin
          .from('users')
          .select('*')
          .limit(1);
        
        tableInfo.users = !usersError;

        // play_historyテーブルの確認
        const { data: historyData, error: historyError } = await supabaseAdmin
          .from('play_history')
          .select('*')
          .limit(1);
        
        tableInfo.play_history = !historyError;
      } catch (error) {
        console.error('Table check error:', error);
      }
    }

    return Response.json({
      session: {
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name
      },
      environment: envCheck,
      connection: connectionTest,
      tables: tableInfo,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Test API Error:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

