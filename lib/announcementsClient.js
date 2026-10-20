// ============================================================================
// announcementsClient.js
// Browser-side helpers for announcements:
//   useAnnouncementFeed   the list (page and home panel) with optimistic favourites
//   fetchAnnouncement     one announcement with its full text
//   requestFavourite      favourite or unfavourite (a visitor is sent to the Discord login)
//   sendView              counts a view
//   announceChange        tells the other tabs (and the page) that something changed
//   uploadMedia           shrinks pictures and uploads an image or video in pieces
// It imports nothing from the shell, so any component can use it without an import loop.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { formatRemaining, openSync, sendJson } from './accountClient';
import { MEDIA_LIMITS } from './announcementMarkup';

const CHANNEL = 'kyriadon-announcements';

// ----------------------------------------------------------------------------
// Dates
// ----------------------------------------------------------------------------
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

export const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
};

export const formatWhen = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// "2d 4h" until a deleted announcement disappears
export const timeLeft = (expiresAt) => formatRemaining(Math.max(0, expiresAt - Date.now()));

// ----------------------------------------------------------------------------
// Tabs and the manager tell each other when something changed
// ----------------------------------------------------------------------------
export function announceChange() {
  const sync = openSync(CHANNEL, () => {});
  sync.send({ at: Date.now() });
  setTimeout(() => sync.close(), 300);
}

// ----------------------------------------------------------------------------
// Requests
// ----------------------------------------------------------------------------

// One announcement by id or url path, or null
export async function fetchAnnouncement({ id, slug }) {
  try {
    const query = id ? `id=${encodeURIComponent(id)}` : `slug=${encodeURIComponent(slug)}`;
    const response = await fetch(`/api/announcements?${query}`, { cache: 'no-store' });
    if (!response.ok) return { error: true };
    const data = await response.json();
    return { item: data.item || null, viewer: data.viewer };
  } catch {
    return { error: true };
  }
}

// Fire and forget: a view never blocks reading
export function sendView(id) {
  sendJson('/api/announcements/interact', 'POST', { action: 'view', id }).catch(() => {});
}

// Favourite or unfavourite. A visitor is sent to the Discord login instead.
export async function requestFavourite(id, on, signedIn) {
  if (!signedIn) {
    signIn('discord');
    return { ok: false, code: 'login' };
  }
  try {
    const { data } = await sendJson('/api/announcements/interact', 'POST', { action: on ? 'favourite' : 'unfavourite', id });
    return data || { ok: false, message: 'The favourite could not be saved. Try again.' };
  } catch {
    return { ok: false, message: 'Could not reach the server. Try again.' };
  }
}

// ----------------------------------------------------------------------------
// The list. status: loading | ready | error. A favourite changes on screen at once and goes
// back if the server refuses. Other tabs and the manager trigger a quiet reload.
// ----------------------------------------------------------------------------
export function useAnnouncementFeed({ limit = 4, type = '' } = {}) {
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, viewer: { signedIn: false, favourites: [] } });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(
    async (silent) => {
      if (!silent) setState((previous) => ({ ...previous, status: 'loading' }));
      try {
        const response = await fetch(`/api/announcements?limit=${limit}${type ? `&type=${type}` : ''}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();
        setState({ status: 'ready', items: data.announcements || [], total: data.total || 0, viewer: data.viewer || { signedIn: false, favourites: [] } });
      } catch {
        setState((previous) => ({ ...previous, status: silent && previous.items.length ? 'ready' : 'error' }));
      }
    },
    [limit, type],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // A change in another tab, or in the manager, reloads the list without a loading state
  useEffect(() => {
    const sync = openSync(CHANNEL, () => load(true));
    return () => sync.close();
  }, [load]);

  const toggleFavourite = useCallback(async (item, on) => {
    const { viewer } = stateRef.current;
    if (!viewer.signedIn) return requestFavourite(item.id, on, false);

    const apply = (value) =>
      setState((previous) => ({
        ...previous,
        // A deleted announcement leaves the list as soon as it is unfavourited
        items: previous.items.flatMap((entry) => {
          if (entry.id !== item.id) return [entry];
          return entry.deleted && !value ? [] : [{ ...entry, favourited: value }];
        }),
      }));

    apply(on);
    const result = await requestFavourite(item.id, on, true);
    if (!result.ok) apply(!on);
    return result;
  }, []);

  return { ...state, reload: () => load(false), refresh: () => load(true), toggleFavourite };
}

// ----------------------------------------------------------------------------
// Uploads. A picture is shrunk in the browser (at most 1920 pixels, WebP or JPEG) unless it
// is a GIF, then every file is sent in pieces of 400 KB and finished with one last request.
// ----------------------------------------------------------------------------
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    image.src = url;
  });
}

const canvasBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// The picture, shrunk when it is large. Returns a Blob.
async function prepareImage(file) {
  if (file.type === 'image/gif') return file;
  const image = await loadBitmap(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (file.size <= 1.5 * 1024 * 1024 && longest <= 1920) return file;

  const ratio = Math.min(1, 1920 / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return (await canvasBlob(canvas, 'image/webp', 0.86)) || (await canvasBlob(canvas, 'image/jpeg', 0.86)) || file;
}

// base64 of an ArrayBuffer, in steps so a large piece never overflows the call stack
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Uploads one file. onProgress receives 0 to 1. Resolves { ok, url, kind, name } or { ok: false, message }.
export async function uploadMedia(file, onProgress = () => {}) {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) return { ok: false, message: 'Use a PNG, JPEG, WebP, GIF, MP4 or WebM file.' };

  let blob = file;
  try {
    if (isImage) blob = await prepareImage(file);
  } catch {
    return { ok: false, message: 'That image could not be opened.' };
  }

  const limit = isImage ? MEDIA_LIMITS.imageBytes : MEDIA_LIMITS.videoBytes;
  if (blob.size > limit) return { ok: false, message: `${isImage ? 'Images' : 'Videos'} can be ${Math.round(limit / 1024 / 1024)} MB at most. This one is ${(blob.size / 1024 / 1024).toFixed(1)} MB.` };

  const size = MEDIA_LIMITS.chunkBytes;
  const total = Math.ceil(blob.size / size);
  let uploadId;
  try {
    for (let index = 0; index < total; index += 1) {
      const data = toBase64(await blob.slice(index * size, (index + 1) * size).arrayBuffer());
      const { data: answer } = await sendJson('/api/staff/announcementMedia', 'POST', { op: 'chunk', uploadId, index, total, name: file.name, data });
      if (!answer?.ok) return { ok: false, message: answer?.message || answer?.error || 'The upload failed. Try again.' };
      uploadId = answer.uploadId;
      onProgress((index + 1) / (total + 1));
    }
    const { data: done } = await sendJson('/api/staff/announcementMedia', 'POST', { op: 'finish', uploadId });
    if (!done?.ok) return { ok: false, message: done?.message || done?.error || 'The upload failed. Try again.' };
    onProgress(1);
    return { ok: true, url: done.url, kind: done.kind, name: done.name || file.name };
  } catch {
    return { ok: false, message: 'Could not reach the server. Try again.' };
  }
}
