// Local development: serves the Vite app and the /api functions on one port,
// mirroring how Vercel routes them in production.
//   npm run dev  →  http://localhost:3000
import { config } from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { Handler } from './server/http.js';

config({ path: '.env.local' });
config();

const routes: Record<string, () => Promise<{ default: Handler }>> = {
  '/api/account': () => import('./api/account.js'),
  '/api/orders': () => import('./api/orders.js'),
  '/api/news': () => import('./api/news.js'),
  '/api/cron/eod': () => import('./api/cron/eod.js'),
};

async function main() {
  const app = express();
  app.use(express.json());

  for (const [path, load] of Object.entries(routes)) {
    app.all(path, async (req, res) => {
      const { default: handler } = await load();
      await handler(req as never, res);
    });
  }

  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Colombo Exchange dev server → http://localhost:${port}`));
}

main();
