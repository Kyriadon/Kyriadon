// ============================================================================
// debug-logs.js
// Debug logs (/debug-logs): every user action, bug and error, grouped as
// info, warning and error. Anyone signed in can read; only staff can delete.
// Staff logins and their reviews are only listed for staff and admins; admins also
// see a bobbing red ! on a staff login nobody has reviewed yet.
// Developers get the raw view by default and the "relevant to this release"
// section. The header, footer and search palette come from components/siteShell.js.
// All visual values live in lib/siteDesign.js and styles/debugStyles.css.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import {
  IconAlert,
  IconCheck,
  IconChevron,
  IconClose,
  IconCode,
  IconCopy,
  IconDiscord,
  IconDownload,
  IconFilter,
  IconInfo,
  IconLock,
  IconRefresh,
  IconRows,
  IconSearch,
  IconTrash,
  IconWarning,
  Modal,
  SiteShell,
  logEvent,
} from '../components/siteShell';
import { ActionModal, ApprovalBang, ApprovalPanel } from '../components/staffReview';
import { pickApproval, useAccount, useApprovals } from '../lib/accountClient';

// ----------------------------------------------------------------------------
// Constants: levels, page size, storage key and export options
// ----------------------------------------------------------------------------
const levelMeta = {
  info: { label: 'Info', tone: 'info', Icon: IconInfo },
  warning: { label: 'Warning', tone: 'warning', Icon: IconWarning },
  error: { label: 'Error', tone: 'danger', Icon: IconAlert },
};
const levelKeys = ['info', 'warning', 'error'];
const PAGE_SIZE = 60;
const VIEW_KEY = 'kyriadon:logView';
const REFRESH_MS = 20000;
const CONTROLS_VIEW_KEY = 'kyriadon:controlsView';
const FAKE_BATCH = 25; // the log API accepts 25 events per request
const FAKE_MAX = 100;

const exportFields = [
  { id: 'time', label: 'Time' },
  { id: 'level', label: 'Level' },
  { id: 'code', label: 'Code' },
  { id: 'reason', label: 'Reason' },
  { id: 'fix', label: 'Fix' },
  { id: 'user', label: 'User' },
  { id: 'path', label: 'Page' },
  { id: 'release', label: 'Release' },
  { id: 'id', label: 'Log ID' },
];
const exportRanges = [
  { id: 'all', label: 'All time', ms: Infinity },
  { id: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
];
const mimeTypes = { json: 'application/json', csv: 'text/csv', txt: 'text/plain', jsonl: 'application/x-ndjson' };

// Extra download options for developers in the advanced controls
const advancedFields = [{ id: 'meta', label: 'Details' }];
const exportSorts = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
];
const exportLimits = [0, 25, 100, 500];

// ----------------------------------------------------------------------------
// Helpers: time, matching, counting, export building and downloads
// ----------------------------------------------------------------------------
const pad = (value) => String(value).padStart(2, '0');

const formatTime = (iso) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const relativeTime = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const shortRelease = (sha) => (!sha || sha === 'local' ? 'local' : sha.slice(0, 7));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A log matches when every search word appears somewhere in it
const matches = (log, query) => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = `${log.level} ${log.code} ${log.reason} ${log.fix} ${log.user?.name || ''} ${log.path}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
};

const countByLevel = (logs) => logs.reduce((totals, log) => ({ ...totals, [log.level]: (totals[log.level] || 0) + 1 }), { info: 0, warning: 0, error: 0 });

const userLabel = (log) => (log.user ? `${log.user.name} (${log.user.id})` : 'anonymous');

// Fields shown for one log in the raw view, in a stable order
const rawShape = (log) => {
  const shape = { id: log.id, level: log.level, code: log.code, reason: log.reason };
  if (log.fix) shape.fix = log.fix;
  shape.user = log.user || null;
  shape.time = log.time;
  shape.path = log.path;
  shape.release = log.release;
  if (log.meta && Object.keys(log.meta).length) shape.meta = log.meta;
  return shape;
};

// CSV cell: quoted, and a leading = + - @ is neutralised so spreadsheets never run it as a formula
const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const fieldValue = (log, id) => (id === 'user' ? userLabel(log) : id === 'meta' ? (Object.keys(log.meta || {}).length ? JSON.stringify(log.meta) : '') : log[id] ?? '');

// Builds the file content for the download editor
function buildExport(rows, format, fields, options = {}) {
  if (format === 'json') {
    return JSON.stringify(rows.map((log) => Object.fromEntries(fields.map((field) => [field, field === 'user' ? log.user : log[field] ?? '']))), null, options.compact ? 0 : 2);
  }
  if (format === 'jsonl') {
    return rows.map((log) => JSON.stringify(Object.fromEntries(fields.map((field) => [field, field === 'user' ? log.user : log[field] ?? ''])))).join('\n');
  }
  if (format === 'csv') {
    return [fields.map(csvCell).join(','), ...rows.map((log) => fields.map((field) => csvCell(fieldValue(log, field))).join(','))].join('\n');
  }
  return rows.map((log) => fields.map((field) => fieldValue(log, field)).filter(Boolean).join(' | ')).join('\n');
}

// Saves text as a file in the browser
function downloadFile(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Copies text, with a fallback for pages where the clipboard API is unavailable
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let done = false;
    try {
      done = document.execCommand('copy');
    } catch {
      done = false;
    }
    area.remove();
    return done;
  }
}

// ----------------------------------------------------------------------------
// Hook: loads logs, viewer roles and release info, and refreshes every 20 seconds
// ----------------------------------------------------------------------------
function useLogs() {
  const [state, setState] = useState({ status: 'loading', logs: [], viewer: null, release: null, updatedAt: null });

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/logs');
      if (response.status === 401) {
        setState({ status: 'locked', logs: [], viewer: null, release: null, updatedAt: null });
        return;
      }
      if (response.status === 403) {
        setState({ status: 'forbidden', logs: [], viewer: null, release: null, updatedAt: null });
        return;
      }
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();
      setState({ status: 'ready', logs: data.logs, viewer: data.viewer, release: data.release, updatedAt: new Date().toISOString() });
    } catch {
      setState((previous) => ({ ...previous, status: previous.logs.length ? 'ready' : 'error' }));
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  return { ...state, reload };
}

// ----------------------------------------------------------------------------
// Highlight: wraps search matches in a purple highlight
// ----------------------------------------------------------------------------
function Highlight({ text, query }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!words.length || !text) return text || null;
  return String(text)
    .split(new RegExp(`(${words.join('|')})`, 'ig'))
    .map((part, index) => (index % 2 ? <mark className="logHl" key={index}>{part}</mark> : part));
}

// ----------------------------------------------------------------------------
// LevelBadge: icon and label (meaning is never carried by colour alone)
// ----------------------------------------------------------------------------
function LevelBadge({ level }) {
  const { label, tone, Icon } = levelMeta[level];
  return (
    <span className="badge levelBadge" data-tone={tone}>
      <Icon size={12} />
      {label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// RoleLabel: Staff and Developer chips (same chip style as the rest of the site).
// The Developer role flows live, exactly as set up in the Role Studio.
// ----------------------------------------------------------------------------
function RoleLabel({ role }) {
  return (
    <span className="mention" data-tone={role} data-flow={role === 'developer' ? 'live' : undefined}>
      <span className="mentionName">{role === 'developer' ? 'Developer' : 'Staff'}</span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Left column: who is viewing, what they can do, and the running release
// ----------------------------------------------------------------------------
function AccessPanel({ session, viewer, activeView }) {
  const signedIn = Boolean(session?.user);
  // The avatar, display name and username chosen in the Account modal
  const { profile } = useAccount();
  const avatar = profile?.avatarUrl || session?.user?.image;
  return (
    <section className="panel panelGlow" aria-labelledby="accessTitle">
      <div className="panelHeader">
        <h3 id="accessTitle">Your access</h3>
      </div>
      <div className="accessUser">
        {avatar ? <img className="userAvatar" src={avatar} alt="" width="40" height="40" /> : <span className="userAvatar" />}
        <div className="accessName">
          <strong>{(signedIn && profile?.displayName) || session?.user?.name || 'Signed out'}</strong>
          <span>{signedIn ? (profile ? `@${profile.username} · Signed in with Discord` : 'Signed in with Discord') : 'Log in to view logs'}</span>
        </div>
      </div>
      <div className="accessRoles">
        {viewer?.staff && <RoleLabel role="staff" />}
        {viewer?.developer && <RoleLabel role="developer" />}
        {viewer?.admin && <span className="badge" data-tone="danger">Admin</span>}
        {viewer && !viewer.staff && !viewer.developer && !viewer.admin && <span className="badge" data-tone="neutral">Member</span>}
      </div>
      <dl className="accessList">
        <div><dt>Default view</dt><dd>{viewer?.developer ? 'Raw' : 'Advanced'}</dd></div>
        <div><dt>Current view</dt><dd>{activeView === 'raw' ? 'Raw' : 'Advanced'}</dd></div>
        <div><dt>Delete logs</dt><dd>{viewer?.staff ? 'Allowed' : 'Staff only'}</dd></div>
      </dl>
      {viewer && !viewer.configured && <p className="helperText">Role checks are not configured yet. Add the Staff and Developer role IDs in lib/logServer.js.</p>}
    </section>
  );
}

function ReleasePanel({ release }) {
  return (
    <section className="panel panelGlow" aria-labelledby="releaseTitle">
      <div className="panelHeader">
        <h3 id="releaseTitle">Current release</h3>
        {release && (
  <span className="badge" data-tone={release.env === 'production' ? 'info' : 'neutral'} data-env={release.env}>
    {release.env.charAt(0).toUpperCase() + release.env.slice(1)}
  </span>
)}
      </div>
      {release ? (
        <div className="releaseBody">
          <code className="mdCode">{shortRelease(release.sha)}</code>
          <p className="releaseMessage">{release.message || 'No commit message available.'}</p>
          {release.ref && <p className="helperText">Branch {release.ref}</p>}
        </div>
      ) : (
        <p className="helperText">Release details appear once logs are loaded.</p>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Level cards: info (blue), warning (yellow), error (red). Click to filter.
// ----------------------------------------------------------------------------
function LevelCards({ counts, total, level, onPick }) {
  return (
    <div className="levelCards" role="group" aria-label="Log totals">
      {levelKeys.map((key) => {
        const { label, Icon } = levelMeta[key];
        const share = total ? Math.round((counts[key] / total) * 100) : 0;
        return (
          <button key={key} type="button" className="levelCard" data-level={key} aria-pressed={level === key} onClick={() => onPick(level === key ? 'all' : key)} data-nolog>
            <span className="levelIcon"><Icon size={18} /></span>
            <span className="levelCount">{counts[key]}</span>
            <span className="levelLabel">{label} logs</span>
            <span className="levelShare">{share}% of all logs</span>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Advanced list: one clean card per log
// ----------------------------------------------------------------------------
function LogCards({ logs, query, onOpen, approvalOf }) {
  return (
    <ul className="logList">
      {logs.map((log) => {
        const { Icon } = levelMeta[log.level];
        const waiting = approvalOf(log)?.status === 'pending';
        return (
          <li key={log.id}>
            <button type="button" className="logRow" data-level={log.level} data-flagged={waiting} onClick={() => onOpen(log)} data-nolog>
              <span className="logRowIcon"><Icon size={16} /></span>
              <span className="logRowBody">
                <span className="logRowTop">
                  <code className="mdCode"><Highlight text={log.code} query={query} /></code>
                  <span className="logRowTime" title={formatTime(log.time)}>{relativeTime(log.time)}</span>
                </span>
                <span className="logRowReason"><Highlight text={log.reason || 'No reason recorded'} query={query} /></span>
                <span className="logRowMeta">
                  <span><Highlight text={log.user?.name || 'anonymous'} query={query} /></span>
                  <span aria-hidden="true">·</span>
                  <span><Highlight text={log.path || '/'} query={query} /></span>
                </span>
              </span>
              {waiting && <span className="logRowFlag"><ApprovalBang /></span>}
              <span className="logRowChevron"><IconChevron size={16} /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Raw list: a code box, one line per log, the code highlighted in purple
// ----------------------------------------------------------------------------
function RawBox({ logs, query, onOpen, approvalOf }) {
  return (
    <ul className="rawBox">
      {logs.map((log) => (
        <li key={log.id}>
          <button type="button" className="rawLine" data-level={log.level} onClick={() => onOpen(log)} data-nolog>
            {approvalOf(log)?.status === 'pending' && <span className="rawFlag"><ApprovalBang size={14} /></span>}
            <span className="rawTime">{formatTime(log.time)}</span>
            <span className="rawLevel">{log.level.toUpperCase()}</span>
            <span className="rawCode"><Highlight text={log.code} query={query} /></span>
            <span className="rawReason"><Highlight text={log.reason} query={query} /></span>
            <span className="rawUser"><Highlight text={log.user?.name || 'anonymous'} query={query} /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Raw JSON for one log, with the code value highlighted in purple
function RawJson({ log }) {
  const lines = JSON.stringify(rawShape(log), null, 2).split('\n');
  return (
    <pre className="rawJson" data-level={log.level}>
      {lines.map((line, index) => {
        const parts = line.match(/^(\s*)"([^"]+)": (.*?)(,?)$/);
        if (!parts) return <span key={index}>{`${line}\n`}</span>;
        const [, indent, key, value, comma] = parts;
        const valueClass = key === 'code' && indent.length === 2 ? 'rawCodeValue' : value.startsWith('"') ? 'rawString' : 'rawPlain';
        return (
          <span key={index}>
            {indent}<span className="rawKey">{`"${key}"`}</span>: <span className={key === 'reason' && indent.length === 2 ? `${valueClass} rawReasonValue` : valueClass}>{value}</span>{comma}{'\n'}
          </span>
        );
      })}
    </pre>
  );
}

// ----------------------------------------------------------------------------
// Log detail modal: code, reason, fix (errors), user and time. Copy and download
// for everyone, delete (gradient button, with a confirm step) for staff only.
// ----------------------------------------------------------------------------
function LogDetail({ log, viewer, activeView, query, approval, onDecide, onOpenAction, onClose, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const json = JSON.stringify(rawShape(log), null, 2);

  // The delete confirmation expires after 4 seconds
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const copy = async () => {
    if (await copyText(json)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      logEvent({ code: 'LOG_COPIED', reason: `Copied ${log.level} log ${log.code}` });
    }
  };

  const download = () => {
    downloadFile(`log-${log.code.toLowerCase()}-${log.id.slice(0, 8)}.json`, json, mimeTypes.json);
    logEvent({ code: 'LOG_DOWNLOADED', reason: `Downloaded ${log.level} log ${log.code}` });
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onDelete({ ids: [log.id] });
      onClose();
    } catch {
      setError('Delete failed. Only staff can delete logs.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      titleId="logDetailTitle"
      title="Log details"
      subtitle={`${formatTime(log.time)} · ${relativeTime(log.time)}`}
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <div className="footerGroup">
            <button type="button" className="btn btnSecondary" onClick={copy} data-autofocus>
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn btnSecondary" onClick={download}>
              <IconDownload size={16} />
              Download
            </button>
          </div>
          {viewer?.staff && (
            <button type="button" className="btn btnDanger" onClick={remove} disabled={busy}>
              <IconTrash size={16} />
              {confirming ? 'Confirm delete' : 'Delete'}
            </button>
          )}
        </>
      }
    >
      {/* Admins: approve or disapprove a staff login (shown in both views) */}
      {viewer?.admin && approval && <ApprovalPanel approval={approval} onDecide={onDecide} onOpenAction={onOpenAction} />}

      {activeView === 'raw' ? (
        <RawJson log={log} />
      ) : (
        <div className="detailGrid" data-level={log.level}>
          <section className="detailSection">
            <h5 className="studioLabel">Code</h5>
            <div className="detailInline">
              <LevelBadge level={log.level} />
              <code className="mdCode"><Highlight text={log.code} query={query} /></code>
            </div>
          </section>
          <section className="detailSection">
            <h5 className="studioLabel">Time</h5>
            <p className="detailText">{formatTime(log.time)}</p>
            <p className="helperText">{relativeTime(log.time)}</p>
          </section>
          <section className="detailSection detailWide">
            <h5 className="studioLabel">Reason</h5>
            <p className="detailText detailReason"><Highlight text={log.reason || 'No reason recorded.'} query={query} /></p>
          </section>
          {log.level === 'error' && (
            <section className="detailSection detailWide detailFix">
              <h5 className="studioLabel">Fix</h5>
              <p className="detailText">{log.fix || 'No suggested fix has been recorded for this error yet.'}</p>
            </section>
          )}
          <section className="detailSection">
            <h5 className="studioLabel">User</h5>
            <p className="detailText"><Highlight text={log.user ? log.user.name : 'Anonymous visitor'} query={query} /></p>
            {log.user && <code className="mdCode">{log.user.id}</code>}
          </section>
          <section className="detailSection">
            <h5 className="studioLabel">Context</h5>
            <p className="detailText">Page {log.path || '/'}</p>
            <p className="helperText">Release {shortRelease(log.release)}</p>
          </section>
          {log.meta && Object.keys(log.meta).length > 0 && (
            <section className="detailSection detailWide">
              <h5 className="studioLabel">Details</h5>
              <pre className="mdPre">{Object.entries(log.meta).map(([key, value]) => `${key}: ${value}`).join('\n')}</pre>
            </section>
          )}
          <section className="detailSection detailWide">
            <h5 className="studioLabel">Log ID</h5>
            <code className="mdCode">{log.id}</code>
          </section>
        </div>
      )}
      {error && <p className="helperText" role="alert">{error}</p>}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Download editor: choose type, time range, format, fields and file name.
// Developers in the advanced controls also get sort order, a row limit, a text
// filter, the details field, compact JSON and JSON lines.
// ----------------------------------------------------------------------------
function DownloadEditor({ logs, counts, advanced = false }) {
  const [scope, setScope] = useState('all');
  const [range, setRange] = useState('all');
  const [format, setFormat] = useState('json');
  const [fields, setFields] = useState(['time', 'level', 'code', 'reason', 'fix', 'user']);
  const [name, setName] = useState('kyriadon-logs');
  const [sort, setSort] = useState('newest');
  const [maxRows, setMaxRows] = useState(0);
  const [contains, setContains] = useState('');
  const [compact, setCompact] = useState(false);

  const rows = useMemo(() => {
    const limit = exportRanges.find((item) => item.id === range).ms;
    const list = logs.filter((log) => (scope === 'all' || log.level === scope) && Date.now() - new Date(log.time).getTime() <= limit);
    // Extra options (advanced controls): text filter, sort order and row limit
    const found = list.filter((log) => matches(log, contains));
    if (sort === 'oldest') found.reverse();
    return maxRows ? found.slice(0, maxRows) : found;
  }, [logs, scope, range, contains, sort, maxRows]);

  const ordered = useMemo(() => [...exportFields, ...advancedFields].map((field) => field.id).filter((id) => fields.includes(id)), [fields]);
  const content = useMemo(() => buildExport(rows, format, ordered, { compact }), [rows, format, ordered, compact]);
  const stamp = formatTime(new Date().toISOString()).slice(0, 10);
  const fileName = `${name.trim().replace(/[^a-z0-9-_]+/gi, '-') || 'kyriadon-logs'}${scope === 'all' ? '' : `-${scope}`}-${stamp}.${format}`;

  const toggleField = (id) => setFields((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));

  const download = () => {
    downloadFile(fileName, content, mimeTypes[format]);
    logEvent({ code: 'LOGS_DOWNLOADED', reason: `Downloaded ${rows.length} ${scope} log(s) as ${format.toUpperCase()}` });
  };

  return (
    <section className="controlSection" aria-labelledby="downloadTitle">
      <h4 id="downloadTitle" className="studioSectionTitle">Download</h4>
      <div className="studioRow">
        <div className="segmented" role="group" aria-label="Logs to download">
          {[['all', 'All', logs.length], ...levelKeys.map((key) => [key, levelMeta[key].label, counts[key]])].map(([id, label, count]) => (
            <button key={id} type="button" className="segment" aria-pressed={scope === id} onClick={() => setScope(id)}>{label} ({count})</button>
          ))}
        </div>
      </div>
      <div className="studioRow">
        <div className="segmented" role="group" aria-label="Time range">
          {exportRanges.map((item) => (
            <button key={item.id} type="button" className="segment" aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="File format">
          {['json', 'csv', 'txt', ...(advanced ? ['jsonl'] : [])].map((item) => (
            <button key={item} type="button" className="segment" aria-pressed={format === item} onClick={() => setFormat(item)}>{item.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className="fieldPicker" role="group" aria-label="Fields to include">
        {exportFields.map((field) => (
          <label key={field.id} className="fieldOption">
            <input type="checkbox" checked={fields.includes(field.id)} onChange={() => toggleField(field.id)} />
            {field.label}
          </label>
        ))}
        {advanced && advancedFields.map((field) => (
          <label key={field.id} className="fieldOption">
            <input type="checkbox" checked={fields.includes(field.id)} onChange={() => toggleField(field.id)} />
            {field.label}
          </label>
        ))}
        {advanced && format === 'json' && (
          <label className="fieldOption">
            <input type="checkbox" checked={compact} onChange={() => setCompact((value) => !value)} />
            Compact JSON
          </label>
        )}
      </div>
      {advanced && (
        <>
          <div className="studioRow">
            <div className="segmented" role="group" aria-label="Sort order">
              {exportSorts.map((item) => (
                <button key={item.id} type="button" className="segment" aria-pressed={sort === item.id} onClick={() => setSort(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Maximum number of logs">
              {exportLimits.map((item) => (
                <button key={item} type="button" className="segment" aria-pressed={maxRows === item} onClick={() => setMaxRows(item)}>{item ? `Max ${item}` : 'No limit'}</button>
              ))}
            </div>
          </div>
          <label className="studioField">
            <span className="studioLabel">Only logs containing</span>
            <input className="studioInput" type="text" value={contains} maxLength={60} placeholder="Code, reason, user or page" spellCheck={false} autoComplete="off" onChange={(event) => setContains(event.target.value)} />
          </label>
        </>
      )}
      <label className="studioField">
        <span className="studioLabel">File name</span>
        <input className="studioInput" type="text" value={name} maxLength={40} spellCheck={false} autoComplete="off" onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="previewBox">
        <div className="previewHead">
          <span>Preview</span>
          <span>{rows.length} Log{rows.length === 1 ? '' : 's'} · {Math.max(1, Math.round(content.length / 1024))} KB · {fileName}</span>
        </div>
        <pre className="rawJson">{rows.length && ordered.length ? content.slice(0, 700) + (content.length > 700 ? '\n…' : '') : 'No logs match these settings.'}</pre>
      </div>
      <button type="button" className="btn btnSecondary" onClick={download} disabled={!rows.length || !ordered.length}>
        <IconDownload size={16} />
        Download {rows.length} log{rows.length === 1 ? '' : 's'}
      </button>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Relevant logs (developers): problems are sorted by whether they belong to the
// release that is running now, so old issues are not "fixed" by mistake.
//   New in this release     first seen on this release: likely caused by recent changes
//   Also on earlier ones    seen before and still happening: confirm they reproduce
//   Not seen on this one    only on older releases: probably unrelated, do not chase
// Problems are grouped by code plus message, so one generic code (JS_ERROR) cannot
// hide a new bug behind an old one.
// ----------------------------------------------------------------------------
const fingerprint = (log) => `${log.code}|${(log.reason || '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}|\d+/gi, '#').slice(0, 120)}`;

function RelevantLogs({ logs, release, onPickCode }) {
  const { fresh, ongoing, old } = useMemo(() => {
    const map = new Map();
    logs.forEach((log) => {
      if (log.level === 'info') return;
      const key = fingerprint(log);
      const item = map.get(key) || { key, code: log.code, reason: log.reason, level: 'warning', current: 0, earlier: 0, last: log.time, lastRelease: log.release };
      if (log.release === release.sha) item.current += 1;
      else item.earlier += 1;
      if (log.level === 'error') item.level = 'error';
      if (log.time > item.last) {
        item.last = log.time;
        item.lastRelease = log.release;
      }
      map.set(key, item);
    });
    const sorted = [...map.values()].sort((a, b) => (a.level === b.level ? b.current + b.earlier - (a.current + a.earlier) : a.level === 'error' ? -1 : 1));
    return {
      fresh: sorted.filter((item) => item.current > 0 && item.earlier === 0),
      ongoing: sorted.filter((item) => item.current > 0 && item.earlier > 0),
      old: sorted.filter((item) => item.current === 0),
    };
  }, [logs, release.sha]);

  const renderRow = (item, tone) => (
    <button key={item.key} type="button" className="relevantRow" data-tone={tone} onClick={() => onPickCode(item.code)}>
      <span className="relevantTop">
        <LevelBadge level={item.level} />
        <code className="mdCode">{item.code}</code>
        <span className="relevantMeta">
          {item.current > 0 ? (
            <>
              <strong className="relevantCount">{item.current}×</strong> on this release
              {item.earlier > 0 && <> · also {item.earlier}× before</>} · last {relativeTime(item.last)}
            </>
          ) : (
            <>
              <strong className="relevantCount">{item.earlier}×</strong> · last on <code className="mdCode">{shortRelease(item.lastRelease)}</code>
            </>
          )}
        </span>
      </span>
      {item.reason && <span className="relevantReason">{item.reason}</span>}
    </button>
  );

  const renderGroup = (tone, title, hint, items) =>
    items.length > 0 && (
      <div className="relevantGroup" data-tone={tone}>
        <h5 className="studioLabel relevantGroupTitle">
          {title}
          <span className="relevantPill">{items.length}</span>
        </h5>
        <p className="helperText">{hint}</p>
        <div className="relevantList">{items.map((item) => renderRow(item, tone))}</div>
      </div>
    );

  return (
    <section className="controlSection" aria-labelledby="relevantTitle">
      <h4 id="relevantTitle" className="studioSectionTitle relevantTitle">
        Relevant to this release
        <RoleLabel role="developer" />
      </h4>
      <div className="relevantRelease">
        <span className="relevantReleaseLabel">Running now</span>
        <code className="mdCode">{shortRelease(release.sha)}</code>
        {release.message && <strong className="relevantCommit">{release.message}</strong>}
      </div>
      <div className="relevantStats">
        <span className="relevantStat" data-tone="new"><strong>{fresh.length}</strong> New</span>
        <span className="relevantStat" data-tone="ongoing"><strong>{ongoing.length}</strong> Ongoing</span>
        <span className="relevantStat" data-tone="old"><strong>{old.length}</strong> Older</span>
      </div>
      <p className="helperText relevantNote">
        Each problem is matched against the release that is running now. Fix the <strong data-tone="new">new</strong> ones first: they appeared with your latest changes. <strong data-tone="ongoing">Ongoing</strong> ones existed before this release, so check that they still happen. <strong data-tone="old">Older</strong> ones have not shown up on this release and are probably unrelated.
      </p>
      {release.sha === 'local' && (
        <p className="relevantLocal">
          <strong>Local build.</strong> Every log shares one release, so everything counts as new. On Vercel each deployment gets its own commit.
        </p>
      )}
      {fresh.length + ongoing.length === 0 && <p className="stateBox">All clear: no errors or warnings have been logged on this release.</p>}
      {renderGroup('new', 'New in this release', 'First seen on this release, so most likely caused by your latest changes. Start here.', fresh)}
      {renderGroup('ongoing', 'Also on earlier releases', 'Happened before this release and is still happening. Check that it reproduces before fixing it.', ongoing)}
      {renderGroup('old', 'Not seen on this release', 'Only logged on earlier releases. Probably unrelated to your latest changes, so do not chase these.', old)}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Statistics (advanced controls): pie chart by level, bars per day, bars per code
// ----------------------------------------------------------------------------
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Logs per local day for the last 7 days, split by level
function lastSevenDays(logs) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { key: dayKey(date), label: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, info: 0, warning: 0, error: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  logs.forEach((log) => {
    const day = byKey.get(dayKey(new Date(log.time)));
    if (day && levelKeys.includes(log.level)) day[log.level] += 1;
  });
  return days;
}

// The most common log codes, highest first
function topCodes(logs, size) {
  const totals = new Map();
  logs.forEach((log) => totals.set(log.code, (totals.get(log.code) || 0) + 1));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, size);
}

// Pie chart: one slice per level, drawn as thick circle strokes
function PieChart({ counts, total }) {
  const circumference = 2 * Math.PI * 8;
  let offset = 0;
  return (
    <svg className="chartPie" viewBox="0 0 32 32" role="img" aria-label={`Logs by level: ${levelKeys.map((key) => `${counts[key]} ${key}`).join(', ')}`}>
      <g transform="rotate(-90 16 16)">
        <circle className="chartPieTrack" cx="16" cy="16" r="8" />
        {levelKeys.map((key) => {
          if (!total || !counts[key]) return null;
          const length = (counts[key] / total) * circumference;
          const slice = <circle key={key} className="chartSlice" data-level={key} cx="16" cy="16" r="8" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-offset} />;
          offset += length;
          return slice;
        })}
      </g>
    </svg>
  );
}

// Bar chart: one stacked bar per day (info at the bottom, errors on top)
function DayBars({ days }) {
  const base = 90;
  const max = Math.max(1, ...days.map((day) => day.info + day.warning + day.error));
  return (
    <svg className="chartBars" viewBox="0 0 280 118" role="img" aria-label={`Logs per day: ${days.map((day) => `${day.label} ${day.info + day.warning + day.error}`).join(', ')}`}>
      <line className="chartAxis" x1="4" y1={base} x2="276" y2={base} />
      {days.map((day, index) => {
        const x = 10 + index * 38;
        const total = day.info + day.warning + day.error;
        let y = base;
        return (
          <g key={day.key}>
            {levelKeys.map((key) => {
              const height = (day[key] / max) * (base - 14);
              if (!height) return null;
              y -= height;
              return <rect key={key} className="chartBar" data-level={key} x={x} y={y} width="26" height={height} rx="2" />;
            })}
            {total > 0 && <text className="chartValue" x={x + 13} y={y - 3} textAnchor="middle">{total}</text>}
            <text className="chartLabel" x={x + 13} y="108" textAnchor="middle">{day.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StatsSection({ logs, counts }) {
  const total = logs.length;
  const days = useMemo(() => lastSevenDays(logs), [logs]);
  const codes = useMemo(() => topCodes(logs, 6), [logs]);
  const recent = useMemo(() => logs.filter((log) => Date.now() - new Date(log.time).getTime() <= 24 * 60 * 60 * 1000).length, [logs]);
  const errorShare = total ? Math.round((counts.error / total) * 100) : 0;

  return (
    <section className="controlSection" aria-labelledby="statsTitle">
      <h4 id="statsTitle" className="studioSectionTitle">Statistics</h4>
      {total === 0 ? (
        <p className="stateBox">No logs yet, so there is nothing to chart.</p>
      ) : (
        <>
          <div className="chartSummary">
            <span className="chartChip"><strong>{total}</strong> Logs</span>
            <span className="chartChip"><strong>{errorShare}%</strong> Errors</span>
            <span className="chartChip"><strong>{recent}</strong> Last 24 hours</span>
          </div>
          <div className="chartCard">
            <h5 className="studioLabel">By level</h5>
            <div className="chartPieWrap">
              <PieChart counts={counts} total={total} />
              <ul className="chartLegend">
                {levelKeys.map((key) => (
                  <li key={key}>
                    <span className="chartDot" data-level={key} />
                    <span>{levelMeta[key].label}</span>
                    <strong>{counts[key]}</strong>
                    <span className="chartPercent">{Math.round((counts[key] / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="chartCard">
            <h5 className="studioLabel">Last 7 days</h5>
            <DayBars days={days} />
            <p className="helperText">Logs per day, stacked by level.</p>
          </div>
          <div className="chartCard">
            <h5 className="studioLabel">Most common codes</h5>
            <ul className="chartList">
              {codes.map(([code, count]) => (
                <li key={code} className="chartRow">
                  <code className="mdCode">{code}</code>
                  <span className="chartTrack"><span className="chartFill" style={{ width: `${(count / codes[0][1]) * 100}%` }} /></span>
                  <span className="chartCount">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Delete individual logs (staff, advanced controls): find a log, then delete it
// with a confirm step. The server still checks the Staff role.
// ----------------------------------------------------------------------------
function ManageLogs({ logs, onDelete }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [limit, setLimit] = useState(10);
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  // The delete confirmation expires after 4 seconds
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => setPending(null), 4000);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => setLimit(10), [query, scope]);

  const found = useMemo(() => logs.filter((log) => (scope === 'all' || log.level === scope) && matches(log, query)), [logs, scope, query]);
  const shown = found.slice(0, limit);

  const remove = async (log) => {
    if (pending !== log.id) {
      setPending(log.id);
      return;
    }
    setPending(null);
    setBusyId(log.id);
    setMessage('');
    try {
      await onDelete({ ids: [log.id] });
      setMessage(`Deleted ${log.code}.`);
    } catch {
      setMessage('Delete failed. Only staff can delete logs.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="controlSection" aria-labelledby="manageTitle">
      <h4 id="manageTitle" className="studioSectionTitle relevantTitle">
        Delete individual logs
        <RoleLabel role="staff" />
      </h4>
      <div className="studioRow">
        <div className="segmented" role="group" aria-label="Level">
          {['all', ...levelKeys].map((id) => (
            <button key={id} type="button" className="segment" aria-pressed={scope === id} onClick={() => setScope(id)}>{id === 'all' ? 'All' : levelMeta[id].label}</button>
          ))}
        </div>
      </div>
      <label className="studioField">
        <span className="studioLabel">Find a log</span>
        <input className="studioInput" type="text" value={query} placeholder="Code, reason, user or page" spellCheck={false} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="helperText">{found.length} of {logs.length} log{logs.length === 1 ? '' : 's'}</p>
      {found.length === 0 ? (
        <p className="stateBox">No logs match.</p>
      ) : (
        <ul className="manageList">
          {shown.map((log) => {
            const { Icon } = levelMeta[log.level];
            return (
              <li key={log.id} className="manageRow" data-level={log.level}>
                <span className="manageIcon"><Icon size={16} /></span>
                <span className="manageBody">
                  <span className="manageTop">
                    <code className="mdCode">{log.code}</code>
                    <span className="manageTime">{relativeTime(log.time)}</span>
                  </span>
                  <span className="manageReason">{log.reason || 'No reason recorded'}</span>
                </span>
                <button type="button" className={`btn btnCompact btnIcon manageDelete ${pending === log.id ? 'btnDanger' : 'btnSecondary'}`} onClick={() => remove(log)} disabled={busyId === log.id} aria-label={pending === log.id ? `Confirm delete ${log.code} log` : `Delete ${log.code} log`}>
                  <IconTrash size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {found.length > shown.length && (
        <button type="button" className="btn btnSecondary showMore" onClick={() => setLimit((value) => value + 10)}>
          Show {Math.min(10, found.length - shown.length)} more
        </button>
      )}
      {message && <p className="helperText" role="status">{message}</p>}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Test logs (developers, advanced controls): fake errors, warnings and info sent
// to the real log store. Every fake log is tagged meta.fake so it can be found
// and deleted again. The server accepts 25 events per request.
// ----------------------------------------------------------------------------
const fakePresets = [
  { id: 'script', level: 'error', label: 'Script error', code: 'TEST_JS_ERROR', reason: "Uncaught TypeError: Cannot read properties of undefined (reading 'map')", fix: 'Check that the value exists before calling map on it.' },
  { id: 'server', level: 'error', label: 'Server error', code: 'TEST_HTTP_5XX', reason: '500 from /api/example', fix: 'Open the server route that returned 500 and fix the error it throws.' },
  { id: 'network', level: 'error', label: 'Network failure', code: 'TEST_FETCH_FAILED', reason: 'Network error (GET /api/example)', fix: 'Check that the endpoint is reachable, then add a retry or an error state.' },
  { id: 'missing', level: 'warning', label: 'Missing page', code: 'TEST_HTTP_4XX', reason: '404 from /api/missing' },
  { id: 'deprecated', level: 'warning', label: 'Console warning', code: 'TEST_CONSOLE_WARN', reason: 'A deprecated prop was passed to a component' },
  { id: 'action', level: 'info', label: 'Test action', code: 'TEST_ACTION', reason: 'Clicked a test button' },
];

// One fake log event. With spread on, the time is moved back up to 9 minutes (the server ignores older client times).
const fakeEvent = ({ level, code, reason, fix, detail }, path, spread) => ({
  level,
  code,
  reason,
  fix: level === 'error' ? fix || '' : '',
  path,
  at: new Date(Date.now() - (spread ? Math.floor(Math.random() * 9 * 60 * 1000) : 0)).toISOString(),
  meta: { fake: true, ...(detail?.key ? { [detail.key]: detail.value } : {}) },
});

async function sendFakeLogs(events) {
  for (let start = 0; start < events.length; start += FAKE_BATCH) {
    const response = await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: events.slice(start, start + FAKE_BATCH) }) });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  }
}

function FakeLogs({ logs, viewer, onDelete, onReload }) {
  const [draft, setDraft] = useState({ level: 'error', code: 'TEST_ERROR', reason: 'This is a fake error created from the log controls.', fix: '', path: '', detailKey: '', detailValue: '' });
  const [count, setCount] = useState('1');
  const [spread, setSpread] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fakeLogs = useMemo(() => logs.filter((log) => log.meta?.fake === true), [logs]);
  const fakeCounts = useMemo(() => countByLevel(fakeLogs), [fakeLogs]);
  const amount = Math.min(FAKE_MAX, Math.max(1, Math.round(Number(count)) || 1));
  const code = draft.code.trim().toUpperCase().replace(/[^A-Z0-9_.:-]/g, '_') || 'TEST_LOG';
  const detail = { key: draft.detailKey.trim().slice(0, 30), value: draft.detailValue.slice(0, 200) };

  // The delete confirmation expires after 5 seconds
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const send = async (events) => {
    if (busy || !events.length) return;
    setBusy(true);
    setMessage('');
    try {
      await sendFakeLogs(events);
      setSent((total) => total + events.length);
      setMessage(`Created ${events.length} fake log${events.length === 1 ? '' : 's'}.`);
      logEvent({ code: 'FAKE_LOGS_GENERATED', reason: `Generated ${events.length} fake log(s) from the log controls` });
      await onReload();
    } catch {
      setMessage('Could not create the fake logs. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    const path = draft.path.trim() || window.location.pathname;
    send(Array.from({ length: amount }, () => fakeEvent({ level: draft.level, code, reason: draft.reason, fix: draft.fix, detail }, path, spread)));
  };

  const randomMix = () => {
    const path = window.location.pathname;
    send(Array.from({ length: FAKE_BATCH }, () => fakeEvent(fakePresets[Math.floor(Math.random() * fakePresets.length)], path, true)));
  };

  const removeFakes = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    try {
      const ids = fakeLogs.map((log) => log.id);
      let deleted = 0;
      for (let start = 0; start < ids.length; start += 500) deleted += (await onDelete({ ids: ids.slice(start, start + 500) })) || 0;
      setMessage(`Deleted ${deleted} fake log${deleted === 1 ? '' : 's'}.`);
    } catch {
      setMessage('Delete failed. Only staff can delete logs.');
    } finally {
      setBusy(false);
    }
  };

  const preview = { level: draft.level, code, reason: draft.reason, ...(draft.level === 'error' && draft.fix ? { fix: draft.fix } : {}), path: draft.path.trim() || '(this page)', meta: { fake: true, ...(detail.key ? { [detail.key]: detail.value } : {}) } };

  return (
    <section className="controlSection" aria-labelledby="fakeTitle">
      <h4 id="fakeTitle" className="studioSectionTitle relevantTitle">
        Test logs
        <RoleLabel role="developer" />
      </h4>
      <p className="helperText">Creates fake logs in the real log store to test the list, filters, charts and downloads. Each one is tagged <code className="mdCode">fake</code> and shows your name as the user.</p>
      <div className="chartSummary">
        <span className="chartChip"><strong>{fakeLogs.length}</strong> Fake logs stored</span>
        <span className="chartChip">{fakeCounts.error} Errors · {fakeCounts.warning} Warnings · {fakeCounts.info} Info</span>
        <span className="chartChip"><strong>{sent}</strong> Sent this session</span>
      </div>

      <h5 className="studioLabel">Quick generate</h5>
      <div className="fakePresets">
        {fakePresets.map((preset) => {
          const { Icon } = levelMeta[preset.level];
          return (
            <button key={preset.id} type="button" className="btn btnSecondary btnCompact fakePreset" data-level={preset.level} disabled={busy} onClick={() => send([fakeEvent(preset, window.location.pathname, false)])}>
              <Icon size={14} />
              {preset.label}
            </button>
          );
        })}
        <button type="button" className="btn btnSecondary btnCompact" disabled={busy} onClick={randomMix}>
          Random mix ({FAKE_BATCH})
        </button>
      </div>

      <h5 className="studioLabel">Editor</h5>
      <div className="studioRow">
        <div className="segmented" role="group" aria-label="Level of the fake log">
          {levelKeys.map((key) => (
            <button key={key} type="button" className="segment" aria-pressed={draft.level === key} onClick={() => setDraft((current) => ({ ...current, level: key }))}>{levelMeta[key].label}</button>
          ))}
        </div>
      </div>
      <label className="studioField">
        <span className="studioLabel">Code</span>
        <input className="studioInput" type="text" value={draft.code} maxLength={60} spellCheck={false} autoComplete="off" onChange={update('code')} />
      </label>
      <label className="studioField">
        <span className="studioLabel">Reason</span>
        <input className="studioInput" type="text" value={draft.reason} maxLength={500} spellCheck={false} autoComplete="off" onChange={update('reason')} />
      </label>
      {draft.level === 'error' && (
        <label className="studioField">
          <span className="studioLabel">Suggested fix</span>
          <input className="studioInput" type="text" value={draft.fix} maxLength={400} placeholder="Optional" spellCheck={false} autoComplete="off" onChange={update('fix')} />
        </label>
      )}
      <label className="studioField">
        <span className="studioLabel">Page</span>
        <input className="studioInput" type="text" value={draft.path} maxLength={120} placeholder="Empty uses the current page" spellCheck={false} autoComplete="off" onChange={update('path')} />
      </label>
      <div className="fakeDetail">
        <label className="studioField">
          <span className="studioLabel">Detail name</span>
          <input className="studioInput" type="text" value={draft.detailKey} maxLength={30} placeholder="Optional" spellCheck={false} autoComplete="off" onChange={update('detailKey')} />
        </label>
        <label className="studioField">
          <span className="studioLabel">Detail value</span>
          <input className="studioInput" type="text" value={draft.detailValue} maxLength={200} spellCheck={false} autoComplete="off" onChange={update('detailValue')} />
        </label>
      </div>
      <div className="fakeDetail">
        <label className="studioField">
          <span className="studioLabel">How many (1 to {FAKE_MAX})</span>
          <input className="studioInput" type="number" min="1" max={FAKE_MAX} value={count} onChange={(event) => setCount(event.target.value)} />
        </label>
        <div className="fieldPicker" role="group" aria-label="Options">
          <label className="fieldOption">
            <input type="checkbox" checked={spread} onChange={() => setSpread((value) => !value)} />
            Spread over the last 9 minutes
          </label>
        </div>
      </div>
      <div className="previewBox">
        <div className="previewHead">
          <span>Sent to the log store</span>
          <span>{amount} Log{amount === 1 ? '' : 's'}</span>
        </div>
        <pre className="rawJson">{JSON.stringify(preview, null, 2)}</pre>
      </div>
      <div className="fakeActions">
        <button type="button" className="btn btnSecondary" disabled={busy} onClick={generate}>
          Generate {amount} {draft.level} log{amount === 1 ? '' : 's'}
        </button>
        {viewer?.staff ? (
          <button type="button" className={`btn ${confirming ? 'btnDanger' : 'btnSecondary'}`} disabled={busy || fakeLogs.length === 0} onClick={removeFakes}>
            <IconTrash size={16} />
            {confirming ? 'Confirm delete' : `Delete fake logs (${fakeLogs.length})`}
          </button>
        ) : (
          <span className="badge" data-tone="neutral"><IconLock size={12} />Staff only</span>
        )}
      </div>
      {message && <p className="helperText" role="status">{message}</p>}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Controls modal: delete (staff), download editor, relevant logs (developers).
// Staff and developers can switch it to the advanced view (developers start
// there): statistics for both, delete single logs for staff, test logs and a
// custom download for developers. Everyone else stays on the normal view.
// ----------------------------------------------------------------------------
function ControlsModal({ logs, counts, viewer, release, onClose, onDelete, onPickCode, onReload }) {
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');

  // Staff and developers can switch views (developers start on advanced, a saved choice wins)
  const canSwitch = Boolean(viewer?.staff || viewer?.developer);
  const [mode, setMode] = useState(() => {
    if (!canSwitch) return 'normal';
    let saved = null;
    try {
      saved = localStorage.getItem(CONTROLS_VIEW_KEY);
    } catch {
      /* storage can be unavailable */
    }
    return saved === 'normal' || saved === 'advanced' ? saved : viewer.developer ? 'advanced' : 'normal';
  });
  const advanced = canSwitch && mode === 'advanced';
  const developerTools = advanced && Boolean(viewer?.developer);
  const ModeIcon = advanced ? IconCode : IconRows;
  const modeLabel = advanced ? 'Advanced' : 'Normal';
  const advancedTools = ['statistics', viewer?.staff && 'single-log delete', viewer?.developer && 'test logs', viewer?.developer && 'custom downloads'].filter(Boolean);

  const switchMode = () => {
    const next = advanced ? 'normal' : 'advanced';
    setMode(next);
    logEvent({ code: 'CONTROLS_VIEW_SWITCHED', reason: `Switched the log controls to the ${next} view` });
    try {
      localStorage.setItem(CONTROLS_VIEW_KEY, next);
    } catch {
      /* storage can be unavailable */
    }
  };

  // Confirmation expires after 5 seconds
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => setPending(null), 5000);
    return () => clearTimeout(timer);
  }, [pending]);

  const options = [
    { key: 'error', label: 'Delete error logs', count: counts.error, payload: { level: 'error' } },
    { key: 'warning', label: 'Delete warning logs', count: counts.warning, payload: { level: 'warning' } },
    { key: 'info', label: 'Delete info logs', count: counts.info, payload: { level: 'info' } },
    { key: 'all', label: 'Delete all logs', count: logs.length, payload: { all: true } },
  ];

  const run = async (option) => {
    if (pending !== option.key) {
      setPending(option.key);
      return;
    }
    setPending(null);
    try {
      const deleted = await onDelete(option.payload);
      setMessage(`Deleted ${deleted} log${deleted === 1 ? '' : 's'}.`);
    } catch {
      setMessage('Delete failed. Only staff can delete logs.');
    }
  };

  return (
    <Modal
      titleId="controlsTitle"
      title="Log controls"
      subtitle="Delete, download and review logs."
      onClose={onClose}
      toolbar={
        <div className="modeBar">
          <button type="button" className="viewToggle modeToggle" data-tone={advanced ? 'advanced' : 'normal'} onClick={switchMode} disabled={!canSwitch} aria-label={canSwitch ? `Switch to ${advanced ? 'normal' : 'advanced'} view` : 'Normal view (staff and developers can switch)'} data-nolog>
            <ModeIcon size={18} />
            {modeLabel}
          </button>
          {canSwitch ? (
            <span className="modeHint">{advanced ? `Advanced: ${advancedTools.join(', ')}.` : 'Switch to advanced for more tools.'}</span>
          ) : (
            <span className="badge" data-tone="neutral"><IconLock size={12} />Staff or developer only</span>
          )}
        </div>
      }
      footer={
        <button type="button" className="btn btnSecondary" onClick={onClose} data-autofocus>
          Done
        </button>
      }
    >
      {advanced && <StatsSection logs={logs} counts={counts} />}

      <section className="controlSection" aria-labelledby="deleteTitle">
        <h4 id="deleteTitle" className="studioSectionTitle relevantTitle">
          Delete
          {viewer?.staff ? <RoleLabel role="staff" /> : <span className="badge" data-tone="neutral"><IconLock size={12} />Staff only</span>}
        </h4>
        <div className="deleteGrid">
          {options.map((option) => (
            <button key={option.key} type="button" className={`btn ${pending === option.key ? 'btnDanger' : 'btnSecondary'}`} disabled={!viewer?.staff || option.count === 0} onClick={() => run(option)}>
              <IconTrash size={16} />
              {pending === option.key ? 'Confirm delete' : `${option.label} (${option.count})`}
            </button>
          ))}
        </div>
        {message && <p className="helperText" role="status">{message}</p>}
      </section>

      {advanced && viewer?.staff && <ManageLogs logs={logs} onDelete={onDelete} />}

      <DownloadEditor key={developerTools ? 'advanced' : 'normal'} logs={logs} counts={counts} advanced={developerTools} />

      {developerTools && <FakeLogs logs={logs} viewer={viewer} onDelete={onDelete} onReload={onReload} />}

      {viewer?.developer && release && <RelevantLogs logs={logs} release={release} onPickCode={onPickCode} />}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------
export default function DebugLogs() {
  const { data: session, status: authStatus } = useSession();
  const { status, logs, viewer, release, updatedAt, reload } = useLogs();
  const [view, setView] = useState(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionId, setActionId] = useState(null);
  const filterRef = useRef(null);

  // Live review state of staff logins (admins): changes reach every admin within seconds,
  // the admin who decides sees it instantly, and a decision can never be given twice
  const review = useApprovals({ enabled: Boolean(viewer?.admin) });
  const approvalOf = useCallback((log) => (viewer?.admin ? pickApproval(log.approval, review.records[log.id]) : undefined), [viewer?.admin, review.records]);
  const me = useMemo(() => (viewer ? { id: viewer.id, name: viewer.name } : null), [viewer]);
  const decide = useCallback((approval, op) => review.decide(approval, op, me), [review, me]);

  // A staff login that just happened is not in the list yet (it refreshes every 20 seconds):
  // load the logs once when a review appears whose log is missing, so the ! shows up within seconds
  const chased = useRef(new Set());
  useEffect(() => {
    if (!viewer?.admin || status !== 'ready') return;
    const known = new Set(logs.map((log) => log.id));
    const fresh = Object.keys(review.records).filter((id) => !known.has(id) && !chased.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => chased.current.add(id));
    reload();
  }, [viewer?.admin, status, review.records, logs, reload]);

  // Load once the session is known (and again when it changes)
  useEffect(() => {
    if (authStatus !== 'loading') reload();
  }, [authStatus, reload]);

  // Default view: raw for developers, advanced for everyone else (a saved choice wins)
  useEffect(() => {
    if (!viewer || view) return;
    let saved = null;
    try {
      saved = localStorage.getItem(VIEW_KEY);
    } catch {
      /* storage can be unavailable */
    }
    setView(saved === 'raw' || saved === 'advanced' ? saved : viewer.developer ? 'raw' : 'advanced');
  }, [viewer, view]);

  const activeView = view || 'advanced';
  const switchView = () => {
    const next = activeView === 'raw' ? 'advanced' : 'raw';
    setView(next);
    logEvent({ code: 'VIEW_SWITCHED', reason: `Switched the logs to the ${next} view` });
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage can be unavailable */
    }
  };

  // Filter menu closes on outside click and Escape
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDown = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFilterOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  useEffect(() => setLimit(PAGE_SIZE), [query, level]);

  // Searches are logged once typing pauses
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    const timer = setTimeout(() => logEvent({ code: 'LOGS_SEARCHED', reason: `Searched logs for "${term.slice(0, 60)}"` }), 1200);
    return () => clearTimeout(timer);
  }, [query]);

  const changeLevel = useCallback((next) => {
    setLevel(next);
    logEvent({ code: 'FILTER_CHANGED', reason: `Filtered logs: ${next === 'all' ? 'all levels' : `${next} only`}` });
  }, []);

  const counts = useMemo(() => countByLevel(logs), [logs]);
  const filtered = useMemo(() => logs.filter((log) => (level === 'all' || log.level === level) && matches(log, query)), [logs, level, query]);
  const visible = filtered.slice(0, limit);
  const selected = logs.find((log) => log.id === selectedId) || null;
  const actionApproval = actionId ? approvalOf(logs.find((log) => log.id === actionId) || { id: actionId }) : null;

  const openLog = useCallback((log) => {
    setSelectedId(log.id);
    logEvent({ code: 'LOG_OPENED', reason: `Opened ${log.level} log ${log.code}` });
  }, []);

  const openControls = () => {
    setControlsOpen(true);
    logEvent({ code: 'CONTROLS_OPENED', reason: 'Opened the log controls' });
  };

  // Deletes logs on the server (staff only) and refreshes the list
  const removeLogs = useCallback(
    async (payload) => {
      const response = await fetch('/api/logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Delete failed');
      const data = await response.json();
      await reload();
      return data.deleted;
    },
    [reload],
  );

  const ViewIcon = activeView === 'raw' ? IconRows : IconCode;
  const viewLabel = activeView === 'raw' ? 'Switch to advanced view' : 'Switch to raw view';
  const filterOptions = [['all', 'All logs', logs.length], ...levelKeys.map((key) => [key, `${levelMeta[key].label} logs`, counts[key]])];

  return (
    <SiteShell title="Debug logs | Kyriadon" description="Every user action, bug and error on the Kyriadon website, grouped as info, warning and error.">
      <div className="debugGrid">
        {/* Hero: same component as the home and about pages, pink tone */}
        <section className="heroShell areaHero" aria-labelledby="heroTitle">
          <div className="heroPanel" data-tone="pink">
            <div className="heroGlow" aria-hidden="true" />
            <div className="heroContent">
              <h1 id="heroTitle">Debug logs</h1>
              <h2>Every action, bug and error in one place.</h2>
              <p>User actions, warnings and errors are recorded automatically and grouped by severity. Search, filter and inspect what happened, export logs, and focus on what matters for the current release.</p>
            </div>
          </div>
        </section>

        {/* Left: access and release */}
        <aside className="debugSide">
          <AccessPanel session={session} viewer={viewer} activeView={activeView} />
          <ReleasePanel release={release} />
        </aside>

        {/* Main: stats, search, filter and the log list */}
        <section className="panel panelGlow debugMain" aria-labelledby="logsTitle">
          <div className="panelHeader logHeader">
            <div className="logHeaderStart">
              <button type="button" className="viewToggle" onClick={switchView} aria-label={viewLabel} title={viewLabel} data-nolog>
                <ViewIcon size={18} />
              </button>
              <h3 id="logsTitle">Logs</h3>
              {status === 'ready' && <span className="badge" data-tone="neutral">{filtered.length} of {logs.length}</span>}
            </div>
            <div className="logHeaderEnd">
              {updatedAt && <span className="logUpdated">Updated {formatTime(updatedAt).slice(11)}</span>}
              <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={reload} aria-label="Refresh logs" title="Refresh logs" data-nolog>
                <IconRefresh size={16} />
              </button>
              <button type="button" className="btn btnSecondary btnCompact" onClick={openControls} disabled={status !== 'ready'}>
                Open controls
              </button>
            </div>
          </div>

          {status === 'loading' && (
            <div className="logList" aria-busy="true">
              {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton skeletonCard" />)}
            </div>
          )}

          {status === 'locked' && (
            <div className="stateBox lockedBox" role="status">
              <IconLock size={22} />
              <strong>Log in to view logs</strong>
              <span>Logs are available to signed-in Discord users. Deleting is limited to staff.</span>
              <button type="button" className="btn btnPrimary" onClick={() => signIn('discord')}>
                <IconDiscord size={20} />
                Login
              </button>
            </div>
          )}

          {status === 'forbidden' && (
            <div className="stateBox lockedBox" role="status">
              <IconLock size={22} />
              <strong>No access</strong>
              <span>The debug logs are limited to the Staff and Developer roles.</span>
            </div>
          )}

          {status === 'error' && (
            <div className="stateBox" role="alert">
              <span>Logs could not be loaded.</span>
              <button type="button" className="btn btnSecondary btnCompact" onClick={reload}>Try again</button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <LevelCards counts={counts} total={logs.length} level={level} onPick={changeLevel} />

              <div className="logToolbar">
                <label className="boostField logSearch">
                  <IconSearch size={18} />
                  <input className="searchInput" type="text" value={query} placeholder="Search code, reason, user or page..." aria-label="Search logs" autoComplete="off" spellCheck={false} data-nolog onChange={(event) => setQuery(event.target.value)} />
                  {query && (
                    <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => setQuery('')} aria-label="Clear search" data-nolog>
                      <IconClose size={16} />
                    </button>
                  )}
                </label>
                <div className="filterWrap" ref={filterRef}>
                  <button type="button" className="btn btnSecondary btnIcon filterButton" data-active={level !== 'all'} aria-expanded={filterOpen} aria-label="Filter logs" title="Filter logs" onClick={() => setFilterOpen((open) => !open)} data-nolog>
                    <IconFilter size={18} />
                  </button>
                  {filterOpen && (
                    <div className="filterMenu" role="group" aria-label="Filter by level" data-nolog>
                      {filterOptions.map(([id, label, count]) => (
                        <button key={id} type="button" className="filterItem" aria-pressed={level === id} onClick={() => { changeLevel(id); setFilterOpen(false); }}>
                          <span>{label}</span>
                          <span className="filterCount">{count}</span>
                          {level === id && <IconCheck size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {logs.length === 0 && <div className="stateBox">No logs yet. Actions, warnings and errors will appear here as they happen.</div>}
              {logs.length > 0 && filtered.length === 0 && <div className="stateBox">No logs match your search and filter.</div>}

              {filtered.length > 0 && (activeView === 'raw' ? <RawBox logs={visible} query={query} onOpen={openLog} approvalOf={approvalOf} /> : <LogCards logs={visible} query={query} onOpen={openLog} approvalOf={approvalOf} />)}

              {filtered.length > visible.length && (
                <button type="button" className="btn btnSecondary showMore" onClick={() => setLimit((value) => value + PAGE_SIZE)} data-nolog>
                  Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {selected && <LogDetail log={selected} viewer={viewer} activeView={activeView} query={query} approval={approvalOf(selected)} onDecide={decide} onOpenAction={(approval) => setActionId(approval.id)} onClose={() => setSelectedId(null)} onDelete={removeLogs} />}

      {/* After a disapproval: kick the session or block the login (admins) */}
      {viewer?.admin && actionApproval && <ActionModal approval={actionApproval} onAct={review.act} onClose={() => setActionId(null)} />}

      {controlsOpen && (
        <ControlsModal
          logs={logs}
          counts={counts}
          viewer={viewer}
          release={release}
          onClose={() => setControlsOpen(false)}
          onDelete={removeLogs}
          onReload={reload}
          onPickCode={(code) => {
            setQuery(code);
            changeLevel('all');
            setControlsOpen(false);
          }}
        />
      )}
    </SiteShell>
  );
}
