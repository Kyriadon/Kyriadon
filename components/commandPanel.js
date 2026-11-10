// ============================================================================
// commandPanel.js
// The Command panel of the debug logs (developers only, phone and computer). You type
// @prefix:command, for example @delete:reset-logs. The @ always has the same colour, every
// prefix has its own and the command has a light tint of it. Commands that change the page
// (view, filter, search ...) run here; commands that touch the server (delete, log, ping) go to
// /api/commands, which checks the Developer role again. The list of commands is in
// lib/commandRegistry.js. All visual values live in styles/commandStyles.css.
// A command can end with a suffix ($ * & /) that changes how it runs (see SUFFIXES in the
// registry). They are handled in submit() and execute() below and never work in freestyle mode.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, logEvent } from './siteShell';
import { AT_COLOR, SUFFIXES, SUFFIX_COLOR, commandTint, findCommand, findPrefix, parseCommand, rolesOf, suggest, tokenize, usablePrefixes } from '../lib/commandRegistry';
import { formatValue, highlightJs, runJs } from '../lib/consoleRunner';

const HISTORY_KEY = 'kyriadon:commandHistory';
const HISTORY_MAX = 40;
const OUTPUT_MAX = 200;
const DAY = 24 * 60 * 60 * 1000;

// Commands that only change the page are written here; the server ones are in pages/api/commands.js.
// A line made of coloured pieces (used by the input, the output, the suggestions and the guide)
function Tokens({ line, suffixes = true }) {
  return (
    <>
      {tokenize(line, { suffixes }).map((token, index) => (
        <span key={index} style={{ color: token.color }}>
          {token.text}
        </span>
      ))}
    </>
  );
}

// JavaScript made of coloured pieces (freestyle mode)
function JsTokens({ line }) {
  return (
    <>
      {highlightJs(line).map((piece, index) => (
        <span key={index} style={{ color: piece.color }}>
          {piece.text}
        </span>
      ))}
    </>
  );
}

// What the freestyle console says when it opens, and the examples under the empty input
const FREESTYLE_BANNER = [
  { kind: 'info', text: 'Freestyle console. Type JavaScript and press Enter, like the F12 console in your browser.' },
  { kind: 'warn', text: 'It runs in this browser tab as you. Only run code you wrote or trust, and never code someone else sent you.' },
  { kind: 'info', text: "Helpers: $('css'), $$('css'), copy(value) and clear(). Lines that start with @ still run panel commands, for example @convert:contained." },
];
const CONVERT_COLOR = findPrefix('convert')?.color;
const FREESTYLE_CHIPS = [
  { insert: '@convert:contained', label: '@convert:contained', color: CONVERT_COLOR, desc: 'Back to the normal command panel' },
  { insert: 'document.title', label: 'document.title', desc: 'The title of this page' },
  { insert: 'location.href', label: 'location.href', desc: 'The address of this page' },
  { insert: "$$('a').length", label: "$$('a').length", desc: 'How many links are on the page' },
  { insert: 'localStorage', label: 'localStorage', desc: 'What this site saved in your browser' },
  { insert: 'clear()', label: 'clear()', desc: 'Empty the console' },
];

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
      return [{ kind: 'info', text: 'Type @prefix:command. Type a prefix to see its commands, for example @search' }, { kind: 'info', text: 'Put a suffix ($ * & /) right after a command to change how it runs. Type @help:suffixes to see them.' }, ...usablePrefixes(ctx.viewer).map((item) => ({ kind: 'help', line: `@${item.id}`, text: item.title }))];
    case 'help:prefixes':
      return usablePrefixes(ctx.viewer).flatMap((item) => [{ kind: 'gap' }, ...commandLines(item)]);
    case 'help:suffixes':
      return [
        { kind: 'info', text: 'A suffix is one symbol right after the command, before the space. Use several if you like, each once, for example @refresh:logs*&' },
        ...SUFFIXES.map((suffix) => ({ kind: 'help', line: suffix.example, text: `${suffix.symbol} ${suffix.title}: ${suffix.desc}` })),
        { kind: 'info', text: 'Suffixes only work in the normal panel, not in freestyle mode.' },
      ];
    case 'help:whoami': {
      const have = rolesOf(ctx.viewer);
      return info(`You are ${ctx.viewer?.name || 'signed in'}.`, `Roles: ${have.length ? have.join(', ') : 'none'}.`, `You can use: ${usablePrefixes(ctx.viewer).map((item) => `@${item.id}`).join(' ')}`);
    }
    case 'help:shortcuts':
      return info('Enter runs the command.', 'Tab completes the first suggestion.', 'Up and Down bring back earlier commands.', 'Esc closes the panel.', `A suffix after a command changes how it runs: ${SUFFIXES.map((suffix) => `${suffix.symbol} ${suffix.title.toLowerCase()}`).join(', ')}.`, 'On a computer, pressing @ on the logs page opens the panel.');

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
        <li>
          <span style={{ color: SUFFIX_COLOR }}>suffix</span> has the same colour as the @
        </li>
      </ul>
      <p className="helperText cmdGuideText">Commands that delete ask you to run them twice. Press Enter again (or tap Confirm) to go ahead. You only see the prefixes your role can use.</p>
      <p className="helperText cmdGuideText">
        The panel is contained by default. @convert:freestyle turns it into a JavaScript console like F12 for this visit only: it is contained again when you close the panel or refresh the page.
      </p>
      <p className="helperText cmdGuideText">
        A <strong>suffix</strong> is one symbol right after the command, before any space, like <strong>@prefix:command$</strong>. It changes how the command runs. Use several if you like, each once, for example <strong>{'@refresh:logs*&'}</strong>. Tap one below to put an example in the box. Suffixes only work in the normal panel, not in freestyle mode.
      </p>
      <section className="cmdGroup">
        <h4 className="cmdGroupTitle">
          <span style={{ color: SUFFIX_COLOR }}>{SUFFIXES.map((suffix) => suffix.symbol).join(' ')}</span>
          <span className="cmdGroupHint">Suffixes</span>
          <span className="cmdWho">Staff, managers, admins and developers</span>
        </h4>
        <ul className="cmdList">
          {SUFFIXES.map((suffix) => (
            <li key={suffix.symbol}>
              <button type="button" className="cmdPick" onClick={() => onPick(suffix.example)} data-nolog>
                <span className="cmdPickLine">
                  <Tokens line={suffix.example} />
                </span>
                <span className="cmdPickText">
                  <span className="cmdSuffixMark" style={{ color: SUFFIX_COLOR }}>
                    {suffix.symbol}
                  </span>{' '}
                  {suffix.title}: {suffix.desc}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
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
  // The mode is only ever remembered while this panel is open: it always starts contained, and closing the
  // panel or refreshing the page puts it back (nothing is saved)
  const [mode, setMode] = useState('contained');
  const [consoleOutput, setConsoleOutput] = useState([]);
  const consoleHistory = useRef([]);
  const inputRef = useRef(null);
  const mirrorRef = useRef(null);
  const outputRef = useRef(null);
  const nextId = useRef(1);
  const suggestions = useMemo(() => suggest(line, ctx.viewer, { suffixes: mode !== 'freestyle' }).slice(0, 14), [line, ctx.viewer, mode]);

  // Adds lines to the screen of a mode (the last 200 stay). push writes to the screen that is showing.
  const pushTo = (which, ...entries) => (which === 'freestyle' ? setConsoleOutput : setOutput)((previous) => [...previous, ...entries.map((entry) => ({ id: nextId.current++, ...entry }))].slice(-OUTPUT_MAX));
  const push = (...entries) => pushTo(mode, ...entries);

  // The screen scrolls to the newest line
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, consoleOutput, guideOpen, mode]);

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
    clearOutput: () => (mode === 'freestyle' ? setConsoleOutput([]) : setOutput([])),
    clearHistory: () => {
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch {
        /* storage can be unavailable */
      }
    },
  };

  // Switches between contained (the normal panel) and freestyle (a JavaScript console)
  const switchMode = (next) => {
    if (next === mode) {
      push({ kind: 'info', text: `Already in ${next} mode.` });
      return;
    }
    setMode(next);
    setHistoryAt(-1);
    setLine('');
    setPending(null);
    setGuideOpen(false);
    if (next === 'freestyle') {
      pushTo('contained', { kind: 'ok', text: 'Freestyle mode on. The panel is a JavaScript console now. Contained mode comes back when you close the panel.' });
      setConsoleOutput((previous) => (previous.length ? previous : FREESTYLE_BANNER.map((entry) => ({ id: nextId.current++, ...entry }))));
    } else {
      pushTo('contained', { kind: 'ok', text: 'Contained mode on. Back to the normal command panel.' });
    }
    logEvent({ code: 'COMMAND_RUN', reason: `Switched the command panel to ${next} mode` });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Freestyle: runs a line of JavaScript in this tab and prints what it logged and what it returned
  const runConsole = async (code) => {
    consoleHistory.current = [...consoleHistory.current.filter((item) => item !== code), code].slice(-HISTORY_MAX);
    setPending(null);
    setBusy(true);
    pushTo('freestyle', { kind: 'jsin', line: code });
    let cleared = false;
    const helpers = {
      $: (selector) => document.querySelector(selector),
      $$: (selector) => Array.from(document.querySelectorAll(selector)),
      copy: (value) => {
        navigator.clipboard?.writeText(typeof value === 'string' ? value : formatValue(value));
      },
      clear: () => {
        cleared = true;
        setConsoleOutput([]);
      },
    };
    try {
      const { logs, result } = await runJs(code, helpers);
      if (!cleared) pushTo('freestyle', ...logs, result);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // Runs a command that was already parsed. Returns how it ended: 'failed', 'previewed' (the / suffix),
  // 'switched' (the mode changed), 'reloaded' (the command loaded the logs again itself) or 'done'.
  const execute = async (text, parsed) => {
    const { prefix, args, suffixes = [] } = parsed;
    let { command } = parsed;
    if (!command && prefix.id === 'help') command = findCommand(prefix, 'all');
    if (!command) {
      push({ kind: 'info', text: `@${prefix.id}: ${prefix.title}` }, ...commandLines(prefix));
      return 'done';
    }
    if (command.required && !args) {
      push({ kind: 'error', text: `Usage: @${prefix.id}:${command.id} ${command.args}` });
      return 'failed';
    }
    // The / suffix: say what the command would do and run nothing
    if (suffixes.includes('/')) {
      push({ kind: 'info', text: `Preview: ${command.desc.replace(/\.$/, '')}.` }, ...(command.danger ? [{ kind: 'warn', text: 'It would ask you to confirm before it runs.' }] : []), { kind: 'info', text: 'Nothing was run.' });
      return 'previewed';
    }
    // @convert: changes the mode of the panel itself
    if (prefix.id === 'convert') {
      switchMode(command.id);
      return 'switched';
    }
    try {
      if (command.where === 'server') {
        const started = performance.now();
        const response = await fetch('/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: prefix.id, command: command.id, args }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          push({ kind: 'error', text: data.error || `The server answered ${response.status}.` });
          return 'failed';
        }
        const took = Math.round(performance.now() - started);
        push({ kind: 'ok', text: prefix.id === 'stats' ? `${data.message} ${took} ms round trip.` : data.message });
        let reloaded = false;
        if (data.deleted !== undefined || data.reload) {
          await ctx.reload();
          reloaded = true;
        }
        // The staff notes board refreshes when a command changed a note
        if (data.notes) window.dispatchEvent(new Event('kyriadon:notes-changed'));
        return reloaded ? 'reloaded' : 'done';
      }
      logEvent({ code: 'COMMAND_RUN', reason: `Ran the command ${text.slice(0, 80)}` });
      const lines = await runClient(prefix, command, args, fullCtx);
      if (lines.length) push(...lines);
      return prefix.id === 'refresh' ? 'reloaded' : 'done';
    } catch (error) {
      push({ kind: 'error', text: `That did not work: ${error?.message || 'unknown error'}` });
      return 'failed';
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
    // In freestyle everything that does not start with @ is JavaScript
    if (mode === 'freestyle' && !text.startsWith('@')) {
      await runConsole(text);
      return;
    }
    // Suffixes only work in the contained panel (parseCommand refuses them in freestyle mode)
    const parsed = parseCommand(text, ctx.viewer, { suffixes: mode !== 'freestyle' });
    const marks = parsed.ok ? parsed.suffixes : [];
    const isPrivate = marks.includes('$');
    const isPreview = marks.includes('/');
    if (parsed.ok && parsed.command?.danger && !isPreview && !(pending && pending.key === normalise(text))) {
      if (!isPrivate) remember(text);
      setPending({ text, key: normalise(text) });
      push({ kind: 'echo', line: text }, { kind: 'warn', text: parsed.command.id === 'set-limiter' ? 'This changes how logs are deleted from now on, and can delete logs right away. Press Enter again, or tap Confirm, to run it.' : 'This deletes logs for good. Press Enter again, or tap Confirm, to run it.' });
      return;
    }
    const confirmed = Boolean(pending && parsed.ok && pending.key === normalise(text));
    setPending(null);
    // The $ suffix: the line is not saved in the history
    if (!isPrivate) remember(text);
    if (!confirmed) push({ kind: 'echo', line: text });
    if (!parsed.ok) {
      push({ kind: 'error', text: parsed.error });
      return;
    }
    setBusy(true);
    let outcome = 'failed';
    try {
      outcome = await execute(text, parsed);
      // The & suffix: load the logs again afterwards (unless the command already did)
      if (outcome === 'done' && marks.includes('&')) {
        try {
          await ctx.reload();
          push({ kind: 'ok', text: 'Loaded the logs again.' });
        } catch {
          push({ kind: 'error', text: 'The logs could not be loaded again.' });
        }
      }
    } finally {
      setBusy(false);
      // The * suffix: the command stays in the box so it can be run again
      if (marks.includes('*') && outcome !== 'switched') setLine(text);
      inputRef.current?.focus();
    }
  };

  // Arrow keys bring back earlier commands, Tab completes the first suggestion
  const onKeyDown = (event) => {
    // Commands and console code have their own history (console code is never saved)
    const list = mode === 'freestyle' ? consoleHistory.current : history;
    if (event.key === 'ArrowUp' && list.length) {
      event.preventDefault();
      const next = Math.min(historyAt + 1, list.length - 1);
      setHistoryAt(next);
      setLine(list[list.length - 1 - next]);
    } else if (event.key === 'ArrowDown' && historyAt >= 0) {
      event.preventDefault();
      const next = historyAt - 1;
      setHistoryAt(next);
      setLine(next < 0 ? '' : list[list.length - 1 - next]);
    } else if (event.key === 'Tab' && line.trim()) {
      // Tab completes the first prefix, command or parameter (suffix suggestions are only tapped)
      const first = suggestions.find((item) => item.kind !== 'suffix');
      if (first) {
        event.preventDefault();
        setLine(first.insert);
      }
    }
  };

  // Put a suggestion or a command from the guide into the box
  const pick = (text) => {
    setLine(text);
    setGuideOpen(false);
    inputRef.current?.focus();
  };

  // The suggestions under the input (examples in freestyle while the input is empty)
  const chips = mode === 'freestyle' && !line.trim() ? FREESTYLE_CHIPS : suggestions;

  return (
    <Modal
      titleId="commandsTitle"
      title={mode === 'freestyle' ? 'Console' : 'Command panel'}
      subtitle={mode === 'freestyle' ? 'Freestyle mode. JavaScript runs in this tab, like the F12 console. Type @convert:contained to go back.' : 'Type @prefix:command, for example @help. You only see the prefixes your role can use.'}
      onClose={onClose}
      footer={
        <>
          <div className="footerGroup">
            <button type="button" className="btn btnSecondary" onClick={() => setGuideOpen((open) => !open)} aria-pressed={guideOpen} data-nolog>
              {guideOpen ? 'Back to the panel' : 'Guide'}
            </button>
            <button type="button" className="btn btnSecondary" onClick={() => switchMode(mode === 'freestyle' ? 'contained' : 'freestyle')} data-nolog>
              {mode === 'freestyle' ? 'Contained' : 'Freestyle'}
            </button>
          </div>
          <button type="button" className="btn btnSecondary" onClick={onClose} data-nolog>
            Done
          </button>
        </>
      }
    >
      <div className="cmdPanel" data-mode={mode}>
        {mode === 'freestyle' && (
          <div className="cmdTabs">
            <span className="cmdTab" aria-current="true">
              Console
            </span>
            <span className="cmdTabHint">Freestyle: runs in this tab. It is contained again when you close the panel.</span>
          </div>
        )}
        {guideOpen ? (
          <div className="cmdScreen" ref={outputRef} data-mode={mode}>
            <CommandGuide onPick={pick} viewer={ctx.viewer} />
          </div>
        ) : (
          <div className="cmdScreen" ref={outputRef} role="log" aria-live="polite" data-mode={mode}>
            {(mode === 'freestyle' ? consoleOutput : output).map((entry) =>
              entry.kind === 'gap' ? (
                <div key={entry.id} className="cmdGap" />
              ) : entry.kind === 'echo' ? (
                <p key={entry.id} className="cmdRow cmdEcho">
                  <Tokens line={entry.line} suffixes={mode !== 'freestyle'} />
                </p>
              ) : entry.kind === 'jsin' ? (
                <p key={entry.id} className="cmdRow cmdJsRow">
                  <span className="cmdPrompt" aria-hidden="true">
                    &gt;
                  </span>
                  <span className="cmdJsText">
                    <JsTokens line={entry.line} />
                  </span>
                </p>
              ) : entry.kind === 'result' ? (
                <p key={entry.id} className="cmdRow cmdJsRow cmdJsOut">
                  <span className="cmdPrompt" aria-hidden="true">
                    &lsaquo;
                  </span>
                  <span className="cmdJsText">{entry.text}</span>
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
        {!guideOpen && chips.length > 0 && (
          <div className="cmdSuggest" role="group" aria-label="Suggestions">
            {chips.map((item) => (
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
            {mode === 'freestyle' && (
              <span className="cmdPromptMark" aria-hidden="true">
                &gt;
              </span>
            )}
            <div className="cmdMirror" ref={mirrorRef} aria-hidden="true">
              {mode === 'freestyle' && !line.trimStart().startsWith('@') ? <JsTokens line={line} /> : <Tokens line={line} suffixes={mode !== 'freestyle'} />}
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
              placeholder={mode === 'freestyle' ? 'Type JavaScript...' : '@prefix:command'}
              aria-label={mode === 'freestyle' ? 'Console input' : 'Command'}
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
