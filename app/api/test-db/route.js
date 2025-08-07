import { supabase } from '../../lib/supabase';

export async function GET() {
  try {
    // テーブルが存在するかテスト
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database connection error:', error);
      return Response.json({ 
        success: false, 
        error: error.message,
        details: 'Database connection failed'
      }, { status: 500 });
    }
    
    return Response.json({ 
      success: true, 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 });
  }
}
