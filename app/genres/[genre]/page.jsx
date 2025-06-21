import { redirect } from 'next/navigation';

export default function GenreRedirectPage({ params }) {
  const { genre } = params;
  redirect(`/genres/${genre}/1`);
} 