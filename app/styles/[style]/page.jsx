import { redirect } from 'next/navigation';

export default async function StylePage({ params }) {
  const { style } = await params;
  redirect(`/styles/${style}/1`);
} 
