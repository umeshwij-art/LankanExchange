// GET /api/cron/eod — called by Vercel Cron after the CSE closes.
// Manual re-run: curl -H "Authorization: Bearer $CRON_SECRET" "https://…/api/cron/eod?force=1"
import { runEndOfDay } from '../../server/eod.js';
import { queryParam, requireCronSecret, send, withErrors } from '../../server/http.js';

export const config = { maxDuration: 300 };

export default withErrors(['GET', 'POST'], async (req, res) => {
  requireCronSecret(req);
  const force = queryParam(req, 'force') === '1';
  const result = await runEndOfDay({ force });
  console.log('[eod]', JSON.stringify(result));
  send(res, 200, result);
});
