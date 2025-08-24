import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request, { params }) {
  try {
    const { playlistId } = params;
    
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service Role Keyを使用してSupabaseクライアントを作成（RLSバイパス）
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
    
    // NextAuthのセッションからSpotifyユーザーIDを取得
    const spotifyUserId = session.user.id;
    
    // Supabaseでユーザーを検索
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', spotifyUserId)
      .single();
    
    if (userError || !supabaseUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = supabaseUser.id;

    // プレイリストが存在し、ユーザーが所有しているかチェック
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id')
      .eq('id', playlistId)
      .single();

    if (playlistError || !playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.user_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // プレイリストのトラックを先に削除
    const { error: tracksDeleteError } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId);

    if (tracksDeleteError) {
      console.error('Error deleting playlist tracks:', tracksDeleteError);
      return Response.json({ error: 'Failed to delete playlist tracks' }, { status: 500 });
    }

    // プレイリストを削除
    const { error: playlistDeleteError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);

    if (playlistDeleteError) {
      console.error('Error deleting playlist:', playlistDeleteError);
      return Response.json({ error: 'Failed to delete playlist' }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Playlist deleted successfully' });

  } catch (error) {
    console.error('Delete playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// プレイリスト情報を更新
export async function PUT(request, { params }) {
  try {
    console.log('🔧 PUT /api/playlists/[playlistId] - 開始');
    
    const { playlistId } = params;
    console.log('📝 プレイリストID:', playlistId);
    
    // リクエストボディを取得
    const body = await request.json();
    console.log('📦 リクエストボディ:', body);
    
    const { name, description, is_public, year, tags } = body;

    // セッションを取得
    const session = await getServerSession(authOptions);
    console.log('👤 セッション:', session ? '存在' : 'なし');
    
    if (!session || !session.user) {
      console.log('❌ 認証エラー');
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 環境変数をチェック
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ 環境変数が不足:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return Response.json({ error: 'サーバー設定エラー' }, { status: 500 });
    }

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

    console.log('🔗 Supabaseクライアント作成完了');

    // プレイリストの所有者を確認
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('user_id')
      .eq('id', playlistId)
      .single();

    if (playlistError) {
      console.error('❌ プレイリスト取得エラー:', playlistError);
      return Response.json({ error: 'プレイリストが見つかりません' }, { status: 404 });
    }

    if (!playlist) {
      console.log('❌ プレイリストが存在しません');
      return Response.json({ error: 'プレイリストが見つかりません' }, { status: 404 });
    }

    console.log('✅ プレイリスト取得完了:', playlist);

    // ユーザーIDを取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', session.user.id)
      .single();

    if (userError) {
      console.error('❌ ユーザー取得エラー:', userError);
      return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    if (!user) {
      console.log('❌ ユーザーが存在しません');
      return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    console.log('✅ ユーザー取得完了:', user);

    // プレイリストの所有者かチェック
    if (playlist.user_id !== user.id) {
      console.log('❌ 権限エラー:', { playlistUserId: playlist.user_id, currentUserId: user.id });
      return Response.json({ error: 'このプレイリストを編集する権限がありません' }, { status: 403 });
    }

    console.log('✅ 権限チェック完了');

    // プレイリスト情報を更新
    const updateData = {
      name: name,
      description: description,
      is_public: is_public !== undefined ? is_public : false,
      year: year !== undefined ? year : null,
      tags: tags !== undefined ? tags : null,
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 更新データ:', updateData);

    const { error: updateError } = await supabase
      .from('playlists')
      .update(updateData)
      .eq('id', playlistId);

    if (updateError) {
      console.error('❌ プレイリスト更新エラー:', updateError);
      return Response.json({ 
        error: `データベース更新エラー: ${updateError.message}` 
      }, { status: 500 });
    }

    console.log('✅ プレイリスト更新完了');

    // 成功レスポンスを返す
    return Response.json({ 
      success: true,
      message: 'プレイリストが正常に更新されました'
    });

  } catch (error) {
    console.error('❌ プレイリスト更新APIエラー:', error);
    return Response.json({ 
      error: 'サーバーエラーが発生しました',
      details: error.message
    }, { status: 500 });
  }
}
