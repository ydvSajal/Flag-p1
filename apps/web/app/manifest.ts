import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PickLab Creator Studio',
    short_name: 'PickLab',
    description: 'Compare creative options and see what people pick.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f5',
    theme_color: '#faf9f5',
    icons: [192, 512].map(size => ({
      src: `/studio/picklab-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any',
    })),
  };
}
