import test from 'node:test';
import assert from 'node:assert/strict';
import { feedlyToRSS, readRSSFeed } from '../server/rss-feed.js';
import { parseFeed, sources } from '../server/news.js';

const source = sources.find(s => s.id === 'infobae');
const feedURL = source.feeds[0].url;
const now = Date.UTC(2026, 9, 11, 10);
const item = (extra = {}) => ({ title: 'La vivienda en Madrid', published: now - 3600000, alternate: [{ type: 'text/html', href: 'https://www.infobae.com/espana/2026/10/11/vivienda/' }], origin: { streamId: 'feed/' + feedURL }, summary: { content: '<p>El ayuntamiento presenta un plan.</p>' }, content: { content: 'FULL_ARTICLE_MUST_NOT_BE_USED' }, ...extra });
const stream = (items, url = feedURL) => ({ id: 'feed/' + url, items });

test('The mirror retains publisher dates, excerpts, attribution and original URLs', () => {
  const xml = feedlyToRSS(stream([item()]), feedURL);
  const [article] = parseFeed(xml, source, now);
  assert.equal(article.sourceName, 'Infobae España');
  assert.equal(article.url, item().alternate[0].href);
  assert.equal(article.excerpt, 'El ayuntamiento presenta un plan.');
  assert.equal(article.publishedAt, new Date(item().published).toISOString());
  assert.equal(xml.includes('FULL_ARTICLE_MUST_NOT_BE_USED'), false);
  const direct = `<rss><channel><item><title>La vivienda en Madrid</title><link>${article.url}</link><pubDate>${new Date(item().published).toUTCString()}</pubDate></item></channel></rss>`;
  assert.equal(article.id, parseFeed(direct, source, now)[0].id);
});

test('Mirrored items cannot bypass publisher, publication-date or freshness checks', () => {
  const entries = [item(), item({ published: now - 72 * 3600000 }), item({ published: now + 3600000 }), item({ published: undefined, crawled: now }), item({ alternate: [{ type: 'text/html', href: 'https://infobae.com.attacker.test/story/' }] }), item({ origin: { streamId: 'feed/https://another.test/rss' } })];
  assert.equal(parseFeed(feedlyToRSS(stream(entries), feedURL), source, now).length, 1);
  assert.throws(() => feedlyToRSS(stream([], 'https://another.test/rss'), feedURL), /Unexpected RSS mirror stream/);
});

test('Direct RSS stays first; only configured mirrors run after failure and are cached', async () => {
  const feed = { url: feedURL + '?cache-test=1', fallback: 'feedly' };
  const entry = item({ origin: { streamId: 'feed/' + feed.url } });
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push(url);
    if (url === feed.url) return new Response('', { status: 403 });
    const relay = new URL(url);
    assert.equal(relay.origin, 'https://cloud.feedly.com');
    assert.equal(relay.searchParams.get('streamId'), 'feed/' + feed.url);
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.headers['OAI-Sites-Authorization'], undefined);
    return new Response(JSON.stringify(stream([entry], feed.url)));
  };
  const first = await readRSSFeed(feed, fetcher);
  const second = await readRSSFeed(feed, fetcher);
  assert.equal(first.relayed, true);
  assert.equal(second.xml, first.xml);
  assert.equal(requests.filter(url => url.startsWith('https://cloud.feedly.com')).length, 1);
  let directCalls = 0;
  const direct = await readRSSFeed(feed, async url => { assert.equal(url, feed.url); directCalls++; return new Response('<rss><channel/></rss>'); });
  assert.equal(direct.relayed, false);
  assert.equal(directCalls, 1);
});

test('Unavailable or unconfigured mirrors fail rather than supplying fabricated news', async () => {
  let requests = 0;
  await assert.rejects(readRSSFeed({ url: 'https://other.test/rss' }, async () => { requests++; return new Response('', { status: 403 }); }), /RSS HTTP 403/);
  assert.equal(requests, 1);
  await assert.rejects(readRSSFeed({ url: feedURL + '?unavailable=1', fallback: 'feedly' }, async () => new Response('', { status: 429 })), /RSS HTTP 429/);
});
