import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/authOptions';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  try {
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
    
    // Supabaseでユーザーを検索または作成
    let { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', spotifyUserId)
      .single();
    
    if (userError || !supabaseUser) {
      // ユーザーが存在しない場合は作成
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          spotify_id: spotifyUserId,
          spotify_email: session.user.email || null,
          spotify_display_name: session.user.name || null
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error('User creation error:', createError);
        return Response.json({ error: 'User creation failed' }, { status: 500 });
      }
      
      supabaseUser = newUser;
    }
    
    const userId = supabaseUser.id;

    // ユーザーのプレイリスト一覧を取得
    const { data: playlists, error } = await supabase
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
        sync_status
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // 各プレイリストのトラック数を個別に取得
    const playlistsWithTrackCount = await Promise.all(
      playlists.map(async (playlist) => {
        const { count: trackCount, error: countError } = await supabase
          .from('playlist_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('playlist_id', playlist.id);

        if (countError) {
          console.error(`Error getting track count for playlist ${playlist.id}:`, countError);
          return { ...playlist, track_count: 0 };
        }

        return { ...playlist, track_count: trackCount };
      })
    );

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    return Response.json({ playlists: playlistsWithTrackCount });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    console.log('=== Playlist Creation API Called ===');
    
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    console.log('Session data:', { 
      hasSession: !!session, 
      userId: session?.user?.id, 
      userEmail: session?.user?.email,
      userName: session?.user?.name 
    });
    
    if (!session || !session.user) {
      console.log('No session or user found');
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
    console.log('Spotify User ID:', spotifyUserId);
    
    // Supabaseでユーザーを検索または作成
    let { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('*') // 全フィールドを取得して詳細を確認
      .eq('spotify_id', spotifyUserId)
      .single();
    
    console.log('User search result:', { supabaseUser, userError });
    
    if (userError || !supabaseUser) {
      console.log('Creating new user in Supabase...');
      
      // ユーザーが存在しない場合は作成
      // UUIDを明示的に指定してデータベースの整合性を確保
      const newUserId = crypto.randomUUID();
      console.log('Generated new user ID:', newUserId);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: newUserId, // 明示的にUUIDを指定
          spotify_id: spotifyUserId,
          spotify_email: session.user.email || null,
          spotify_display_name: session.user.name || null
        })
        .select('*') // 全フィールドを取得
        .single();
      
      console.log('User creation result:', { newUser, createError });
      
      if (createError) {
        console.error('User creation error:', createError);
        return Response.json({ error: 'User creation failed' }, { status: 500 });
      }
      
      supabaseUser = newUser;
    }
    
    // ユーザーIDを取得
    const userId = supabaseUser.id;
    console.log('Final user ID:', userId);
    console.log('User details:', { 
      spotifyUserId, 
      supabaseUserId: userId, 
      supabaseUserData: supabaseUser 
    });
    
    // データベースの状態を確認
    const { data: userCheck, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError || !userCheck) {
      console.error('User verification failed:', userCheckError);
      return Response.json({ error: 'User verification failed' }, { status: 500 });
    }
    
    console.log('User verification successful:', userCheck);
    
    // データベースの整合性を詳細に確認
    console.log('=== Database Integrity Check ===');
    
    // usersテーブルの状態を確認
    const { data: usersTableInfo, error: usersTableError } = await supabase
      .from('users')
      .select('id, spotify_id, created_at, updated_at')
      .eq('id', userId);
    
    console.log('Users table info:', { usersTableInfo, usersTableError });
    
    // playlistsテーブルの状態を確認
    const { data: playlistsTableInfo, error: playlistsTableError } = await supabase
      .from('playlists')
      .select('id, user_id, name, created_at')
      .eq('user_id', userId);
    
    console.log('Playlists table info:', { playlistsTableInfo, playlistsTableError });
    
    // playlist_tracksテーブルの制約を確認
    console.log('=== Foreign Key Constraint Analysis ===');
    
    // 1. 現在のユーザーIDの形式を確認
    console.log('Current user ID format:', {
      userId,
      userIdType: typeof userId,
      userIdLength: userId.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    });
    
    // 2. データベース内のユーザーIDの形式を確認
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, spotify_id, created_at')
      .limit(5);
    
    console.log('Sample users from database:', { allUsers, allUsersError });
    
    console.log('=== End Foreign Key Constraint Analysis ===');
    console.log('=== End Database Integrity Check ===');

    // リクエストボディからデータを取得（track_idとtitleを追加）
    const { name, description, is_public = false, track_id, track_name, artists, song_id } = await request.json();
    
    console.log('Request data:', { name, description, is_public, track_id, track_name, artists, song_id });

    // プレイリストを作成
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name,
        description,
        is_public
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('Playlist created successfully:', playlist);

    // プレイリスト作成後に曲を追加
    let trackAdded = false;
    if (track_id && track_name) {
      console.log('Adding track to playlist:', { track_id, track_name, song_id, playlist_id: playlist.id });
      
      try {
        // 現在の最大positionを取得
        const { data: maxPosition, error: maxError } = await supabase
          .from('playlist_tracks')
          .select('position')
          .eq('playlist_id', playlist.id)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        const newPosition = (maxPosition?.position || 0) + 1;
        
        // 曲の追加データを準備
        const trackInsertData = {
          playlist_id: playlist.id,
          track_id: track_id,
          title: track_name,
          artists: artists || null,
          position: newPosition,
          added_at: new Date().toISOString(),
          added_by: userId,
          song_id: song_id || track_id
        };
        
        console.log('Track insert data:', trackInsertData);
        
        // 曲を追加
        const { data: trackResult, error: trackError } = await supabase
          .from('playlist_tracks')
          .insert(trackInsertData)
          .select()
          .single();
        
        if (trackError) {
          console.error('Track addition error:', trackError);
          
          // 外部キー制約違反の場合は、ユーザーの状態を再確認
          if (trackError.code === '23503') {
            console.log('Foreign key constraint violation detected. Checking user status...');
            
            const { data: userStatus, error: userStatusError } = await supabase
              .from('users')
              .select('id, spotify_id, spotify_email')
              .eq('id', userId)
              .single();
            
            console.log('User status check:', { userStatus, userStatusError });
            
            if (userStatusError || !userStatus) {
              console.error('User no longer exists in database. This indicates a serious data inconsistency.');
            } else {
              // ユーザーは存在するが外部キー制約違反が起きている
              console.log('User exists but foreign key constraint violation occurred. Attempting to resolve...');
              
              // データベースの状態を強制的に更新
              try {
                const { data: refreshResult, error: refreshError } = await supabase
                  .from('users')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', userId)
                  .select('id')
                  .single();
                
                if (refreshError) {
                  console.error('Failed to refresh user record:', refreshError);
                } else {
                  console.log('User record refreshed successfully:', refreshResult);
                  
                  // データベースの状態を詳細に確認
                  console.log('=== Detailed Database State Analysis ===');
                  
                  // 1. usersテーブルの詳細確認
                  const { data: userDetails, error: userDetailsError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();
                  
                  console.log('User details after refresh:', { userDetails, userDetailsError });
                  
                  // 2. 外部キー制約の確認
                  console.log('Foreign key constraint violation persists. User record exists but constraint still fails.');
                  
                  // 3. データベースの整合性を強制的に修復
                  console.log('Attempting to repair database integrity...');
                  
                  // ユーザーレコードを完全に再作成
                  const { data: repairResult, error: repairError } = await supabase
                    .from('users')
                    .upsert({
                      id: userId,
                      spotify_id: userStatus.spotify_id,
                      spotify_email: userStatus.spotify_email,
                      spotify_display_name: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }, {
                      onConflict: 'id',
                      ignoreDuplicates: false
                    })
                    .select('*')
                    .single();
                  
                  console.log('Database repair result:', { repairResult, repairError });
                  
                  if (!repairError && repairResult) {
                    console.log('Database integrity repaired successfully. Retrying track addition...');
                    
                    // 再度曲の追加を試行
                    const { data: retryResult, error: retryError } = await supabase
                      .from('playlist_tracks')
                      .insert(trackInsertData)
                      .select()
                      .single();
                    
                    if (retryError) {
                      console.error('Retry track addition failed after repair:', retryError);
                      
                      // 最終手段：直接SQLクエリで挿入
                      if (retryError.code === '23503') {
                        console.log('Direct SQL insertion not available. Foreign key constraint violation persists.');
                        console.log('This indicates a fundamental database schema or constraint issue that requires manual investigation.');
                      }
                    } else {
                      trackAdded = true;
                      console.log('Track added successfully on retry after repair:', retryResult);
                    }
                  } else {
                    console.error('Database repair failed:', repairError);
                  }
                  
                  console.log('=== End Detailed Database State Analysis ===');
                }
              } catch (refreshException) {
                console.error('Exception during user record refresh:', refreshException);
              }
            }
          }
          
          if (!trackAdded) {
            console.warn('Track addition failed, but playlist was created successfully');
          }
        } else {
          trackAdded = true;
          console.log('Track added successfully to playlist:', trackResult);
        }
      } catch (trackException) {
        console.error('Track addition exception:', trackException);
        console.warn('Track addition failed due to exception, but playlist was created successfully');
      }
    }

    // 成功レスポンス（曲の追加状況も含める）
    return Response.json({ 
      playlist, 
      track_added: trackAdded,
      message: trackAdded ? 'Playlist created and track added successfully' : 'Playlist created successfully (no track added)'
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}