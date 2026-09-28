// POST /api/account — create (or reset a legacy) account on sign-in.
import { ensureAccount } from '../server/accounts.js';
import { requireUser, send, withErrors } from '../server/http.js';

export default withErrors(['POST'], async (req, res) => {
  const user = await requireUser(req);
  const result = await ensureAccount(user);
  send(res, 200, result);
});
