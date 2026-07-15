export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hirdanmarketing.com';
  
  const routes = [
    '',
    '/about',
    '/contact',
    '/service',
    '/project',
    '/news',
    '/pricing',
    '/team',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
