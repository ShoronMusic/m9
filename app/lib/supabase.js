import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバーサイド用（Service Role Key使用）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ユーティリティ関数
export const getUserBySpotifyId = async (spotifyId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('spotify_id', spotifyId)
    .single();
  
  return { data, error };
};

export const createUser = async (userData) => {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();
  
  return { data, error };
};

export const recordPlayHistory = async (playData) => {
  const { data, error } = await supabase
    .from('play_history')
    .insert(playData)
    .select();
  
  return { data, error };
};

export const getPlayHistory = async (userId, limit = 50) => {
  const { data, error } = await supabase
    .from('play_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return { data, error };
};
