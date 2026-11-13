/**
 * links.ts: finds creator profiles in a WhatsApp chat export, or in any
 * pasted text, for the CRM's import. Pure: no React and no network, so all
 * of it is unit tested. The chat itself never leaves the browser; only the
 * profiles chosen are saved.
 */

import type { CreatorFields } from '../supabase/admin';
import type { Platform } from './format';

/** Where a profile lives. The CRM keeps Instagram, YouTube and X as their
 *  own platforms, and the rest as other with the site named in the notes. */
export type Site =
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'snapchat'
  | 'linktree';

export const SITE_LABEL: Record<Site, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  linktree: 'Linktree',
};

export interface Profile {
  site: Site;
  /** As the CRM shows it: "@fit.rahul", or a name or id where a site has
   *  no @ handles (a LinkedIn slug, a YouTube channel id). Lower case. */
  handle: string;
  /** The profile's own address, without tracking. */
  url: string;
}

/** A link to one post, reel or video: it doesn't say whose it is. */
export type Post = 'post';

const HOSTS: Record<string, Site> = {
  'instagram.com': 'instagram',
  'instagr.am': 'instagram',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'x.com': 'x',
  'twitter.com': 'x',
  'threads.net': 'threads',
  'threads.com': 'threads',
  'tiktok.com': 'tiktok',
  'linkedin.com': 'linkedin',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'snapchat.com': 'snapchat',
  'linktr.ee': 'linktree',
};

const IG_HANDLE = /^[a-z0-9._]{1,30}$/;
const X_HANDLE = /^[a-z0-9_]{1,15}$/;
const AT_HANDLE = /^@[a-z0-9._]{1,30}$/;
const YT_HANDLE = /^@[a-z0-9._-]{3,30}$/;
const NAME = /^[a-z0-9._-]{2,100}$/;

const IG_POSTS = new Set(['p', 'reel', 'reels', 'tv', 'share', 's']);
const IG_PAGES = new Set([
  'explore',
  'accounts',
  'direct',
  'about',
  'legal',
  'developer',
  'web',
  'ar',
  'privacy',
]);
const X_PAGES = new Set([
  'i',
  'home',
  'search',
  'explore',
  'hashtag',
  'intent',
  'share',
  'settings',
  'notifications',
  'messages',
  'compose',
  'login',
  'signup',
  'tos',
  'privacy',
]);
const YT_POSTS = new Set(['watch', 'shorts', 'live', 'embed', 'playlist']);
const FB_POSTS = new Set([
  'share',
  'watch',
  'reel',
  'photo',
  'photo.php',
  'story.php',
  'permalink.php',
  'posts',
  'videos',
]);
const FB_PAGES = new Set([
  'groups',
  'events',
  'login',
  'sharer',
  'sharer.php',
  'marketplace',
  'help',
  'policies',
  'pages',
  'profile.php',
]);

/**
 * The profile a link points at; 'post' for a social link that names no one
 * (a reel, a video, a short link); null for anything else.
 */
export function profileFromUrl(raw: string): Profile | Post | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const base = Object.keys(HOSTS).find(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!base) return null;
  const site = HOSTS[base];
  const segs = u.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).toLowerCase();
      } catch {
        return s.toLowerCase();
      }
    });
  const [a, b] = segs;

  switch (site) {
    case 'instagram': {
      if (!a) return null;
      if (IG_POSTS.has(a)) return 'post';
      if (IG_PAGES.has(a)) return null;
      const h = a === 'stories' || a === '_u' ? b : a;
      return h && IG_HANDLE.test(h)
        ? { site, handle: `@${h}`, url: `https://www.instagram.com/${h}/` }
        : null;
    }
    case 'youtube': {
      if (base === 'youtu.be') return 'post';
      if (!a) return null;
      if (YT_POSTS.has(a)) return 'post';
      if (YT_HANDLE.test(a)) {
        return { site, handle: a, url: `https://www.youtube.com/${a}` };
      }
      if ((a === 'c' || a === 'user') && b && NAME.test(b)) {
        return { site, handle: b, url: `https://www.youtube.com/${a}/${b}` };
      }
      if (a === 'channel' && b && /^uc[a-z0-9_-]{22}$/.test(b)) {
        // Channel ids are case sensitive: keep the link exactly as shared.
        const id = u.pathname.split('/').filter(Boolean)[1];
        return {
          site,
          handle: id,
          url: `https://www.youtube.com/channel/${id}`,
        };
      }
      return null;
    }
    case 'x': {
      if (!a || X_PAGES.has(a) || !X_HANDLE.test(a)) return null;
      // A post's link still names its author: x.com/handle/status/123.
      return { site, handle: `@${a}`, url: `https://x.com/${a}` };
    }
    case 'threads':
    case 'tiktok': {
      if (site === 'tiktok' && /^(vm|vt)\./.test(host)) return 'post';
      if (a && AT_HANDLE.test(a)) {
        const url =
          site === 'tiktok'
            ? `https://www.tiktok.com/${a}`
            : `https://www.threads.net/${a}`;
        return { site, handle: a, url };
      }
      return a === 't' || a === 'video' ? 'post' : null;
    }
    case 'linkedin': {
      if (a === 'in' && b && NAME.test(b)) {
        return { site, handle: b, url: `https://www.linkedin.com/in/${b}/` };
      }
      return a === 'posts' || a === 'feed' ? 'post' : null;
    }
    case 'facebook': {
      if (!a) return null;
      if (FB_POSTS.has(a)) return 'post';
      if (FB_PAGES.has(a) || !/^[a-z0-9.]{5,50}$/.test(a)) return null;
      return { site, handle: a, url: `https://www.facebook.com/${a}` };
    }
    case 'snapchat': {
      const h = a === 'add' ? b : a?.startsWith('@') ? a.slice(1) : null;
      return h && /^[a-z0-9._-]{3,15}$/.test(h)
        ? { site, handle: `@${h}`, url: `https://www.snapchat.com/add/${h}` }
        : null;
    }
    case 'linktree': {
      return a && IG_HANDLE.test(a)
        ? { site, handle: `@${a}`, url: `https://linktr.ee/${a}` }
        : null;
    }
  }
}

// ---- WhatsApp's export ----------------------------------------------------------

export interface ChatMessage {
  /** The date as the export wrote it ("12/11/26"), kept as written: the
   *  order of day and month depends on the phone's settings. */
  when: string | null;
  sender: string | null;
  text: string;
}

const TIME = String.raw`\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:[\s ]?[ap]\.?\s?m\.?)?`;
const DATE = String.raw`\d{1,4}[./-]\d{1,2}[./-]\d{1,4}`;
/** iPhone: "[12/11/26, 9:05:12 PM] Pratham: text". */
const IPHONE = new RegExp(String.raw`^\[(${DATE}),?\s+${TIME}\]\s+(.*)$`, 'i');
/** Android: "12/11/2026, 21:05 - Pratham: text". */
const ANDROID = new RegExp(
  String.raw`^(${DATE}),?\s+${TIME}\s+[-–—]\s+(.*)$`,
  'i',
);

/**
 * The messages in a WhatsApp export, either phone's format. A line that
 * doesn't start a message continues the one before it. Text with no
 * WhatsApp lines at all (pasted links, notes) reads as one message.
 */
export function parseChat(text: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // iPhone exports mark every line with invisible direction characters.
    const line = raw.replace(/[‎‏﻿]/g, '');
    const m = IPHONE.exec(line) ?? ANDROID.exec(line);
    if (m) {
      const rest = m[2];
      const colon = rest.indexOf(': ');
      out.push(
        colon > 0
          ? {
              when: m[1],
              sender: rest.slice(0, colon),
              text: rest.slice(colon + 2),
            }
          : { when: m[1], sender: null, text: rest },
      );
    } else if (out.length) {
      out[out.length - 1].text += `\n${line}`;
    } else if (line.trim()) {
      out.push({ when: null, sender: null, text: line });
    }
  }
  return out;
}

const URL_RE =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"'`()[\]{}]*/gi;

/** Every link in a piece of text, without trailing punctuation. */
export function linksIn(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((l) => l.replace(/[.,;:!?…*_~]+$/, ''));
}

export interface Found {
  profile: Profile;
  /** When it was first shared, as the export wrote it. */
  when: string | null;
  /** The message it came in, without the links: often who they are. */
  context: string;
  /** How many times it was shared in the chat. */
  mentions: number;
}

export interface Scan {
  profiles: Found[];
  /** Post and video links, which name no one. */
  posts: { url: string; when: string | null; context: string }[];
}

const contextOf = (text: string) => {
  const t = text.replace(URL_RE, ' ').replace(/\s+/g, ' ').trim();
  return t.length > 280 ? `${t.slice(0, 279)}…` : t;
};

/** Every profile shared in the chat, once each, in the order first shared. */
export function scanChat(text: string): Scan {
  const profiles = new Map<string, Found>();
  const posts = new Map<string, Scan['posts'][number]>();
  for (const msg of parseChat(text)) {
    for (const link of linksIn(msg.text)) {
      const p = profileFromUrl(link);
      if (p === 'post') {
        const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
        if (!posts.has(url)) {
          posts.set(url, { url, when: msg.when, context: contextOf(msg.text) });
        }
      } else if (p) {
        const key = `${p.site}:${p.handle}`;
        const seen = profiles.get(key);
        if (seen) seen.mentions += 1;
        else {
          profiles.set(key, {
            profile: p,
            when: msg.when,
            context: contextOf(msg.text),
            mentions: 1,
          });
        }
      }
    }
  }
  return { profiles: [...profiles.values()], posts: [...posts.values()] };
}

// ---- Into the CRM -----------------------------------------------------------------

/** One creator to add: everything found for one handle. */
export interface ImportRow {
  /** The handle without its @, lower case: one creator per handle. */
  key: string;
  name: string;
  handle: string;
  platform: Platform;
  /** Every profile of theirs in the chat, main one first. */
  profiles: Profile[];
  when: string | null;
  context: string;
  mentions: number;
  /** Someone with this handle is already in the CRM. */
  existing: boolean;
}

/** Which profile leads when one handle is on several sites. */
const ORDER: Site[] = [
  'instagram',
  'youtube',
  'x',
  'threads',
  'tiktok',
  'linkedin',
  'facebook',
  'snapchat',
  'linktree',
];

const bare = (handle: string) => handle.replace(/^@/, '').toLowerCase();

/** A CRM handle as the import compares it: a pasted link reads as its handle. */
function crmKey(handle: string | null): string | null {
  const h = handle?.trim();
  if (!h) return null;
  const p = h.includes('/') ? profileFromUrl(h) : null;
  return bare(p && p !== 'post' ? p.handle : h);
}

export const crmPlatform = (site: Site): Platform =>
  site === 'instagram' || site === 'youtube' || site === 'x' ? site : 'other';

/**
 * The creators to add, one per handle. The same handle on Instagram and
 * YouTube is one person with two profiles. Anyone whose handle is already in
 * the CRM is marked, on any platform, so nobody is added twice.
 */
export function importRows(
  scan: Scan,
  existing: { handle: string | null }[],
): ImportRow[] {
  const known = new Set(existing.map((c) => crmKey(c.handle)).filter(Boolean));
  const rows = new Map<string, ImportRow>();
  for (const f of scan.profiles) {
    const key = bare(f.profile.handle);
    const row = rows.get(key);
    if (row) {
      row.profiles.push(f.profile);
      row.mentions += f.mentions;
      if (!row.context) row.context = f.context;
      continue;
    }
    rows.set(key, {
      key,
      name: key,
      handle: f.profile.handle,
      platform: crmPlatform(f.profile.site),
      profiles: [f.profile],
      when: f.when,
      context: f.context,
      mentions: f.mentions,
      existing: known.has(key),
    });
  }
  return [...rows.values()].map((r) => {
    const profiles = [...r.profiles].sort(
      (a, b) => ORDER.indexOf(a.site) - ORDER.indexOf(b.site),
    );
    return {
      ...r,
      profiles,
      handle: profiles[0].handle,
      platform: crmPlatform(profiles[0].site),
    };
  });
}

/** A new prospect, with where they came from and every link in the notes. */
export function rowToCreator(row: ImportRow): CreatorFields {
  const from = row.when
    ? `From WhatsApp, shared ${row.when}`
    : 'From imported links';
  const notes = [
    row.context ? `${from}: ${row.context}` : from,
    ...row.profiles.map((p) => `${SITE_LABEL[p.site]}: ${p.url}`),
  ].join('\n');
  return {
    name: row.name,
    handle: row.handle,
    platform: row.platform,
    niche: null,
    city: null,
    country: null,
    email: null,
    phone: null,
    stage: 'prospect',
    next_follow_up: null,
    grain_user_id: null,
    track_record: null,
    notes,
  };
}
