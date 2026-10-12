import { XMLBuilder } from 'fast-xml-parser';
import { cacheGetJSON, cachePutJSON, sha256Hex } from './cache.js';

const MAX_BYTES = 3_000_000;
const builder = new XMLBuilder();
const headers = { 'User-Agent': 'Brujula/2.0 (RSS news reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'Cache-Control': 'no-cache' };

async function responseText(response) {
  if (!response.ok) throw new Error('RSS HTTP ' + response.status);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error('Feed too large');
  return text;
}

// Keep the publisher's RSS summary, original URL and publication date. Full
// article content and crawler timestamps are deliberately excluded.
export function feedlyToRSS(data, feedURL) {
  const streamId = 'feed/' + feedURL;
  if (data?.id !== streamId || !Array.isArray(data.items)) throw new Error('Unexpected RSS mirror stream');
  const items = data.items.slice(0, 100).flatMap(item => {
    if (!item || typeof item.title !== 'string' || !Number.isFinite(item.published) || item.origin?.streamId && item.origin.streamId !== streamId) return [];
    const published = new Date(item.published);
    if (Number.isNaN(+published)) return [];
    const links = Array.isArray(item.alternate) ? item.alternate : [];
    const link = links.find(a => a?.type === 'text/html' && typeof a.href === 'string')?.href || item.canonicalUrl;
    if (typeof link !== 'string') return [];
    return [{ title: item.title, link, pubDate: published.toUTCString(), description: typeof item.summary?.content === 'string' ? item.summary.content : '' }];
  });
  return builder.build({ rss: { channel: { item: items } } });
}

export async function readRSSFeed(feed, fetcher = fetch) {
  try {
    const response = await fetcher(feed.url, { headers, signal: AbortSignal.timeout(8000) });
    return { xml: await responseText(response), relayed: false };
  } catch (error) {
    if (feed.fallback !== 'feedly') throw error;
    // Only the explicitly configured public feed is sent to the mirror. No
    // user profile, API credentials or Site authorization headers are shared.
    const key = 'rss-feedly/' + await sha256Hex(feed.url);
    const cached = await cacheGetJSON(key);
    if (typeof cached?.xml === 'string') return { xml: cached.xml, relayed: true };
    const url = new URL('https://cloud.feedly.com/v3/streams/contents');
    url.searchParams.set('streamId', 'feed/' + feed.url);
    url.searchParams.set('count', '100');
    const response = await fetcher(url.href, { headers: { 'User-Agent': headers['User-Agent'], Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const xml = feedlyToRSS(JSON.parse(await responseText(response)), feed.url);
    await cachePutJSON(key, { xml }, 300);
    return { xml, relayed: true };
  }
}
