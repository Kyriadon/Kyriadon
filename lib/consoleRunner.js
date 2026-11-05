// ============================================================================
// consoleRunner.js
// The engine of the freestyle mode of the Command panel (@convert:freestyle): it runs the
// JavaScript you type in this browser tab, like the F12 console, shows the result, and colours the
// code. Nothing here talks to the server. Client side only.
// ============================================================================

const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor;
const MAX_TEXT = 4000;

// A string the way the console shows it: in single quotes
const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

// Turns any value into text, like the console does: strings quoted, objects as { a: 1 }, elements as <div#id.class>.
// raw: a string at the top level stays as it is (console.log('hi') prints hi, not 'hi').
export function formatValue(value, { raw = false, depth = 0, seen = new WeakSet() } = {}) {
  const type = typeof value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (type === 'string') return raw && depth === 0 ? value : quote(value);
  if (type === 'number' || type === 'boolean') return String(value);
  if (type === 'bigint') return `${value}n`;
  if (type === 'symbol') return value.toString();
  if (type === 'function') return `\u0192 ${value.name || '(anonymous)'}()`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof Element !== 'undefined' && value instanceof Element) return `<${value.tagName.toLowerCase()}${value.id ? `#${value.id}` : ''}${typeof value.className === 'string' && value.className.trim() ? `.${value.className.trim().split(/\s+/).join('.')}` : ''}>`;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const next = { depth: depth + 1, seen };
  let text;
  if (Array.isArray(value) || (typeof NodeList !== 'undefined' && value instanceof NodeList) || (typeof HTMLCollection !== 'undefined' && value instanceof HTMLCollection)) {
    const items = Array.from(value);
    text = depth > 2 ? `Array(${items.length})` : `[${items.slice(0, 50).map((item) => formatValue(item, next)).join(', ')}${items.length > 50 ? `, \u2026 ${items.length - 50} more` : ''}]`;
  } else if (value instanceof Map) {
    text = depth > 2 ? `Map(${value.size})` : `Map(${value.size}) {${[...value].slice(0, 20).map(([key, item]) => `${formatValue(key, next)} => ${formatValue(item, next)}`).join(', ')}}`;
  } else if (value instanceof Set) {
    text = depth > 2 ? `Set(${value.size})` : `Set(${value.size}) {${[...value].slice(0, 30).map((item) => formatValue(item, next)).join(', ')}}`;
  } else if (value instanceof Promise) {
    text = 'Promise {<pending>}';
  } else {
    const name = value.constructor && value.constructor.name && value.constructor.name !== 'Object' ? `${value.constructor.name} ` : '';
    let keys = [];
    try {
      keys = Object.keys(value);
    } catch {
      /* some objects cannot be listed */
    }
    text = depth > 2 ? `${name}{\u2026}` : `${name}{${keys.slice(0, 30).map((key) => `${key}: ${formatValue(value[key], next)}`).join(', ')}${keys.length > 30 ? `, \u2026 ${keys.length - 30} more` : ''}}`;
  }
  return depth === 0 && text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\u2026` : text;
}

// Runs code like the console: first as one expression (so the value is shown and await works), and if that
// is not valid as statements (var and function declarations stay available for the next line).
// Returns { logs, result }: what console.log and friends printed, and the result (or the error).
export async function runJs(code, helpers) {
  const logs = [];
  const original = {};
  const kinds = { log: 'log', debug: 'log', info: 'info', warn: 'warn', error: 'error' };
  Object.keys(kinds).forEach((name) => {
    original[name] = console[name];
    console[name] = (...args) => {
      logs.push({ kind: kinds[name], text: args.map((arg) => formatValue(arg, { raw: true })).join(' ') });
      original[name].apply(console, args);
    };
  });
  try {
    const names = Object.keys(helpers);
    let expression = null;
    try {
      expression = new AsyncFunction(...names, `return (\n${code}\n);`);
    } catch {
      expression = null; // not an expression, so it is run as statements below
    }
    let value;
    if (expression) value = await expression(...names.map((name) => helpers[name]));
    else {
      names.forEach((name) => {
        if (!(name in globalThis)) globalThis[name] = helpers[name];
      });
      // eslint-disable-next-line no-eval
      value = await (0, eval)(code);
    }
    return { logs, result: { kind: 'result', text: formatValue(value) } };
  } catch (error) {
    return { logs, result: { kind: 'error', text: `Uncaught ${error?.name || 'Error'}: ${error?.message ?? formatValue(error)}` } };
  } finally {
    Object.keys(kinds).forEach((name) => {
      console[name] = original[name];
    });
  }
}

// Colours for the code: comments, strings, numbers, keywords and the literals
const TOKEN = /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|await|async|new|typeof|instanceof|class|extends|import|export|from|of|in|try|catch|finally|throw|delete|void|this)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)/gm;
const CODE_COLORS = ['#7f8c8d', '#ecc48d', '#f78c6c', '#c792ea', '#ff9d7a'];
const CODE_PLAIN = '#e6edf3';

// Splits code into coloured pieces: [{ text, color }]. The pieces always add up to the exact text.
export function highlightJs(code) {
  const text = String(code ?? '');
  const pieces = [];
  let last = 0;
  text.replace(TOKEN, (match, ...groups) => {
    const index = groups[groups.length - 2];
    if (index > last) pieces.push({ text: text.slice(last, index), color: CODE_PLAIN });
    const kind = groups.slice(0, 5).findIndex((group) => group !== undefined);
    pieces.push({ text: match, color: CODE_COLORS[kind] });
    last = index + match.length;
    return match;
  });
  if (last < text.length) pieces.push({ text: text.slice(last), color: CODE_PLAIN });
  return pieces;
}
