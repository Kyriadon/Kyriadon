// ============================================================================
// announcementManager.js
// The Announcements manager (opened from the Account modal by staff who are logged in):
//   list         every announcement with its views and favourites, search and filter
//   statistics   totals, by type, posts per day, most viewed, most favourited, authors
//   guide        the small rule book: who can do what, markdown, colours, chips, variables
//   editor       Advanced mode (fields) and Raw mode (one panel with :title: style variables),
//                with a live preview. The two modes use the same icons and look as the
//                Advanced and Raw views of the debug logs.
// Staff can edit and delete the announcements they created, admins any of them (the server
// checks this again). Styles live in styles/announcementStyles.css.
// ============================================================================
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconBook, IconCheck, IconCode, IconLock, IconPencil, IconRefresh, IconRows, IconSearch, IconTrash, IconUpload, IconWarning, Modal, logEvent } from './siteShell';
import { sendJson } from '../lib/accountClient';
import { announceChange, formatDate, formatWhen, uploadMedia } from '../lib/announcementsClient';
import { LIMITS, TYPE_META, TYPE_ORDER, excerptOf, findMarkupProblems, guessKind, parseRaw, safeUrl, serializeRaw, stripMarkup } from '../lib/announcementMarkup';
import { announcementColors } from '../lib/siteDesign';
import { AnnoInline, AnnoMarkup } from './announcementMarkup';
import { CopyButton } from './guideKit';
import { AnnouncementCard, IconBars, IconEye, IconExternal, IconFavourite, IconPlus, TypeBadge } from './announcementCards';

const API = '/api/staff/announcements';
const MODE_KEY = 'kyriadon:announcementMode';

const blankFields = () => ({ title: '', url: '', type: 'update', description: '', body: '', image: '', resources: [] });

// ----------------------------------------------------------------------------
// Text snippets for the toolbar above the text boxes. They wrap the selected text, or insert
// an example when nothing is selected.
// ----------------------------------------------------------------------------
const SNIPPETS = [
  { id: 'bold', label: 'Bold', make: (text) => `**${text || 'text'}**` },
  { id: 'italic', label: 'Italic', make: (text) => `*${text || 'text'}*` },
  { id: 'heading', label: 'Heading', make: (text) => `## ${text || 'Heading'}` },
  { id: 'list', label: 'List', make: (text) => `- ${text || 'item'}` },
  { id: 'link', label: 'Link', make: (text) => `[${text || 'label'}](https://)` },
  { id: 'code', label: 'Code', make: (text) => `\`${text || 'code'}\`` },
  { id: 'colr', label: 'Colour', make: (text) => `:colr:blue/${text || 'text'}/` },
  { id: 'colrs', label: 'Gradient', make: (text) => `:colrs:blue,red,green/${text || 'text'}/` },
  { id: 'chip', label: 'Chip', make: (text) => `:chip:blue/${text || 'text'}/:chip:` },
  { id: 'flow', label: 'Flowing chip', make: (text) => `:chip:blue,red,purple/${text || 'text'}/:chip:` },
];

// The variables of Raw mode, inserted on a line of their own
const VARIABLE_SNIPPETS = [
  { id: 'title', label: ':title:', line: ':title: ""' },
  { id: 'url', label: ':url:', line: ':url: ""' },
  { id: 'type', label: ':type:', line: ':type: "update"' },
  { id: 'description', label: ':description:', line: ':description: ""' },
  { id: 'image', label: ':image:', line: ':image: ""' },
  { id: 'resource', label: ':resource:', line: ':resource: "Label" | "https://" | "link"' },
];

// Puts text at the cursor of a text box (or around the selection) and keeps the cursor after it
function insertAt(element, value, make, onChange) {
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  const text = make(value.slice(start, end), value.slice(0, start));
  onChange(value.slice(0, start) + text + value.slice(end));
  requestAnimationFrame(() => {
    if (!element) return;
    element.focus();
    element.setSelectionRange(start + text.length, start + text.length);
  });
}

function SnippetBar({ snippets, onPick, label }) {
  return (
    <div className="annoSnippets" role="group" aria-label={label}>
      {snippets.map((snippet) => (
        <button key={snippet.id} type="button" className="annoSnippet" onClick={() => onPick(snippet)} data-nolog>
          {snippet.label}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Checks before saving (the server checks everything again)
// ----------------------------------------------------------------------------
function problemWith(fields) {
  if (!fields.title.trim()) return 'Add a title.';
  if (!fields.type) return 'Pick a type.';
  if (!fields.description.trim() && !fields.body.trim()) return 'Add a description or a main announcement.';
  if (fields.image.trim() && !safeUrl(fields.image)) return 'The image link is not valid. Use an https:// link or upload a file.';
  const wrong = fields.resources.find((resource) => !safeUrl(resource.url));
  if (wrong) return `"${(wrong.label || wrong.url || 'A resource').slice(0, 40)}" needs a valid link.`;
  return '';
}

// Resources the way the server stores them
const cleanResources = (resources) =>
  resources
    .filter((resource) => resource.url.trim())
    .map((resource) => {
      const kind = ['image', 'video', 'link'].includes(resource.kind) ? resource.kind : guessKind(resource.url);
      return { kind, label: resource.label.trim(), url: resource.url.trim() };
    });

// ----------------------------------------------------------------------------
// Mode switch (Advanced or Raw): the two buttons of the debug logs, icon and label
// ----------------------------------------------------------------------------
function ModeSwitch({ mode, onChange }) {
  return (
    <div className="modeBar">
      <button type="button" className="viewToggle modeToggle" data-tone={mode === 'advanced' ? 'advanced' : 'normal'} aria-pressed={mode === 'advanced'} onClick={() => onChange('advanced')} data-nolog>
        <IconRows size={18} />
        Advanced
      </button>
      <button type="button" className="viewToggle modeToggle" data-tone={mode === 'raw' ? 'advanced' : 'normal'} aria-pressed={mode === 'raw'} onClick={() => onChange('raw')} data-nolog>
        <IconCode size={18} />
        Raw
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// The guide: who can do what, and every piece of syntax with its result next to it
// ----------------------------------------------------------------------------
const GUIDE_MARKDOWN = [
  ['# Big heading\n## Heading\n### Smaller heading', 'Headings'],
  ['**bold**  *italic*  __underline__  ~~strike~~  ==highlight==', 'Text styles'],
  ['- first\n- second\n  - nested\n1. one\n2. two\n- [x] done\n- [ ] to do', 'Lists and tasks'],
  ['> A quote', 'Quote'],
  ['[Discord](https://discord.gg/B6czYB7wa7)', 'Link'],
  ['![A picture](https://)', 'Image or video from a link'],
  ['`/command`  or a fenced block of code', 'Code'],
  ['| Name | Value |\n| --- | ---: |\n| Speed | 10 |', 'Table'],
  ['---', 'Divider'],
  ['-# Small grey text', 'Small text'],
];

const GUIDE_COLOURS = [
  [':colr:blue/Colour/', 'One colour. Use a name (gold, golden, blue ...) or a #hex value.'],
  [':colrs:blue,red,green/Gradient text/', 'A smooth gradient through two or more colours.'],
  [':chip:blue/Chip/:chip:', 'A chip in one colour.'],
  [':chip:blue,red,purple/Flowing chip/:chip:', 'A chip whose colours flow on hover, like the other chips.'],
  ['## :colr:blue/ANNOUNCEMENT/', 'Works inside any markdown, here inside a heading.'],
  ['**:colr:#ff6fb5/Bold and pink/**', 'Combine them with markdown styles.'],
];

const GUIDE_RAW = [
  [':title: "Version 1.2 is here"', 'The title on the card.'],
  [':url: "changelogs/changelog-1"', 'The page of the announcement: /announcements/changelogs/changelog-1. Leave it empty to build one from the title.'],
  [':type: "change-log"', 'change-log, update or announcement.'],
  [':description: "A short summary."', 'The text on the card before it is opened.'],
  [':image: "https://..."', 'The picture on the card and in the full view.'],
  [':resource: "Patch notes" | "https://..." | "link"', 'One line per resource. The last part is image, video or link.'],
  ['Everything else you type', 'Is the main announcement, shown when the card is opened. Markdown works.', true],
];

function GuideTable({ rows }) {
  return (
    <div className="annoGuideRows">
      {rows.map(([code, note, plain]) => (
        <div className="annoGuideRow" key={code}>
          {/* Every code has a copy button in its corner (a plain description has none) */}
          <div className="mdCodeBlock annoGuideBlock">
            <pre className="mdPre annoGuideCode">{code}</pre>
            {!plain && <CopyButton text={code} label="Copy code" />}
          </div>
          <p className="annoGuideNote">{note}</p>
          <div className="annoGuideResult"><AnnoMarkup text={code} /></div>
        </div>
      ))}
    </div>
  );
}

function GuideView() {
  return (
    <div className="annoGuide">
      <section className="controlSection">
        <h4 className="studioSectionTitle">Who can do what</h4>
        <ul className="mdList">
          <li><strong>Staff</strong> create announcements, and edit or delete the ones they created.</li>
          <li><strong>Admins</strong> edit and delete any announcement.</li>
          <li>You need to be logged in as staff (Account menu) to open the manager.</li>
          <li>Every create, edit and delete is written to the debug logs.</li>
        </ul>
      </section>

      <section className="controlSection">
        <h4 className="studioSectionTitle">The three types</h4>
        <div className="studioRow">
          {TYPE_ORDER.map((type) => (
            <span key={type} className="studioRow">
              <TypeBadge type={type} />
              <span className="helperText annoGuideInline">{TYPE_META[type].blurb}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="controlSection">
        <h4 className="studioSectionTitle">Markdown</h4>
        <GuideTable rows={GUIDE_MARKDOWN} />
      </section>

      <section className="controlSection">
        <h4 className="studioSectionTitle">Colours, gradients and chips</h4>
        <GuideTable rows={GUIDE_COLOURS} />
        <p className="helperText">Colour names:</p>
        <div className="annoSwatches">
          {Object.entries(announcementColors).map(([name, hex]) => (
            <span key={name} className="annoSwatch" style={{ '--swatch': hex }}>{name}</span>
          ))}
        </div>
        <p className="helperText">Put a backslash in front of a slash to use it inside the text: \/. Do not put one tag inside another, use markdown inside it instead.</p>
      </section>

      <section className="controlSection">
        <h4 className="studioSectionTitle">Raw mode variables</h4>
        <GuideTable rows={GUIDE_RAW} />
        <p className="helperText">A line that starts with \:title: stays plain text. Switching between Advanced and Raw never loses anything.</p>
      </section>

      <section className="controlSection">
        <h4 className="studioSectionTitle">Good to know</h4>
        <ul className="mdList">
          <li>A deleted announcement stays for 3 days for the people who favourited it.</li>
          <li>Images can be up to 3 MB (large pictures are shrunk for you), videos up to 4 MB as MP4 or WebM.</li>
          <li>For bigger videos, add the link as a resource instead.</li>
          <li>Up to {LIMITS.resources} resources. Links are shown in bold under the text.</li>
          <li>The preview next to the editor shows the card and the opened view as people will see them.</li>
        </ul>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// The editor
// ----------------------------------------------------------------------------
function Editor({ editing, viewer, volatile, dirtyRef, onBack, onSaved }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'raw' ? 'raw' : 'advanced';
    } catch {
      return 'advanced';
    }
  });
  const [fields, setFields] = useState(editing.fields);
  const [raw, setRaw] = useState(() => serializeRaw(editing.fields));
  const [preview, setPreview] = useState('card');
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [upload, setUpload] = useState(null);
  const bodyRef = useRef(null);
  const rawRef = useRef(null);
  const coverInput = useRef(null);
  const mediaInput = useRef(null);
  const createdAt = useRef(editing.createdAt || Date.now());

  const change = useCallback(
    (patch) => {
      dirtyRef.current = true;
      setFields((previous) => ({ ...previous, ...patch }));
    },
    [dirtyRef],
  );

  // Raw text changes: the variables become fields at once, so the preview and the other mode stay in step
  const changeRaw = useCallback(
    (text) => {
      dirtyRef.current = true;
      setRaw(text);
      const parsed = parseRaw(text);
      setFields((previous) => ({ ...parsed.fields, type: parsed.fields.type || previous.type }));
    },
    [dirtyRef],
  );

  const switchMode = (next) => {
    if (next === mode) return;
    if (next === 'raw') setRaw(serializeRaw(fields));
    setMode(next);
    logEvent({ code: 'ANNOUNCEMENT_EDITOR_MODE_SWITCHED', reason: `Switched the announcement editor to ${next} mode` });
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage can be unavailable */
    }
  };

  // What the editor warns about (never blocks saving, except what the server refuses)
  const problems = useMemo(() => {
    const list = mode === 'raw' ? [...parseRaw(raw).problems] : [];
    findMarkupProblems(fields.title).forEach((text) => list.push(`Title: ${text}`));
    findMarkupProblems(fields.description).forEach((text) => list.push(`Description: ${text}`));
    findMarkupProblems(fields.body).forEach((text) => list.push(`Main announcement: ${text}`));
    return list;
  }, [mode, raw, fields.title, fields.description, fields.body]);

  // The announcement as people will see it
  const previewItem = useMemo(() => {
    const slugText = fields.url.trim() || `${TYPE_META[fields.type]?.folder || 'news'}/${fields.title ? stripMarkup(fields.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'untitled'}`;
    return {
      id: 'preview',
      slug: slugText,
      url: `/announcements/${slugText}`,
      type: fields.type,
      category: fields.type,
      title: fields.title.trim() || 'Untitled announcement',
      description: fields.description.trim() || excerptOf(fields.body, 200),
      image: safeUrl(fields.image),
      authorName: editing.authorName || viewer.name || 'You',
      createdAt: createdAt.current,
      updatedAt: createdAt.current,
      date: new Date(createdAt.current).toISOString(),
      favourited: false,
      body: fields.body,
      resources: fields.resources.filter((resource) => safeUrl(resource.url)).map((resource) => ({ kind: ['image', 'video', 'link'].includes(resource.kind) ? resource.kind : guessKind(resource.url), label: resource.label || resource.url, url: safeUrl(resource.url) })),
    };
  }, [fields, editing.authorName, viewer.name]);

  // Uploads
  const runUpload = async (file, onDone) => {
    setNote(null);
    setUpload({ name: file.name, progress: 0 });
    const result = await uploadMedia(file, (progress) => setUpload({ name: file.name, progress }));
    setUpload(null);
    if (!result.ok) {
      setNote({ tone: 'error', text: result.message });
      return;
    }
    onDone(result);
    logEvent({ code: 'ANNOUNCEMENT_MEDIA_ADDED', reason: `Uploaded a ${result.kind} in the announcement editor` });
  };

  const pickCover = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNote({ tone: 'error', text: 'The image has to be a picture (PNG, JPEG, WebP or GIF).' });
      return;
    }
    runUpload(file, (result) => change({ image: result.url }));
  };

  const pickMedia = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    runUpload(file, (result) => {
      const label = (result.name || 'Upload').replace(/\.[^.]+$/, '').slice(0, LIMITS.label);
      if (mode === 'raw') {
        changeRaw(`${raw.replace(/\s+$/, '')}\n:resource: "${label.replace(/["\\|]/g, ' ')}" | "${result.url}" | "${result.kind}"\n`);
      } else {
        change({ resources: [...fields.resources, { kind: result.kind, label, url: result.url }] });
      }
    });
  };

  const updateResource = (index, patch) => change({ resources: fields.resources.map((resource, n) => (n === index ? { ...resource, ...patch } : resource)) });
  const removeResource = (index) => change({ resources: fields.resources.filter((_, n) => n !== index) });
  const moveResource = (index, step) => {
    const target = index + step;
    if (target < 0 || target >= fields.resources.length) return;
    const next = [...fields.resources];
    [next[index], next[target]] = [next[target], next[index]];
    change({ resources: next });
  };

  // Save
  const save = async () => {
    if (busy || upload) return;
    const problem = problemWith(fields);
    if (problem) {
      setNote({ tone: 'error', text: problem });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const payload = { ...fields, resources: cleanResources(fields.resources) };
      const { data } = editing.id ? await sendJson(API, 'PUT', { ...payload, id: editing.id, expectedUpdatedAt: editing.updatedAt }) : await sendJson(API, 'POST', payload);
      if (data?.ok) {
        dirtyRef.current = false;
        announceChange();
        onSaved(data.item, editing.id ? 'updated' : 'created');
        return;
      }
      setNote({ tone: 'error', text: data?.message || data?.error || 'Could not save that. Try again.' });
    } catch {
      setNote({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  // Ctrl or Cmd + S saves
  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  };

  const showGuide = () => {
    setGuideOpen((open) => !open);
    logEvent({ code: 'ANNOUNCEMENT_GUIDE_OPENED', reason: 'Opened the announcement guide in the editor' });
  };

  return (
    <div className="annoEditor" onKeyDown={onKeyDown}>
      <div className="annoEditorBar">
        <button type="button" className="btn btnGhost btnCompact" onClick={onBack}>
          <span className="annoBackArrow" aria-hidden="true">&larr;</span>
          All announcements
        </button>
        <ModeSwitch mode={mode} onChange={switchMode} />
        <button type="button" className="btn btnSecondary btnCompact" onClick={showGuide} aria-pressed={guideOpen}>
          <IconBook size={16} />
          {guideOpen ? 'Hide guide' : 'Guide'}
        </button>
      </div>
      <p className="modeHint">{mode === 'advanced' ? 'Advanced: one field for everything, with uploads for the image and resources.' : 'Raw: one panel of text. Variables like :title: "title" set the fields, everything else is the main announcement.'}</p>

      {guideOpen && <GuideView />}

      <div className="annoEditorGrid">
        <div className="annoForm">
          <input ref={coverInput} className="acctFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickCover} tabIndex={-1} aria-hidden="true" />
          <input ref={mediaInput} className="acctFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" onChange={pickMedia} tabIndex={-1} aria-hidden="true" />

          {mode === 'advanced' ? (
            <>
              <label className="studioField">
                <span className="studioLabel">Title</span>
                <input className="studioInput" type="text" value={fields.title} maxLength={LIMITS.title} onChange={(event) => change({ title: event.target.value })} autoComplete="off" />
                <span className="helperText annoHelp">Shown on the card. Bold, colours and chips work here too.</span>
              </label>

              <div className="studioField">
                <span className="studioLabel">Type</span>
                <div className="segmented" role="group" aria-label="Type">
                  {TYPE_ORDER.map((type) => (
                    <button key={type} type="button" className="segment annoSegment" data-type={type} aria-pressed={fields.type === type} onClick={() => change({ type })}>
                      {TYPE_META[type].label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="studioField">
                <span className="studioLabel">URL</span>
                <span className="annoUrlWrap">
                  <span className="annoUrlPrefix" aria-hidden="true">/announcements/</span>
                  <input className="studioInput annoUrlInput" type="text" value={fields.url} maxLength={LIMITS.url} placeholder="changelogs/changelog-1" onChange={(event) => change({ url: event.target.value })} autoComplete="off" spellCheck={false} />
                </span>
                <span className="helperText annoHelp">The page of the announcement. Leave it empty to build one from the title.</span>
              </label>

              <label className="studioField">
                <span className="studioLabel">Description</span>
                <textarea className="studioInput acctTextarea" rows={2} value={fields.description} maxLength={LIMITS.description} onChange={(event) => change({ description: event.target.value })} />
                <span className="helperText annoHelp">Shown on the card before it is opened. {fields.description.length} of {LIMITS.description}.</span>
              </label>

              <div className="studioField">
                <span className="studioLabel">Main announcement</span>
                <SnippetBar label="Insert markdown" snippets={SNIPPETS} onPick={(snippet) => insertAt(bodyRef.current, fields.body, snippet.make, (text) => change({ body: text }))} />
                <textarea ref={bodyRef} className="studioInput acctTextarea annoBody" rows={12} value={fields.body} maxLength={LIMITS.body} onChange={(event) => change({ body: event.target.value })} />
                <span className="helperText annoHelp">Shown when the card is opened. Markdown works. {fields.body.length} of {LIMITS.body}.</span>
              </div>

              <div className="studioField">
                <span className="studioLabel">Image</span>
                <div className="annoImageRow">
                  <input className="studioInput" type="text" value={fields.image} maxLength={LIMITS.image} placeholder="https://... or upload" onChange={(event) => change({ image: event.target.value })} autoComplete="off" spellCheck={false} />
                  <button type="button" className="btn btnSecondary" onClick={() => coverInput.current?.click()} disabled={Boolean(upload)}>
                    <IconUpload size={16} />
                    Upload
                  </button>
                  {fields.image && (
                    <button type="button" className="btn btnGhost" onClick={() => change({ image: '' })}>
                      Remove
                    </button>
                  )}
                </div>
                <span className="helperText annoHelp">Shown on the card and in the opened view.</span>
              </div>

              <div className="studioField">
                <span className="studioLabel">Resources</span>
                {fields.resources.length > 0 && (
                  <ul className="annoResourceList">
                    {fields.resources.map((resource, index) => (
                      <li key={index} className="annoResourceRow">
                        <span className="annoResourceKind" data-kind={resource.kind || guessKind(resource.url)}>{resource.kind || guessKind(resource.url)}</span>
                        <input className="studioInput" type="text" value={resource.label} maxLength={LIMITS.label} placeholder="Label" aria-label="Resource label" onChange={(event) => updateResource(index, { label: event.target.value })} />
                        <input className="studioInput" type="text" value={resource.url} maxLength={LIMITS.url} placeholder="https://..." aria-label="Resource link" onChange={(event) => updateResource(index, { url: event.target.value, kind: guessKind(event.target.value) })} spellCheck={false} />
                        <div className="annoResourceTools">
                          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => moveResource(index, -1)} disabled={index === 0} aria-label="Move up">&uarr;</button>
                          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => moveResource(index, 1)} disabled={index === fields.resources.length - 1} aria-label="Move down">&darr;</button>
                          <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={() => removeResource(index)} aria-label="Remove resource"><IconTrash size={16} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="studioRow">
                  <button type="button" className="btn btnSecondary btnCompact" onClick={() => change({ resources: [...fields.resources, { kind: 'link', label: '', url: '' }] })} disabled={fields.resources.length >= LIMITS.resources}>
                    <IconPlus size={16} />
                    Add link
                  </button>
                  <button type="button" className="btn btnSecondary btnCompact" onClick={() => mediaInput.current?.click()} disabled={Boolean(upload) || fields.resources.length >= LIMITS.resources}>
                    <IconUpload size={16} />
                    Upload image or video
                  </button>
                </div>
                <span className="helperText annoHelp">Images and videos are shown in a gallery, links are shown in bold.</span>
              </div>
            </>
          ) : (
            <div className="studioField">
              <span className="studioLabel">Raw text</span>
              <SnippetBar label="Insert a variable" snippets={VARIABLE_SNIPPETS} onPick={(snippet) => insertAt(rawRef.current, raw, (_, before) => `${before === '' || before.endsWith('\n') ? '' : '\n'}${snippet.line}\n`, changeRaw)} />
              <SnippetBar label="Insert markdown" snippets={SNIPPETS} onPick={(snippet) => insertAt(rawRef.current, raw, snippet.make, changeRaw)} />
              <textarea ref={rawRef} className="annoRawArea" value={raw} spellCheck={false} rows={22} aria-label="Raw announcement text" onChange={(event) => changeRaw(event.target.value)} />
              <div className="studioRow">
                <button type="button" className="btn btnSecondary btnCompact" onClick={() => mediaInput.current?.click()} disabled={Boolean(upload)}>
                  <IconUpload size={16} />
                  Upload image or video
                </button>
                <span className="helperText annoHelp">Adds a :resource: line.</span>
              </div>
            </div>
          )}

          {upload && (
            <div className="annoUpload" role="status">
              <span className="helperText annoHelp">Uploading {upload.name}...</span>
              <span className="chartTrack"><span className="chartFill" style={{ width: `${Math.round(upload.progress * 100)}%` }} /></span>
            </div>
          )}

          {problems.length > 0 && (
            <ul className="annoProblems" role="status">
              {problems.map((text) => (
                <li key={text}>
                  <IconWarning size={14} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="annoPreview" aria-label="Preview">
          <div className="studioRow annoPreviewBar">
            <span className="studioLabel">Preview</span>
            <div className="segmented" role="group" aria-label="Preview view">
              <button type="button" className="segment" aria-pressed={preview === 'card'} onClick={() => setPreview('card')}>Card</button>
              <button type="button" className="segment" aria-pressed={preview === 'open'} onClick={() => setPreview('open')}>Opened</button>
            </div>
          </div>
          <div className="annoPreviewBox">
            <AnnouncementCard item={previewItem} expanded={preview === 'open'} detail={{ status: 'ready', item: previewItem }} onToggle={() => {}} onFavourite={() => {}} onRetry={() => {}} />
          </div>
          <p className="helperText annoHelp">Page: <code className="mdCode">{previewItem.url}</code></p>
        </aside>
      </div>

      <div className="annoEditorActions">
        {note?.text && <p className="helperText acctNote" data-tone={note.tone} role={note.tone === 'error' ? 'alert' : 'status'}>{note.text}</p>}
        {volatile && <p className="helperText acctNote" data-tone="error">Saving needs the Upstash Redis database to be connected to this project.</p>}
        <div className="studioRow">
          <button type="button" className="btn btnPrimary" onClick={save} disabled={busy || Boolean(upload) || volatile}>
            {busy ? 'Saving...' : editing.id ? 'Save changes' : 'Publish announcement'}
          </button>
          <button type="button" className="btn btnSecondary" onClick={onBack} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Statistics
// ----------------------------------------------------------------------------
const TYPES_FOR_PIE = ['changelog', 'announcement', 'update'];

function TypePie({ counts, total }) {
  const circumference = 2 * Math.PI * 8;
  let offset = 0;
  return (
    <svg className="chartPie" viewBox="0 0 32 32" role="img" aria-label={`Announcements by type: ${TYPES_FOR_PIE.map((type) => `${counts[type]} ${TYPE_META[type].plural.toLowerCase()}`).join(', ')}`}>
      <g transform="rotate(-90 16 16)">
        <circle className="chartPieTrack" cx="16" cy="16" r="8" />
        {TYPES_FOR_PIE.map((type) => {
          if (!total || !counts[type]) return null;
          const length = (counts[type] / total) * circumference;
          const slice = <circle key={type} className="chartSlice" data-type={type} cx="16" cy="16" r="8" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-offset} />;
          offset += length;
          return slice;
        })}
      </g>
    </svg>
  );
}

function PostBars({ days }) {
  const base = 90;
  const max = Math.max(1, ...days.map((day) => day.count));
  const step = 272 / days.length;
  return (
    <svg className="chartBars" viewBox="0 0 280 118" role="img" aria-label={`Announcements per day: ${days.map((day) => `${day.key.slice(5)} ${day.count}`).join(', ')}`}>
      <line className="chartAxis" x1="4" y1={base} x2="276" y2={base} />
      {days.map((day, index) => {
        const x = 6 + index * step;
        const height = (day.count / max) * (base - 14);
        return (
          <g key={day.key}>
            {height > 0 && <rect className="chartBar" data-type="update" x={x} y={base - height} width={step - 6} height={height} rx="2" />}
            {day.count > 0 && <text className="chartValue" x={x + (step - 6) / 2} y={base - height - 3} textAnchor="middle">{day.count}</text>}
            {index % 2 === 0 && <text className="chartLabel" x={x + (step - 6) / 2} y="108" textAnchor="middle">{day.key.slice(5)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function TopList({ rows, empty, suffix }) {
  if (!rows.length) return <p className="helperText annoHelp">{empty}</p>;
  return (
    <ul className="chartList">
      {rows.map((row) => (
        <li key={row.id} className="chartRow annoChartRow" data-type={row.type}>
          <span className="annoChartLabel" title={stripMarkup(row.title)}>{stripMarkup(row.title)}</span>
          <span className="chartTrack"><span className="chartFill annoChartFill" style={{ width: `${(row.value / rows[0].value) * 100}%` }} /></span>
          <span className="chartCount">{row.value} {suffix}</span>
        </li>
      ))}
    </ul>
  );
}

function StatsView({ stats }) {
  const { totals, byType } = stats;
  return (
    <div className="annoStats">
      <div className="chartSummary">
        <span className="chartChip"><strong>{totals.announcements}</strong> Announcements</span>
        <span className="chartChip"><strong>{totals.views}</strong> Views</span>
        <span className="chartChip"><strong>{totals.favourites}</strong> Favourites</span>
        <span className="chartChip"><strong>{totals.mine}</strong> Created by you</span>
        <span className="chartChip"><strong>{totals.trashed}</strong> Deleted, kept 3 days</span>
      </div>

      {totals.announcements === 0 ? (
        <p className="stateBox">No announcements yet, so there is nothing to chart.</p>
      ) : (
        <>
          <div className="chartCard">
            <h5 className="studioLabel">By type</h5>
            <div className="chartPieWrap">
              <TypePie counts={totals} total={totals.announcements} />
              <ul className="chartLegend">
                {TYPES_FOR_PIE.map((type) => (
                  <li key={type}>
                    <span className="chartDot" data-type={type} />
                    <span>{TYPE_META[type].plural}</span>
                    <strong>{byType[type].count}</strong>
                    <span className="chartPercent">{byType[type].views} views</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="chartCard">
            <h5 className="studioLabel">Last 14 days</h5>
            <PostBars days={stats.days} />
            <p className="helperText">Announcements published per day.</p>
          </div>

          <div className="chartCard">
            <h5 className="studioLabel">Most viewed</h5>
            <TopList rows={stats.topViews} empty="Nobody has opened an announcement yet." suffix="views" />
          </div>

          <div className="chartCard">
            <h5 className="studioLabel">Most favourited</h5>
            <TopList rows={stats.topFavourites} empty="Nobody has favourited an announcement yet." suffix="" />
          </div>

          <div className="chartCard">
            <h5 className="studioLabel">Authors</h5>
            <ul className="chartList">
              {stats.authors.map((author) => (
                <li key={author.name} className="chartRow annoChartRow">
                  <span className="annoChartLabel">{author.name}</span>
                  <span className="chartTrack"><span className="chartFill" style={{ width: `${(author.count / stats.authors[0].count) * 100}%` }} /></span>
                  <span className="chartCount">{author.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// The list
// ----------------------------------------------------------------------------
function ListView({ items, query, filter, pending, busyId, onEdit, onDelete }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((item) => {
    if (filter === 'mine' ? !item.canEdit : filter !== 'all' && item.type !== filter) return false;
    const haystack = `${stripMarkup(item.title)} ${stripMarkup(item.description)} ${item.authorName} ${item.slug}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  if (!items.length) return <div className="stateBox">No announcements yet. Create the first one with the button above.</div>;
  if (!shown.length) return <div className="stateBox">No announcements match your search and filter.</div>;

  return (
    <ul className="annoRows">
      {shown.map((item) => (
        <li key={item.id} className="annoRow" data-type={item.type}>
          <div className="annoRowMain">
            <div className="annoRowTop">
              <TypeBadge type={item.type} />
              <span className="annoRowAuthor">{item.authorName}</span>
              <time className="newsDate" dateTime={new Date(item.createdAt).toISOString()}>{formatDate(item.createdAt)}</time>
              {!item.canEdit && (
                <span className="badge" data-tone="neutral" title="Only the author or an admin can change this announcement.">
                  <IconLock size={12} />
                  Locked
                </span>
              )}
            </div>
            <p className="annoRowTitle"><AnnoInline text={item.title} /></p>
            <p className="annoRowUrl"><code className="mdCode">{item.url}</code></p>
            <div className="annoRowStats">
              <span title="Views"><IconEye size={14} /> {item.views}</span>
              <span title="Favourites"><IconFavourite size={14} /> {item.favourites}</span>
              {item.updatedAt - item.createdAt > 60 * 1000 && <span>Edited {formatWhen(item.updatedAt)}</span>}
            </div>
          </div>
          <div className="annoRowActions">
            <Link className="btn btnGhost btnIcon btnCompact" href={item.url} aria-label="Open the announcement page" title="Open the page">
              <IconExternal size={16} />
            </Link>
            <button type="button" className="btn btnSecondary btnCompact" onClick={() => onEdit(item)} disabled={!item.canEdit || busyId === item.id}>
              <IconPencil size={16} />
              Edit
            </button>
            <button type="button" className={`btn btnCompact ${pending === item.id ? 'btnDanger' : 'btnSecondary'}`} onClick={() => onDelete(item)} disabled={!item.canDelete || busyId === item.id}>
              <IconTrash size={16} />
              {pending === item.id ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// The manager
// ----------------------------------------------------------------------------
export default function AnnouncementManager({ onClose }) {
  const [load, setLoad] = useState({ status: 'loading', data: null, message: '' });
  const [view, setView] = useState('list'); // list | stats | guide
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const dirtyRef = useRef(false);

  // Loads everything (the list, the numbers and who is asking)
  const reload = useCallback(async () => {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => null);
        setLoad({ status: 'denied', data: null, message: body?.error || 'You cannot use the announcements manager right now.' });
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setLoad({ status: 'ready', data: await response.json(), message: '' });
    } catch {
      setLoad((previous) => ({ ...previous, status: previous.data ? 'ready' : 'error' }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // The delete confirmation expires after 5 seconds
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => setPending(null), 5000);
    return () => clearTimeout(timer);
  }, [pending]);

  const data = load.data;
  const viewer = data?.viewer || {};

  // Leaving the editor (or the manager) with unsaved changes asks first
  const confirmLeave = () => !dirtyRef.current || window.confirm('Discard the changes you made?');

  const closeManager = () => {
    if (editing && !confirmLeave()) return;
    onClose();
  };

  const openEditor = (item) => {
    dirtyRef.current = false;
    setNotice(null);
    setEditing(
      item
        ? { id: item.id, updatedAt: item.updatedAt, createdAt: item.createdAt, authorName: item.authorName, fields: { title: item.title, url: item.slug, type: item.type, description: item.description || '', body: item.body || '', image: item.image || '', resources: (item.resources || []).map((resource) => ({ ...resource })) } }
        : { id: null, fields: blankFields() },
    );
    logEvent({ code: 'ANNOUNCEMENT_EDITOR_OPENED', reason: item ? 'Opened an announcement in the editor' : 'Started a new announcement' });
  };

  const closeEditor = () => {
    if (!confirmLeave()) return;
    dirtyRef.current = false;
    setEditing(null);
  };

  const saved = async (item, how) => {
    setEditing(null);
    setNotice({ tone: 'success', text: how === 'created' ? 'Published. It is on the announcements page now.' : 'Changes saved.' });
    await reload();
  };

  const remove = async (item) => {
    if (pending !== item.id) {
      setPending(item.id);
      return;
    }
    setPending(null);
    setBusyId(item.id);
    setNotice(null);
    try {
      const { data: answer } = await sendJson(API, 'DELETE', { id: item.id });
      if (answer?.ok) {
        announceChange();
        setNotice({ tone: 'success', text: answer.keptFor ? `Deleted. ${answer.keptFor} ${answer.keptFor === 1 ? 'person keeps' : 'people keep'} it for 3 days because they favourited it.` : 'Deleted.' });
        await reload();
      } else {
        setNotice({ tone: 'error', text: answer?.message || answer?.error || 'Could not delete that. Try again.' });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Could not reach the server. Try again.' });
    } finally {
      setBusyId(null);
    }
  };

  const changeView = (next) => {
    setView(next);
    if (next === 'stats') logEvent({ code: 'ANNOUNCEMENT_STATS_OPENED', reason: 'Opened the announcement statistics' });
    if (next === 'guide') logEvent({ code: 'ANNOUNCEMENT_GUIDE_OPENED', reason: 'Opened the announcement guide' });
  };

  const toolbar = editing ? null : (
    <div className="annoToolbar">
      <div className="segmented" role="group" aria-label="Manager view">
        <button type="button" className="segment" aria-pressed={view === 'list'} onClick={() => changeView('list')}>Announcements</button>
        <button type="button" className="segment annoSegmentIcon" aria-pressed={view === 'stats'} onClick={() => changeView('stats')}><IconBars size={15} />Statistics</button>
        <button type="button" className="segment annoSegmentIcon" aria-pressed={view === 'guide'} onClick={() => changeView('guide')}><IconBook size={15} />Guide</button>
      </div>
      <div className="studioRow">
        <button type="button" className="btn btnGhost btnIcon btnCompact" onClick={reload} aria-label="Refresh" title="Refresh" data-nolog>
          <IconRefresh size={16} />
        </button>
        <button type="button" className="btn btnPrimary btnCompact" onClick={() => openEditor(null)} disabled={load.status !== 'ready'}>
          <IconPlus size={16} />
          New announcement
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      titleId="announcementManagerTitle"
      title={editing ? (editing.id ? 'Edit announcement' : 'New announcement') : 'Announcements manager'}
      subtitle={editing ? 'Write it in Advanced or Raw mode, with a live preview.' : 'Create, edit and review announcements, and see how they do.'}
      size="wide"
      onClose={closeManager}
      toolbar={toolbar}
      footer={
        <button type="button" className="btn btnSecondary" onClick={closeManager} data-autofocus>
          Done
        </button>
      }
    >
      {load.status === 'loading' && (
        <div aria-busy="true">
          <div className="skeleton skeletonCard" />
        </div>
      )}

      {load.status === 'denied' && (
        <div className="stateBox" role="alert">
          <IconLock size={20} />
          <strong>You cannot open the manager</strong>
          <span>{load.message}</span>
        </div>
      )}

      {load.status === 'error' && (
        <div className="stateBox" role="alert">
          <span>The announcements could not be loaded.</span>
          <button type="button" className="btn btnSecondary btnCompact" onClick={reload}>Try again</button>
        </div>
      )}

      {load.status === 'ready' && (
        <>
          {data.volatile && (
            <div className="stateBox" role="alert">
              <IconWarning size={18} />
              <span>Announcements can only be changed once the Upstash Redis database is connected to this project. You can read everything until then.</span>
            </div>
          )}

          {notice?.text && !editing && <p className="helperText acctNote annoNotice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

          {editing ? (
            <Editor key={editing.id || 'new'} editing={editing} viewer={viewer} volatile={data.volatile} dirtyRef={dirtyRef} onBack={closeEditor} onSaved={saved} />
          ) : (
            <>
              {view === 'list' && (
                <>
                  <div className="logToolbar annoListTools">
                    <label className="boostField logSearch">
                      <IconSearch size={18} />
                      <input className="searchInput" type="text" value={query} placeholder="Search title, author or url..." aria-label="Search announcements" autoComplete="off" spellCheck={false} data-nolog onChange={(event) => setQuery(event.target.value)} />
                    </label>
                    <div className="segmented" role="group" aria-label="Filter">
                      {[['all', 'All'], ['mine', viewer.admin ? 'Can edit' : 'Mine'], ...TYPE_ORDER.map((type) => [type, TYPE_META[type].plural])].map(([id, label]) => (
                        <button key={id} type="button" className="segment" aria-pressed={filter === id} onClick={() => setFilter(id)} data-nolog>{label}</button>
                      ))}
                    </div>
                  </div>
                  <ListView items={data.items} query={query} filter={filter} pending={pending} busyId={busyId} onEdit={openEditor} onDelete={remove} />
                </>
              )}
              {view === 'stats' && <StatsView stats={data.stats} />}
              {view === 'guide' && <GuideView />}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
