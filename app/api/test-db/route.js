import { supabase, supabaseAdmin } from '../../lib/supabase';

export async function GET() {
  try {
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    const configStatus = {
      supabaseClient: !!supabase,
      supabaseAdminClient: !!supabaseAdmin,
      environmentVariables: envVars
    };

    console.log('Supabase configuration status:', configStatus);

    if (!supabase || !supabaseAdmin) {
      return Response.json({
        status: 'error',
        message: 'Supabase not configured',
        details: configStatus
      }, { status: 500 });
    }

    // テストクエリを実行
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        return Response.json({
          status: 'error',
          message: 'Database connection failed',
          error: error.message,
          details: configStatus
        }, { status: 500 });
      }

      return Response.json({
        status: 'success',
        message: 'Supabase connection successful',
        details: configStatus
      }, { status: 200 });

    } catch (dbError) {
      return Response.json({
        status: 'error',
        message: 'Database query failed',
        error: dbError.message,
        details: configStatus
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({
      status: 'error',
      message: 'API error',
      error: error.message
    }, { status: 500 });
  }
}
