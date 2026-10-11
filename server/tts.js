// Neural speech through the Azure Speech REST API (free tier, es-ES voices).
// The text a client may synthesize is limited to what the server itself wrote:
// each clip carries an HMAC signature, so the endpoint cannot be used as a free
// text-to-speech proxy.
import { cacheGet, cachePut, sha256Hex } from './cache.js';

export const VOICES = { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural' };
export const VOICE_NAMES = { 'es-ES-ElviraNeural': 'Elvira', 'es-ES-AlvaroNeural': 'Álvaro' };
export const MAX_CLIP_CHARS = 3500;
const CHUNK_CHARS = 2400;
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

/** @param {{AZURE_SPEECH_KEY?: string, AZURE_SPEECH_REGION?: string, AZURE_SPEECH_ENDPOINT?: string}} env */
export const ttsAvailable = env => Boolean(env.AZURE_SPEECH_KEY && (env.AZURE_SPEECH_REGION || env.AZURE_SPEECH_ENDPOINT));

const secret = env => env.AUDIO_SIGNING_SECRET || env.AZURE_SPEECH_KEY || '';
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(env, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}
export const signClip = (text, voice, env) => hmac(env, voice + '\n' + text);
export async function verifyClip(text, voice, sig, env) {
  if (!secret(env) || typeof sig !== 'string') return false;
  const expected = await signClip(text, voice, env);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Narrator for story `index` given the listener's choice. */
export function voiceFor(index, mode) {
  const role = mode === 'male' ? 'male' : mode === 'female' ? 'female' : index % 2 === 0 ? 'female' : 'male';
  return VOICES[role];
}

const xmlEscape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function ssml(text, voice) {
  return `<speak version='1.0' xml:lang='es-ES' xmlns='http://www.w3.org/2001/10/synthesis'><voice name='${voice}'>${xmlEscape(text)}</voice></speak>`;
}

/** Splits at sentence ends so each request stays well below the service limits. */
export function splitText(text, max = CHUNK_CHARS) {
  const sentences = text.match(/[^.!?…]+[.!?…]+["»”’)]*\s*|[^.!?…]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (let sentence of sentences) {
    while (sentence.length > max) { // pathological sentence without punctuation
      const cut = sentence.lastIndexOf(' ', max) > 0 ? sentence.lastIndexOf(' ', max) : max;
      if (current) { chunks.push(current.trim()); current = ''; }
      chunks.push(sentence.slice(0, cut).trim()); sentence = sentence.slice(cut);
    }
    if (current && current.length + sentence.length > max) { chunks.push(current.trim()); current = ''; }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

async function speak(chunk, voice, env, fetcher) {
  const endpoint = (env.AZURE_SPEECH_ENDPOINT || `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com`).replace(/\/$/, '') + '/cognitiveservices/v1';
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY || '', 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': OUTPUT_FORMAT, 'User-Agent': 'brujula' },
    body: ssml(chunk, voice),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('tts-' + response.status);
  return new Uint8Array(await response.arrayBuffer());
}

/** @returns {Promise<Uint8Array>} MP3 bytes (constant bitrate, so chunks can simply be concatenated). */
export async function synthesizeSpeech(text, voice, env, fetcher = fetch) {
  const key = 'tts/' + await sha256Hex(voice + '\n' + text);
  const cached = await cacheGet(key);
  if (cached) return new Uint8Array(cached);
  const parts = [];
  for (const chunk of splitText(text)) parts.push(await speak(chunk, voice, env, fetcher));
  const audio = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { audio.set(part, offset); offset += part.length; }
  if (!audio.length) throw new Error('tts-empty');
  await cachePut(key, audio.buffer, 6 * 3600);
  return audio;
}
