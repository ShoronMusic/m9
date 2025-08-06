import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getStyleData } from '@/lib/api';
import { config } from '../../../config/config';
import StylePageClient from './StylePageClient';
import fs from 'fs/promises';
import path from 'path';

export async function generateStaticParams() {
  try {
    let styles;
    const isProduction = process.env.NODE_ENV === 'production';
    const DATA_DIR = process.env.DATA_DIR || 'https://xs867261.xsrv.jp/data/data';

    console.log('generateStaticParams - Environment:', process.env.NODE_ENV);
    console.log('generateStaticParams - isProduction:', isProduction);

    if (isProduction) {
      // 本番環境では外部サーバーから取得
      try {
        // まずstyles/index.jsonを試す
        const indexUrl = `${DATA_DIR}/styles/index.json`;
        console.log('generateStaticParams - Fetching from:', indexUrl);
        
        const indexResponse = await fetch(indexUrl, {
          headers: {
            'Accept': 'application/json',
          },
          next: { revalidate: 3600 } // 1時間キャッシュ
        });
        
        console.log('generateStaticParams - Index response status:', indexResponse.status);
        
        if (indexResponse.ok) {
          styles = await indexResponse.json();
          console.log('generateStaticParams - Styles loaded from index:', styles?.length || 0);
        } else {
          // styles/index.jsonが存在しない場合、styles_summary.jsonを使用
          console.log('generateStaticParams - Index not found, trying summary');
          const summaryUrl = `${DATA_DIR}/styles_summary.json`;
          const summaryResponse = await fetch(summaryUrl, {
            headers: {
              'Accept': 'application/json',
            },
            next: { revalidate: 3600 }
          });
          
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            styles = summaryData.map(style => ({
              slug: style.slug,
              count: style.totalSongs
            }));
            console.log('generateStaticParams - Styles loaded from summary:', styles?.length || 0);
          } else {
            console.error('generateStaticParams - Both index and summary failed');
            return [];
          }
        }
      } catch (error) {
        console.error('generateStaticParams - Fetch error:', error);
        return [];
      }
    } else {
      // ローカル開発ではローカルファイルを使用
      try {
        const stylesDir = path.join(process.cwd(), 'public', 'data', 'styles');
        console.log('generateStaticParams - Reading from:', stylesDir);
        const styleDirs = await fs.readdir(stylesDir);
        styles = [];
        for (const styleSlug of styleDirs) {
          const stylePath = path.join(stylesDir, styleSlug);
          const stat = await fs.stat(stylePath);
          if (!stat.isDirectory()) continue;
          
          // pagesディレクトリを確認
          const pagesDir = path.join(stylePath, 'pages');
          try {
            const pageFiles = await fs.readdir(pagesDir);
            const pageNumbers = pageFiles
              .map(f => parseInt(f.replace('.json', ''), 10))
              .filter(n => !isNaN(n))
              .sort((a, b) => a - b);
            if (pageNumbers.length > 0) {
              styles.push({
                slug: styleSlug,
                count: pageNumbers.length * 50
              });
              console.log(`generateStaticParams - Found style ${styleSlug} with ${pageNumbers.length} pages`);
            }
          } catch (error) {
            console.log(`generateStaticParams - No pages directory for ${styleSlug}`);
            continue;
          }
        }
      } catch (error) {
        console.error('generateStaticParams - Error reading local files:', error);
        return [];
      }
    }

    if (!Array.isArray(styles)) {
      console.log('generateStaticParams - styles is not an array:', styles);
      return [];
    }

    console.log('generateStaticParams - Found styles:', styles);

    const params = [];
    for (const style of styles) {
      if (!style.slug || typeof style.count !== 'number') {
        continue;
      }
      const itemsPerPage = 50;
      const totalPages = Math.ceil(style.count / itemsPerPage);
      for (let page = 1; page <= totalPages; page++) {
        if (page > 5) break; // 5ページまでのみSSG
        params.push({
          style: style.slug,
          page: page.toString()
        });
      }
    }
    
    console.log('generateStaticParams - Generated params:', params.length);
    return params;
  } catch (error) {
    console.error('generateStaticParams - Critical error:', error);
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { style, page } = params;
  const styleData = await getStyleData(style);

  if (!styleData) {
    return {
      title: 'Not Found',
      description: 'The requested style was not found.',
    };
  }

  return {
    title: `${styleData.name} (Page ${page}) | ${config.site.name}`,
    description: `${styleData.name}の曲一覧。${styleData.description || ''}`,
    openGraph: {
      title: `${styleData.name} (Page ${page}) | ${config.site.name}`,
      description: `${styleData.description || ''}`,
      type: 'website',
    },
  };
}

export default async function StylePage({ params, searchParams }) {
  const { style, page } = params;
  const pageNumber = parseInt(page, 10);
  if (isNaN(pageNumber) || pageNumber < 1) {
    notFound();
  }

  // URLパラメータからautoplayを読み取り
  const autoPlayFirst = searchParams?.autoplay === '1';

  let styleData = null;
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
  const DATA_DIR = process.env.DATA_DIR || 'https://xs867261.xsrv.jp/data/data';

  console.log('StylePage - Environment:', process.env.NODE_ENV);
  console.log('StylePage - VERCEL:', process.env.VERCEL);
  console.log('StylePage - isLocal:', isLocal);
  console.log('StylePage - DATA_DIR:', DATA_DIR);
  console.log('StylePage - style:', style, 'page:', pageNumber);

  // Vercel環境では常にリモートデータを使用
  const shouldUseRemote = !isLocal || process.env.VERCEL;

  if (shouldUseRemote) {
    try {
      const url = `${DATA_DIR}/styles/pages/${style}/${pageNumber}.json`;
      console.log('StylePage - Fetching from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TuneDive-App/1.0'
        },
        next: { revalidate: 3600 } // 1時間キャッシュ
      });
      
      console.log('StylePage - Response status:', response.status);
      console.log('StylePage - Response ok:', response.ok);
      
      if (!response.ok) {
        console.error('StylePage - Fetch failed:', response.status, response.statusText);
        
        // 外部サーバーから取得できない場合、ローカルファイルを使用
        console.log('StylePage - Trying local file as fallback');
        const filePath = path.join(process.cwd(), 'public', 'data', 'styles', 'pages', style, `${pageNumber}.json`);
        console.log('StylePage - Reading local file:', filePath);
        const file = await fs.readFile(filePath, 'utf8');
        styleData = JSON.parse(file);
        console.log('StylePage - Local data loaded as fallback, songs count:', styleData?.songs?.length || 0);
      } else {
        const responseText = await response.text();
        console.log('StylePage - Response text length:', responseText.length);
        
        try {
          styleData = JSON.parse(responseText);
          console.log('StylePage - Data parsed successfully, songs count:', styleData?.songs?.length || 0);
        } catch (parseError) {
          console.error('StylePage - JSON parse error:', parseError);
          console.error('StylePage - Response text preview:', responseText.substring(0, 200));
          throw new Error('Invalid JSON response');
        }
      }
    } catch (error) {
      console.error('StylePage - Fetch error:', error.message);
      console.error('StylePage - Error stack:', error.stack);
      
      // 最終的なフォールバックとしてローカルファイルを試す
      try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'styles', 'pages', style, `${pageNumber}.json`);
        console.log('StylePage - Final fallback to local file:', filePath);
        const file = await fs.readFile(filePath, 'utf8');
        styleData = JSON.parse(file);
        console.log('StylePage - Local data loaded as final fallback, songs count:', styleData?.songs?.length || 0);
      } catch (localError) {
        console.error('StylePage - Local file error:', localError);
        notFound();
      }
    }
  } else {
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'styles', 'pages', style, `${pageNumber}.json`);
      console.log('StylePage - Reading local file:', filePath);
      const file = await fs.readFile(filePath, 'utf8');
      styleData = JSON.parse(file);
      console.log('StylePage - Local data loaded, songs count:', styleData?.songs?.length || 0);
    } catch (error) {
      console.error('StylePage - Local file error:', error);
      notFound();
    }
  }

  if (!styleData || !styleData.name) {
    console.error('StylePage - Invalid styleData:', styleData);
    notFound();
  }

  return (
    <Suspense fallback={<div>Loading style songs...</div>}>
      <StylePageClient 
        styleData={styleData}
        initialPage={pageNumber}
        autoPlayFirst={autoPlayFirst}
      />
    </Suspense>
  );
} 
