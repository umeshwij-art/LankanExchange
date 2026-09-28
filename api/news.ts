// GET /api/news — business headlines plus CSE company announcements.
// Cached at Vercel's edge for 30 minutes so feeds are fetched rarely.
import { fetchAnnouncements } from '../server/cse.js';
import { fetchNews } from '../server/news.js';
import { send, withErrors } from '../server/http.js';

export default withErrors(['GET'], async (_req, res) => {
  const [news, announcements] = await Promise.allSettled([fetchNews(), fetchAnnouncements()]);
  send(
    res,
    200,
    {
      news: news.status === 'fulfilled' ? news.value.items : [],
      failedSources: news.status === 'fulfilled' ? news.value.failed : ['all'],
      announcements: announcements.status === 'fulfilled' ? announcements.value : [],
      fetchedAt: new Date().toISOString(),
    },
    { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  );
});
