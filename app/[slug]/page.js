import { notFound, redirect } from 'next/navigation';
import ArtistDetailClient from "./ArtistDetailClient";

const API_BASE_URL = 'https://xs867261.xsrv.jp/data/data';

async function getArtistData(slug) {
  try {
    // 無効なslugの場合は早期リターン
    if (!slug || slug.includes('.') || slug.includes('/') || slug.length < 2) {
      console.log('Invalid slug detected:', slug);
      return null;
    }

    const filePath = `${API_BASE_URL}/artists/${slug}/1.json`;
    console.log('Fetching artist data from:', filePath);

    const res = await fetch(filePath, {
      next: { revalidate: 0 },
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    console.log('Response status:', res.status);

    if (!res.ok) {
      console.error('Failed to fetch artist data:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    console.log('Artist data received:', {
      name: data?.name,
      slug: data?.slug,
      hasAcf: !!data?.acf
    });

    if (!data || typeof data !== 'object') {
      console.error('Invalid data format');
      return null;
    }

    if (!data.name || !data.slug) {
      console.error('Missing required fields:', {
        hasName: !!data.name,
        hasSlug: !!data.slug
      });
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching artist data:', error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = params;
  const artistData = await getArtistData(slug);

  if (!artistData) {
    return {
      title: 'Artist Not Found',
      description: 'The requested artist could not be found.'
    };
  }

  return {
    title: `${artistData.name} | TuneDive`,
    description: `Artist: ${artistData.name} | Country: ${artistData.acf?.artistorigin || 'Unknown'} | Active: ${artistData.acf?.artistactiveyearstart || 'Unknown'}`
  };
}

export default async function ArtistDetailPage({ params }) {
  const { slug } = params;
  
  // ページ番号がない場合は/1にリダイレクト
  if (!slug.includes('/')) {
    redirect(`/${slug}/1`);
  }

  const artistData = await getArtistData(slug);

  if (!artistData) {
    notFound();
  }

  return (
      <ArtistDetailClient artistData={artistData} />
  );
} 