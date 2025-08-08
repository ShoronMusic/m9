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
  if (!supabase) {
    console.warn('Supabase not configured, recordPlayHistory skipped');
    return { data: null, error: new Error('Supabase not configured') };
  }
  
  try {
    const { data, error } = await supabase
      .from('play_history')
      .insert(playData)
      .select();
    
    if (error) {
      console.error('Supabase recordPlayHistory error:', error);
    }
    
    return { data, error };
  } catch (error) {
    console.error('Supabase recordPlayHistory exception:', error);
    return { data: null, error };
  }
};

export const getPlayHistory = async (userId, limit = 50) => {
  if (!supabase) {
    console.warn('Supabase not configured, getPlayHistory skipped');
    return { data: [], error: new Error('Supabase not configured') };
  }
  
  try {
    const { data, error } = await supabase
      .from('play_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Supabase getPlayHistory error:', error);
    }
    
    return { data, error };
  } catch (error) {
    console.error('Supabase getPlayHistory exception:', error);
    return { data: [], error };
  }
};
