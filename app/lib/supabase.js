import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase環境変数が設定されていない場合の処理
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not configured. Play history tracking will be disabled.');
  console.warn('Missing variables:', {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
  });
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// サーバーサイド用（Service Role Key使用）
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ユーティリティ関数
export const getUserBySpotifyId = async (spotifyId) => {
  if (!supabase) {
    console.warn('Supabase not configured, getUserBySpotifyId skipped');
    return { data: null, error: new Error('Supabase not configured') };
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('spotify_id', spotifyId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Supabase getUserBySpotifyId error:', error);
    }
    
    return { data, error };
  } catch (error) {
    console.error('Supabase getUserBySpotifyId exception:', error);
    return { data: null, error };
  }
};

export const createUser = async (userData) => {
  if (!supabase) {
    console.warn('Supabase not configured, createUser skipped');
    return { data: null, error: new Error('Supabase not configured') };
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase createUser error:', error);
    }
    
    return { data, error };
  } catch (error) {
    console.error('Supabase createUser exception:', error);
    return { data: null, error };
  }
};

export const recordPlayHistory = async (playData) => {
  console.log('Supabase recordPlayHistory called with data:', playData);
  
  if (!supabase) {
    console.warn('Supabase not configured, recordPlayHistory skipped');
    return { data: null, error: new Error('Supabase not configured') };
  }
  
  try {
    console.log('Supabase: Inserting play history data...');
    
    // 重複チェック: 同じ曲が短時間で連続記録されることを防ぐ
    const duplicateCheck = await supabase
      .from('play_history')
      .select('id, created_at')
      .eq('user_id', playData.user_id)
      .eq('track_id', playData.track_id)
      .eq('song_id', playData.song_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (duplicateCheck.data && duplicateCheck.data.length > 0) {
      const lastRecord = duplicateCheck.data[0];
      const timeDiff = Date.now() - new Date(lastRecord.created_at).getTime();
      const minInterval = 5 * 60 * 1000; // 5分間隔
      
      if (timeDiff < minInterval) {
        console.log('Supabase: Duplicate record detected, skipping. Time since last record:', timeDiff / 1000, 'seconds');
        return { 
          data: lastRecord, 
          error: null, 
          skipped: true, 
          reason: 'Duplicate record within time limit' 
        };
      }
    }
    
    // テーブル構造に合わせてデータを整形
    const insertData = {
      user_id: playData.user_id,
      track_id: playData.track_id,
      song_id: playData.song_id,
      play_duration: playData.play_duration,
      completed: playData.completed,
      source: playData.source,
      artist_name: playData.artist_name,
      track_title: playData.track_title,
      is_favorite: playData.is_favorite || false,
      style_id: playData.style_id || null,
      style_name: playData.style_name || null,
      genre_id: playData.genre_id || null,
      genre_name: playData.genre_name || null
    };
    
    console.log('Supabase: Inserting data with correct schema:', insertData);
    
    const { data, error } = await supabase
      .from('play_history')
      .insert(insertData)
      .select();
    
    if (error) {
      console.error('Supabase recordPlayHistory error:', error);
      console.error('Supabase recordPlayHistory error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    } else {
      console.log('Supabase recordPlayHistory success:', data);
    }
    
    return { data, error };
  } catch (error) {
    console.error('Supabase recordPlayHistory exception:', error);
    console.error('Supabase recordPlayHistory exception details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return { data: null, error };
  }
};

export const getPlayHistory = async (userId, limit = 50) => {
  if (!supabase) {
    console.warn('Supabase not configured, getPlayHistory skipped');
    return { data: [], error: new Error('Supabase not configured') };
  }
  
  try {
    // 視聴履歴を取得
    const { data: playHistory, error } = await supabase
      .from('play_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // 重複フィルタリングのため、より多くのデータを取得
    
    if (error) {
      console.error('Supabase getPlayHistory error:', error);
      return { data: [], error };
    }

    // 重複フィルタリング: 同じ曲が連続で表示されることを防ぐ
    const filteredHistory = [];
    const seenTracks = new Set();
    
    for (const record of playHistory) {
      const trackKey = `${record.track_id || record.song_id}`;
      
      if (!seenTracks.has(trackKey)) {
        filteredHistory.push(record);
        seenTracks.add(trackKey);
        
        // 指定された制限に達したら停止
        if (filteredHistory.length >= limit) {
          break;
        }
      }
    }

    // 各視聴履歴に対して、Spotify APIからお気に入り情報を取得
    const playHistoryWithFavorites = await Promise.all(
      filteredHistory.map(async (record) => {
        try {
          // データベースのis_favoriteを優先し、フロントエンドでSpotify APIから取得した情報で上書き
          return {
            ...record,
            is_favorite: record.is_favorite || false // データベースの値を優先
          };
        } catch (error) {
          console.error('Error processing play history record:', error);
          return {
            ...record,
            is_favorite: record.is_favorite || false
          };
        }
      })
    );
    
    return { data: playHistoryWithFavorites, error: null };
  } catch (error) {
    console.error('Supabase getPlayHistory exception:', error);
    return { data: [], error };
  }
};
