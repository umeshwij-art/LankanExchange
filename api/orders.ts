// POST   /api/orders          place an order   { symbol, side, type, quantity, limitPrice? }
// DELETE /api/orders?id=…     cancel an open order
import { cancelOrder, placeOrder } from '../server/accounts.js';
import { HttpError, queryParam, readJson, requireUser, send, withErrors } from '../server/http.js';
import { validateRequest } from '../shared/trading.js';

export default withErrors(['POST', 'DELETE'], async (req, res) => {
  const user = await requireUser(req);

  if (req.method === 'DELETE') {
    const id = queryParam(req, 'id');
    if (!id) throw new HttpError(400, 'Missing order id');
    return send(res, 200, await cancelOrder(user.uid, id));
  }

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
  const order = validateRequest(body);
  send(res, 200, await placeOrder(user.uid, order));
});
