import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Supabaseクライアントを作成
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔍 データベース構造確認開始');

    // playlistsテーブルの構造を確認
    const { data: playlistsInfo, error: playlistsError } = await supabase
      .from('playlists')
      .select('*')
      .limit(1);

    console.log('📋 playlistsテーブル情報:', { playlistsInfo, playlistsError });

    // テーブルの列情報を取得（PostgreSQLの情報スキーマを使用）
    let columnsInfo = null;
    let columnsError = null;
    
    try {
      const result = await supabase
        .rpc('get_table_columns', { table_name: 'playlists' });
      columnsInfo = result.data;
      columnsError = result.error;
    } catch (rpcError) {
      columnsError = 'RPC function not available';
    }

    console.log('🔍 列情報:', { columnsInfo, columnsError });

    // 代替方法：実際のデータから構造を推測
    const { data: samplePlaylist, error: sampleError } = await supabase
      .from('playlists')
      .select('*')
      .limit(1);

    console.log('📝 サンプルプレイリスト:', { samplePlaylist, sampleError });

    return Response.json({ 
      success: true,
      playlistsInfo: { data: playlistsInfo, error: playlistsError },
      columnsInfo: { data: columnsInfo, error: columnsError },
      samplePlaylist: { data: samplePlaylist, error: sampleError }
    });

  } catch (error) {
    console.error('❌ データベース構造確認エラー:', error);
    return Response.json({ 
      error: 'データベース構造確認に失敗しました',
      details: error.message
    }, { status: 500 });
  }
}
