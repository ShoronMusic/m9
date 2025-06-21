import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getStyleData } from '@/lib/api';
import { config } from '@/config/config';
import StylePageClient from './StylePageClient';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

export async function generateStaticParams() {
  try {
    let styles;
    const isProduction = process.env.NODE_ENV === 'production';
    const DATA_DIR = process.env.DATA_DIR || 'https://xs867261.xsrv.jp/data/data';

    if (isProduction) {
      try {
        const response = await fetch(`${DATA_DIR}/styles/index.json`, {
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!response.ok) {
          return [];
        }
        styles = await response.json();
      } catch (error) {
        return [];
      }
    } else {
      try {
        const stylesDir = path.join(process.cwd(), 'public', 'data', 'styles');
        const styleDirs = await fs.readdir(stylesDir);
        styles = [];
        for (const styleSlug of styleDirs) {
          const stylePath = path.join(stylesDir, styleSlug);
          const stat = await fs.stat(stylePath);
          if (!stat.isDirectory()) continue;
          const pageFiles = await fs.readdir(stylePath);
          const pageNumbers = pageFiles
            .map(f => parseInt(f.replace('.json', ''), 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
          if (pageNumbers.length > 0) {
            styles.push({
              slug: styleSlug,
              count: pageNumbers.length * 50
            });
          }
        }
      } catch (error) {
        return [];
      }
    }

    if (!Array.isArray(styles)) {
      return [];
    }

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
    return params;
  } catch (error) {
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

export default async function StylePage({ params }) {
  const { style, page } = params;
  const pageNumber = parseInt(page, 10);
  if (isNaN(pageNumber) || pageNumber < 1) {
    notFound();
  }

  let styleData = null;
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
  const DATA_DIR = process.env.DATA_DIR || 'https://xs867261.xsrv.jp/data/data';

  if (!isLocal) {
    try {
      const response = await fetch(`${DATA_DIR}/styles/pages/${style}/${pageNumber}.json`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        notFound();
      }
      styleData = await response.json();
    } catch (error) {
      notFound();
    }
  } else {
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'styles', 'pages', style, `${pageNumber}.json`);
      const file = await fs.readFile(filePath, 'utf8');
      styleData = JSON.parse(file);
    } catch (error) {
      notFound();
    }
  }

  if (!styleData || !styleData.name) {
    notFound();
  }

  return (
    <Suspense fallback={<div>Loading style songs...</div>}>
      <StylePageClient 
        styleData={styleData}
        initialPage={pageNumber}
        autoPlayFirst={true}
      />
    </Suspense>
  );
} 
