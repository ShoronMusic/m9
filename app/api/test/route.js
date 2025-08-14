import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 Test API called');
  
  return Response.json({ 
    message: 'Test API is working!',
    timestamp: new Date().toISOString()
  });
}
