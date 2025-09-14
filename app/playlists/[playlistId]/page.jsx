import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import PlaylistPageWrapper from '@/components/PlaylistPageWrapper';

export default async function PlaylistPage({ params, searchParams }) {
  const { playlistId } = params;
  const autoPlayFirst = searchParams?.autoplay === '1';
  
  try {
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    
    // セッションがない場合の処理（公開プレイリストの場合は後でチェック）
    // セッションなしでも続行（公開プレイリストの場合は閲覧可能）

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
    
    // ユーザーIDの取得（セッションがある場合のみ）
    let userId = null;
    if (session && session.user) {
      const spotifyUserId = session.user.id;
      
      // Supabaseでユーザーを検索
      const { data: supabaseUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('spotify_id', spotifyUserId)
        .single();
      
      if (userError || !supabaseUser) {
        return (
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">ユーザーが見つかりません</h1>
              <p>ユーザー情報の取得に失敗しました。</p>
            </div>
          </div>
        );
      }
      
      userId = supabaseUser.id;
    }

    // プレイリスト情報を取得（ユーザー情報も含む）
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select(`
        id,
        name,
        description,
        is_public,
        cover_image_url,
        created_at,
        updated_at,
        spotify_playlist_id,
        sync_status,
        user_id,
        year,
        tags,
        users(
          id,
          spotify_display_name,
          spotify_email
        )
      `)
      .eq('id', playlistId)
      .single();

    if (playlistError || !playlist) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">プレイリストが見つかりません</h1>
            <p>指定されたプレイリストは存在しないか、削除されています。</p>
          </div>
        </div>
      );
    }

    // プレイリストのアクセス制御
    // 非公開プレイリストの場合、所有者のみアクセス可能
    if (!playlist.is_public) {
      if (!userId || playlist.user_id !== userId) {
        return (
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">アクセスが拒否されました</h1>
              <p>このプレイリストは非公開設定のため、作成者のみがアクセスできます。</p>
            </div>
          </div>
        );
      }
    }

    // プレイリストのトラックを取得
    console.log('=== プレイリスト詳細ページ: トラック取得開始 ===');
    console.log('プレイリストID:', playlistId);
    console.log('ユーザーID:', userId);
    
            const { data: tracks, error: tracksError } = await supabase
              .from('playlist_tracks')
              .select(`
                id,
                track_id,
                song_id,
                title,
                artists,
                spotify_artists,
                position,
                added_at,
                thumbnail_url,
                style_id,
                style_name,
                release_date,
                spotify_track_id,
                genre_id,
                genre_name,
                vocal_id,
                vocal_name,
                vocal_data,
                is_favorite,
                spotify_images
              `)
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    console.log('=== プレイリスト詳細ページ: トラック取得結果 ===');
    console.log('取得したトラック数:', tracks?.length || 0);
    console.log('エラー:', tracksError);
    console.log('トラック例:', tracks?.slice(0, 2));
    console.log('=== デバッグ情報終了 ===');

    if (tracksError) {
      console.error('Error fetching playlist tracks:', tracksError);
      console.error('Playlist ID:', playlistId);
      console.error('User ID:', userId);
      console.error('Supabase error details:', {
        code: tracksError.code,
        message: tracksError.message,
        details: tracksError.details,
        hint: tracksError.hint
      });
      
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
            <p>プレイリストのトラック情報の取得に失敗しました。</p>
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">
                <strong>エラーコード:</strong> {tracksError.code || 'N/A'}<br/>
                <strong>エラーメッセージ:</strong> {tracksError.message}<br/>
                {tracksError.details && <><strong>詳細:</strong> {tracksError.details}<br/></>}
                {tracksError.hint && <><strong>ヒント:</strong> {tracksError.hint}</>}
              </p>
            </div>
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-700">
                <strong>デバッグ情報:</strong><br/>
                プレイリストID: {playlistId}<br/>
                ユーザーID: {userId}<br/>
                プレイリスト所有者ID: {playlist?.user_id}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <PlaylistPageWrapper 
        playlist={playlist} 
        tracks={tracks || []} 
        session={session}
        autoPlayFirst={autoPlayFirst}
        isOwner={userId ? playlist.user_id === userId : false}
      />
    );

  } catch (error) {
    console.error('Playlist page error:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
          <p>ページの読み込み中にエラーが発生しました。</p>
        </div>
      </div>
    );
  }
}
