// ============================================================================
// /api/staff/approvals   (admins only)
//   GET   ?rev=N  review records of recent staff logins. When nothing changed since
//                 revision N the answer is tiny, so admins can poll every few seconds.
//   POST  { id, op }  op: "approve" | "disapprove"            one decision, final
//                     op: "kick"                              after a disapproval
//                     op: "block", durationMs, message        after a disapproval, 7 days at most
// Every decision and action is written to the staff-only debug logs.
// ============================================================================
import { getViewerRoles } from '../../../lib/logServer';
import { getUser, isSameOrigin, jsonBody, limit, withErrors } from '../../../lib/accountServer';
import { MAX_BLOCK_MS, MIN_BLOCK_MS, cleanMessage, currentRevision, decide, describeDuration, listApprovals, staffLogSafe, takeAction } from '../../../lib/staffServer';

const ID_PATTERN = /^[0-9a-f-]{36}$/i;

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await getUser(req, res);
  if (!user) return res.status(401).json({ error: 'Log in first' });

  if (req.method === 'GET') {
    const roles = await getViewerRoles(user.id);
    if (!roles.admin) return res.status(403).json({ error: 'Admins only' });
    const rev = await currentRevision();
    if (String(req.query.rev) === String(rev)) return res.status(200).json({ rev, changed: false });
    return res.status(200).json({ rev, changed: true, approvals: await listApprovals(100) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Cross-site request refused' });

  // Decisions check the role against Discord right now, not from the 60 second cache
  const roles = await getViewerRoles(user.id, { fresh: true });
  if (!roles.admin) {
    if (!(await limit(`reviewdeny:${user.id}`, 1, 5 * 60 * 1000)).limited) await staffLogSafe({ level: 'warning', code: 'STAFF_REVIEW_DENIED', reason: `${user.name} tried to review a staff login without being an admin.`, user });
    return res.status(403).json({ error: 'Admins only' });
  }
  if ((await limit(`review:${user.id}`, 60, 60 * 1000)).limited) return res.status(429).json({ error: 'Too many requests' });

  const body = jsonBody(req);
  if (!body || typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) return res.status(400).json({ error: 'Send JSON with a valid id' });
  const admin = { id: user.id, name: user.name };
  const { id } = body;

  // Approve or disapprove
  if (body.op === 'approve' || body.op === 'disapprove') {
    const status = body.op === 'approve' ? 'approved' : 'disapproved';
    const result = await decide(id, status, admin);
    if (result.ok) {
      const who = result.target.userName;
      await staffLogSafe({
        level: status === 'approved' ? 'info' : 'warning',
        code: status === 'approved' ? 'STAFF_APPROVED' : 'STAFF_DISAPPROVED',
        reason: `${admin.name} ${status} the staff login of ${who}.`,
        user: admin,
        meta: { requestId: id, target: result.target.userId, targetName: who },
      });
    }
    return res.status(200).json({ ...result, target: undefined });
  }

  // Kick the session or block the login
  if (body.op === 'kick' || body.op === 'block') {
    let durationMs = 0;
    let message = '';
    if (body.op === 'block') {
      durationMs = Math.round(Number(body.durationMs));
      if (!Number.isFinite(durationMs) || durationMs < MIN_BLOCK_MS || durationMs > MAX_BLOCK_MS) return res.status(200).json({ ok: false, code: 'invalid_duration', message: 'Choose a duration between 1 minute and 7 days.' });
      message = cleanMessage(body.message);
      if (!message) return res.status(200).json({ ok: false, code: 'invalid_message', message: 'Write the message the staff member will see.' });
    }
    const result = await takeAction(id, { type: body.op, durationMs, message }, admin);
    if (result.ok) {
      const { approval } = result;
      if (body.op === 'kick') {
        await staffLogSafe({ level: 'warning', code: 'STAFF_KICKED', reason: `${admin.name} kicked the staff session of ${approval.userName}${result.ended ? '' : ' (it had already ended)'}.`, user: admin, meta: { requestId: id, target: approval.userId, targetName: approval.userName, ended: result.ended } });
      } else {
        await staffLogSafe({
          level: 'warning',
          code: 'STAFF_BLOCKED',
          reason: `${admin.name} blocked ${approval.userName} from staff login for ${describeDuration(durationMs)}: ${message}`,
          user: admin,
          meta: { requestId: id, target: approval.userId, targetName: approval.userName, until: new Date(approval.action.until).toISOString(), ended: result.ended },
        });
      }
    }
    return res.status(200).json(result);
  }

  return res.status(400).json({ error: 'Unknown operation' });
}

export default withErrors('/api/staff/approvals', handler, { staffOnly: true });
