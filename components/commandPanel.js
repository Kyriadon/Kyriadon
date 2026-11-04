// ============================================================================
// commandPanel.js
// The Command panel of the debug logs (developers only, phone and computer). You type
// @prefix:command, for example @delete:reset-logs. The @ always has the same colour, every
// prefix has its own and the command has a light tint of it. Commands that change the page
// (view, filter, search ...) run here; commands that touch the server (delete, log, ping) go to
// /api/commands, which checks the Developer role again. The list of commands is in
// lib/commandRegistry.js. All visual values live in styles/commandStyles.css.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, logEvent } from './siteShell';
import { AT_COLOR, commandTint, findCommand, parseCommand, rolesOf, suggest, tokenize, usablePrefixes } from '../lib/commandRegistry';

const HISTORY_KEY = 'kyriadon:commandHistory';
const HISTORY_MAX = 40;
const OUTPUT_MAX = 200;
const DAY = 24 * 60 * 60 * 1000;

// Commands that only change the page are written here; the server ones are in pages/api/commands.js.
// A line made of coloured pieces (used by the input, the output, the suggestions and the guide)
function Tokens({ line }) {
  return (
    <>
      {tokenize(line).map((token, index) => (
        <span key={index} style={{ color: token.color }}>
          {token.text}
        </span>
      ))}
    </>
  );
}

// "Delete   RESET-logs" and "delete reset-logs" are the same command
const normalise = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase();

// Counts the values a function picks from each row, most common first
const topOf = (rows, pick, size) => {
  const totals = {};
  rows.forEach((row) => {
    const key = pick(row);
    if (key) totals[key] = (totals[key] || 0) + 1;
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, size);
};

// The commands of one prefix, as output lines
const commandLines = (prefix) => prefix.commands.map((command) => ({ kind: 'help', line: `@${prefix.id}:${command.id}${command.args ? ` ${command.args}` : ''}`, text: command.desc }));

// ----------------------------------------------------------------------------
// Commands that run in the browser. Each returns the lines to print.
// ----------------------------------------------------------------------------
async function runClient(prefix, command, args, ctx) {
  const { logs, counts } = ctx;
  const ok = (text) => [{ kind: 'ok', text }];
  const info = (...texts) => texts.map((text) => ({ kind: 'info', text }));

  switch (`${prefix.id}:${command.id}`) {
    // View
    case 'view:raw':
    case 'view:advanced':
      ctx.setView(command.id);
      return ok(`Showing the ${command.id} view.`);
    case 'view:toggle': {
      const next = ctx.activeView === 'raw' ? 'advanced' : 'raw';
      ctx.setView(next);
      return ok(`Showing the ${next} view.`);
    }

    // Staff and admin shortcuts into the search
    case 'staff:me':
      ctx.setQuery(ctx.viewer?.name || '');
      return ok('Showing the logs you caused.');
    case 'staff:logins':
      ctx.setQuery('STAFF_');
      return ok('Showing staff logins and reviews.');
    case 'admin:audit':
      ctx.setQuery('COMMAND_');
      return ok('Showing every command that was run.');
    case 'admin:denied':
      ctx.setQuery('_DENIED');
      return ok('Showing every refused attempt.');

    // Level filter
    case 'filter:all':
      ctx.setLevel('all');
      return ok('Showing every level.');
    case 'filter:errors':
    case 'filter:warnings':
    case 'filter:info': {
      const level = { errors: 'error', warnings: 'warning', info: 'info' }[command.id];
      ctx.setLevel(level);
      return ok(`Showing ${level} logs only.`);
    }
    case 'filter:reset':
      ctx.setLevel('all');
      ctx.setQuery('');
      return ok('Cleared the filter and the search.');

    // Search
    case 'search:for':
    case 'search:code':
    case 'search:user':
    case 'search:page':
      ctx.setQuery(args);
      return ok(`Searching for "${args}".`);
    case 'search:clear':
    case 'clear:search':
      ctx.setQuery('');
      return ok('Emptied the search.');

    // Order and amount
    case 'sort:newest':
    case 'sort:oldest':
    case 'sort:errors-first':
      ctx.setOrder(command.id);
      return ok(`Order: ${command.id.replace('-', ' ')}.`);
    case 'limit:all':
      ctx.setLimit(Infinity);
      return ok('Showing every log.');

    // Download and copy
    case 'export:json':
    case 'export:csv':
    case 'export:txt':
    case 'export:jsonl': {
      const count = ctx.exportRows(command.id);
      return ok(`Downloaded ${count} log${count === 1 ? '' : 's'} as ${command.id.toUpperCase()}.`);
    }
    case 'export:copy': {
      const copied = await ctx.copyJson();
      return copied ? ok(`Copied ${ctx.filtered.length} logs as JSON.`) : [{ kind: 'error', text: 'The browser did not allow copying.' }];
    }

    // Refresh
    case 'refresh:logs':
      await ctx.reload();
      return ok('Loaded the logs again.');
    case 'refresh:page':
      window.location.reload();
      return ok('Reloading...');

    // Numbers
    case 'stats:logs':
      return info(`${logs.length} logs: ${counts.info} info, ${counts.warning} warning, ${counts.error} error.`, `${ctx.filtered.length} of them match the current search and filter.`);
    case 'stats:today': {
      const recent = logs.filter((log) => Date.now() - new Date(log.time).getTime() < DAY);
      const per = (level) => recent.filter((log) => log.level === level).length;
      return info(`${recent.length} logs in the last 24 hours: ${per('info')} info, ${per('warning')} warning, ${per('error')} error.`);
    }
    case 'stats:codes':
      return topOf(logs, (log) => log.code, 8).map(([name, total]) => ({ kind: 'info', text: `${String(total).padStart(4, ' ')}  ${name}` }));
    case 'stats:users': {
      const people = topOf(logs, (log) => log.user?.name, 6);
      return [{ kind: 'info', text: `${new Set(logs.map((log) => log.user?.id).filter(Boolean)).size} different users.` }, ...people.map(([name, total]) => ({ kind: 'info', text: `${String(total).padStart(4, ' ')}  ${name}` }))];
    }
    case 'stats:pages':
      return topOf(logs, (log) => log.path, 6).map(([name, total]) => ({ kind: 'info', text: `${String(total).padStart(4, ' ')}  ${name}` }));
    case 'stats:release': {
      const lines = Object.entries(ctx.release || {})
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) && String(value))
        .map(([key, value]) => ({ kind: 'info', text: `${key}: ${value}` }));
      return lines.length ? lines : info('No release information.');
    }

    // Help
    case 'help:all':
      return [{ kind: 'info', text: 'Type @prefix:command. Type a prefix to see its commands, for example @search' }, ...usablePrefixes(ctx.viewer).map((item) => ({ kind: 'help', line: `@${item.id}`, text: item.title }))];
    case 'help:prefixes':
      return usablePrefixes(ctx.viewer).flatMap((item) => [{ kind: 'gap' }, ...commandLines(item)]);
    case 'help:whoami': {
      const have = rolesOf(ctx.viewer);
      return info(`You are ${ctx.viewer?.name || 'signed in'}.`, `Roles: ${have.length ? have.join(', ') : 'none'}.`, `You can use: ${usablePrefixes(ctx.viewer).map((item) => `@${item.id}`).join(' ')}`);
    }
    case 'help:shortcuts':
      return info('Enter runs the command.', 'Tab completes the first suggestion.', 'Up and Down bring back earlier commands.', 'Esc closes the panel.', 'On a computer, pressing @ on the logs page opens the panel.');

    // Tidy up
    case 'clear:output':
      ctx.clearOutput();
      return [];
    case 'clear:history':
      ctx.clearHistory();
      return ok('Forgot the commands you ran.');

    default:
      if (prefix.id === 'limit') {
        ctx.setLimit(Number(command.id));
        return ok(`Showing ${command.id} logs at a time.`);
      }
      return [{ kind: 'error', text: 'That command is not available.' }];
  }
}

// ----------------------------------------------------------------------------
// The small guide: how a command is built, every prefix with its commands
// ----------------------------------------------------------------------------
function CommandGuide({ onPick, viewer }) {
  const prefixes = usablePrefixes(viewer);
  return (
    <div className="cmdGuide">
      <p className="helperText cmdGuideText">
        A command is <strong>@prefix:command</strong>. Some commands need more after a space. Tap any command here to put it in the box.
      </p>
      <p className="cmdSample" aria-label="Example command">
        <Tokens line="@search:for login" />
      </p>
      <ul className="cmdLegend">
        <li>
          <span style={{ color: AT_COLOR }}>@</span> always has this colour
        </li>
        <li>
          <span style={{ color: prefixes[0]?.color }}>prefix</span> has its own colour
        </li>
        <li>
          <span style={{ color: commandTint(prefixes[0]?.color || '#ffffff') }}>command</span> is a light tint of it
        </li>
        <li>
          <span className="cmdArgsColor">arguments</span> are grey
        </li>
      </ul>
      <p className="helperText cmdGuideText">Commands that delete ask you to run them twice. Press Enter again (or tap Confirm) to go ahead. You only see the prefixes your role can use.</p>
      {prefixes.map((prefix) => (
        <section key={prefix.id} className="cmdGroup">
          <h4 className="cmdGroupTitle">
            <span style={{ color: AT_COLOR }}>@</span>
            <span style={{ color: prefix.color }}>{prefix.id}</span>
            <span className="cmdGroupHint">{prefix.title}</span>
            <span className="cmdWho">{prefix.who}</span>
          </h4>
          <ul className="cmdList">
            {prefix.commands.map((command) => (
              <li key={command.id}>
                <button type="button" className="cmdPick" onClick={() => onPick(`@${prefix.id}:${command.id}${command.args ? ' ' : ''}`)} data-nolog>
                  <span className="cmdPickLine">
                    <Tokens line={`@${prefix.id}:${command.id}${command.args ? ` ${command.args}` : ''}`} />
                  </span>
                  <span className="cmdPickText">{command.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// The panel
// ----------------------------------------------------------------------------
export default function CommandPanel({ ctx, initialLine = '', onClose }) {
  const [line, setLine] = useState(initialLine);
  const [output, setOutput] = useState([{ id: 0, kind: 'info', text: 'Command panel ready. Type @ to see the prefixes, or tap Guide.' }]);
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string').slice(-HISTORY_MAX) : [];
    } catch {
      return [];
    }
  });
  const [historyAt, setHistoryAt] = useState(-1);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const inputRef = useRef(null);
  const mirrorRef = useRef(null);
  const outputRef = useRef(null);
  const nextId = useRef(1);
  const suggestions = useMemo(() => suggest(line, ctx.viewer).slice(0, 14), [line, ctx.viewer]);

  // Adds lines to the screen (the last 200 stay)
  const push = (...entries) => setOutput((previous) => [...previous, ...entries.map((entry) => ({ id: nextId.current++, ...entry }))].slice(-OUTPUT_MAX));

  // The screen scrolls to the newest line
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, guideOpen]);

  // The coloured copy behind the input scrolls with it (long lines)
  const syncMirror = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  };

  // Remembers a command for the arrow keys (and for the next visit)
  const remember = (text) => {
    setHistory((previous) => {
      const next = [...previous.filter((item) => item !== text), text].slice(-HISTORY_MAX);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* storage can be unavailable */
      }
      return next;
    });
  };

  // The helpers the commands use on the page, plus the two that belong to this panel
  const fullCtx = {
    ...ctx,
    clearOutput: () => setOutput([]),
    clearHistory: () => {
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch {
        /* storage can be unavailable */
      }
    },
  };

  // Runs a command that was already parsed
  const execute = async (text, parsed) => {
    const { prefix, args } = parsed;
    let { command } = parsed;
    if (!command && prefix.id === 'help') command = findCommand(prefix, 'all');
    if (!command) {
      push({ kind: 'info', text: `@${prefix.id}: ${prefix.title}` }, ...commandLines(prefix));
      return;
    }
    if (command.required && !args) {
      push({ kind: 'error', text: `Usage: @${prefix.id}:${command.id} ${command.args}` });
      return;
    }
    try {
      if (command.where === 'server') {
        const started = performance.now();
        const response = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: prefix.id, command: command.id, args }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          push({ kind: 'error', text: data.error || `The server answered ${response.status}.` });
          return;
        }
        const took = Math.round(performance.now() - started);
        push({ kind: 'ok', text: prefix.id === 'stats' ? `${data.message} ${took} ms round trip.` : data.message });
        if (data.deleted !== undefined || data.reload) await ctx.reload();
        // The staff notes board refreshes when a command changed a note
        if (data.notes) window.dispatchEvent(new Event('kyriadon:notes-changed'));
        return;
      }
      logEvent({ code: 'COMMAND_RUN', reason: `Ran the command ${text.slice(0, 80)}` });
      const lines = await runClient(prefix, command, args, fullCtx);
      if (lines.length) push(...lines);
    } catch (error) {
      push({ kind: 'error', text: `That did not work: ${error?.message || 'unknown error'}` });
    }
  };

  // Enter: run the line. A command that deletes needs a second Enter (or the Confirm button).
  const submit = async (override) => {
    if (busy) return;
    let text = String(override ?? line).trim();
    if (!text && pending) text = pending.text;
    if (!text) return;
    setLine('');
    setHistoryAt(-1);
    setGuideOpen(false);
    const parsed = parseCommand(text, ctx.viewer);
    if (parsed.ok && parsed.command?.danger && !(pending && pending.key === normalise(text))) {
      remember(text);
      setPending({ text, key: normalise(text) });
      push({ kind: 'echo', line: text }, { kind: 'warn', text: parsed.command.id === 'set-limiter' ? 'This changes how logs are deleted from now on, and can delete logs right away. Press Enter again, or tap Confirm, to run it.' : 'This deletes logs for good. Press Enter again, or tap Confirm, to run it.' });
      return;
    }
    const confirmed = Boolean(pending && parsed.ok && pending.key === normalise(text));
    setPending(null);
    remember(text);
    if (!confirmed) push({ kind: 'echo', line: text });
    if (!parsed.ok) {
      push({ kind: 'error', text: parsed.error });
      return;
    }
    setBusy(true);
    try {
      await execute(text, parsed);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // Arrow keys bring back earlier commands, Tab completes the first suggestion
  const onKeyDown = (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      const next = Math.min(historyAt + 1, history.length - 1);
      setHistoryAt(next);
      setLine(history[history.length - 1 - next]);
    } else if (event.key === 'ArrowDown' && historyAt >= 0) {
      event.preventDefault();
      const next = historyAt - 1;
      setHistoryAt(next);
      setLine(next < 0 ? '' : history[history.length - 1 - next]);
    } else if (event.key === 'Tab' && suggestions.length && line.trim()) {
      event.preventDefault();
      setLine(suggestions[0].insert);
    }
  };

  // Put a suggestion or a command from the guide into the box
  const pick = (text) => {
    setLine(text);
    setGuideOpen(false);
    inputRef.current?.focus();
  };

  return (
    <Modal
      titleId="commandsTitle"
      title="Command panel"
      subtitle="Type @prefix:command, for example @help. You only see the prefixes your role can use."
      onClose={onClose}
      footer={
        <>
          <div className="footerGroup">
            <button type="button" className="btn btnSecondary" onClick={() => setGuideOpen((open) => !open)} aria-pressed={guideOpen} data-nolog>
              {guideOpen ? 'Back to the panel' : 'Guide'}
            </button>
          </div>
          <button type="button" className="btn btnSecondary" onClick={onClose} data-nolog>
            Done
          </button>
        </>
      }
    >
      <div className="cmdPanel">
        {guideOpen ? (
          <div className="cmdScreen" ref={outputRef}>
            <CommandGuide onPick={pick} viewer={ctx.viewer} />
          </div>
        ) : (
          <div className="cmdScreen" ref={outputRef} role="log" aria-live="polite">
            {output.map((entry) =>
              entry.kind === 'gap' ? (
                <div key={entry.id} className="cmdGap" />
              ) : entry.kind === 'echo' ? (
                <p key={entry.id} className="cmdRow cmdEcho">
                  <Tokens line={entry.line} />
                </p>
              ) : entry.kind === 'help' ? (
                <p key={entry.id} className="cmdRow cmdHelp">
                  <span className="cmdHelpLine">
                    <Tokens line={entry.line} />
                  </span>
                  <span className="cmdHelpText">{entry.text}</span>
                </p>
              ) : (
                <p key={entry.id} className="cmdRow" data-kind={entry.kind}>
                  {entry.text}
                </p>
              ),
            )}
          </div>
        )}

        {/* Suggestions: tap one to complete the line (the prefixes when the box is empty) */}
        {!guideOpen && suggestions.length > 0 && (
          <div className="cmdSuggest" role="group" aria-label="Suggestions">
            {suggestions.map((item) => (
              <button key={item.insert} type="button" className="cmdChip" onClick={() => pick(item.insert)} title={item.desc} data-nolog>
                {item.label ? <span style={{ color: item.color }}>{item.label}</span> : <Tokens line={item.insert} />}
              </button>
            ))}
          </div>
        )}

        {pending && (
          <button type="button" className="btn btnDanger cmdConfirm" onClick={() => submit(pending.text)} disabled={busy} data-nolog>
            Confirm {pending.text}
          </button>
        )}

        <form
          className="cmdForm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="cmdField">
            <div className="cmdMirror" ref={mirrorRef} aria-hidden="true">
              <Tokens line={line} />
            </div>
            <input
              ref={inputRef}
              className="cmdInput"
              type="text"
              value={line}
              onChange={(event) => {
                setLine(event.target.value);
                setHistoryAt(-1);
                syncMirror();
              }}
              onKeyDown={onKeyDown}
              onKeyUp={syncMirror}
              onScroll={syncMirror}
              onSelect={syncMirror}
              placeholder="@prefix:command"
              aria-label="Command"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={400}
              data-autofocus
              data-nolog
            />
          </div>
          <button type="submit" className="btn btnPrimary cmdRun" disabled={busy} data-nolog>
            Run
          </button>
        </form>
      </div>
    </Modal>
  );
}
