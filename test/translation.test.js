import test from 'node:test';
import assert from 'node:assert/strict';
import { translateArticles, validateTranslation, TRANSLATION_PROMPT } from '../server/translation.js';
import { isEnglishArticle, translatedArticle, translationMatches } from '../public/translation.js';
import { bulletinStory, storyNarration } from '../public/narration.js';
import { api } from '../server/handler.js';
import { getNews } from '../server/news.js';
const article = (id = 'translate-a') => ({ id, title: 'Pearl Jam announce 3 shows', excerpt: 'Tickets cost 15 euros.', source: 'nme', sourceName: 'NME', url: 'https://www.nme.com/news/music/story' });
const translation = id => ({ id, title: 'Pearl Jam anuncia 3 conciertos', excerpt: 'Las entradas cuestan 15 euros.' });
const response = values => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: values }) }] } }] }));
const env = { GEMINI_API_KEY: 'test' };
test('English sources and feed language are recognized without tagging Spanish or historical stories', () => {
  assert.equal(isEnglishArticle(article()), true);
  assert.equal(isEnglishArticle({ ...article(), source: 'elpais', language: 'en' }), true);
  assert.equal(isEnglishArticle({ ...article(), language: 'es' }), false);
  assert.equal(isEnglishArticle({ ...article(), source: 'elpais' }), false);
  assert.equal(isEnglishArticle({ ...article(), kind: 'anniversary' }), false);
});
test('Translations keep IDs, empty excerpts, signed figures and safe plain text', () => {
  const a = article(); assert.equal(validateTranslation(translation(a.id), a), true);
  assert.equal(validateTranslation({ ...translation(a.id), title: 'Pearl Jam anuncia 4 conciertos' }, a), false);
  assert.equal(validateTranslation({ ...translation(a.id), excerpt: '' }, a), false);
  assert.equal(validateTranslation({ ...translation(a.id), title: '<b>3</b>' }, a), false);
  assert.equal(validateTranslation({ id: 'x', title: 'Temperatura: 5 grados', excerpt: '' }, { id: 'x', title: 'Temperature: -5 degrees', excerpt: '' }), false);
  assert.equal(validateTranslation({ id: 'x', title: 'Temperatura: -5 grados', excerpt: '' }, { id: 'x', title: 'Temperature: -5 degrees', excerpt: '' }), true);
});
test('Matching cached translations never change IDs, URLs, dates or source classification', () => {
  const a = article(), t = { ...translation(a.id), language: 'es' };
  const record = { originalTitle: a.title, originalExcerpt: a.excerpt, translation: t };
  assert.equal(translationMatches(record, a), true);
  assert.equal(translationMatches(record, { ...a, title: 'Updated headline' }), false);
  const localized = translatedArticle({ ...a, translation: t });
  assert.equal(localized.url, a.url); assert.equal(localized.source, a.source); assert.equal(localized.id, a.id);
  assert.equal(a.title, 'Pearl Jam announce 3 shows');
});
test('Identical concurrent batches are generated once, cached and reused without provider access', async () => {
  const a = article('translation-cache'); let calls = 0;
  const fetcher = async (_url, init) => {
    calls++;const request = JSON.parse(init.body); assert.equal(request.systemInstruction.parts[0].text, TRANSLATION_PROMPT);
    assert.deepEqual(JSON.parse(request.contents[0].parts[0].text).articles, [{ id: a.id, title: a.title, excerpt: a.excerpt }]);
    await new Promise(r => setImmediate(r)); return response([translation(a.id)]);
  };
  const [one,two] = await Promise.all([translateArticles([a],env,fetcher),translateArticles([a],env,fetcher)]);
  assert.equal(calls, 1); assert.deepEqual(one,two);
  assert.deepEqual(await translateArticles([a],{},()=>{throw Error('must use cache');}),one);
});
test('Unavailable providers and invalid translations do not invent translated content', async () => {
  await assert.rejects(translateArticles([article('unavailable-translation')],{}), /translation-unavailable/);
  for (const [i, values] of [[0, []], [1, [{ ...translation('bad-1'), id: 'other' }]], [2, [{ ...translation('bad-2'), title: '99 conciertos' }]]]) {
    await assert.rejects(translateArticles([article('bad-'+i)],env,()=>response(values)));
  }
});
test('A model returning 404 falls back to the next configured Gemini model', async () => {
  const a = article('model-fallback');const urls=[];
  const result=await translateArticles([a],env,async url=>{urls.push(String(url));return urls.length===1?new Response('',{status:404}):response([translation(a.id)]);});
  assert.equal(result[0].language,'es'); assert.equal(urls.length,2);
  assert.ok(urls[0].includes('gemini-3.5-flash-lite')); assert.ok(urls[1].includes('gemini-3.8-flash'));
});
test('Device fallback reads the translated headline and excerpt once, preserving an AI summary', () => {
  const a=article(), translated={...a,translation:{...translation(a.id),language:'es'}};
  const raw={text:a.title+'. '+a.excerpt,sourceIds:[a.id]};
  const story=bulletinStory(raw,[translated],[]), spoken=storyNarration(story);
  assert.match(story.title,/anuncia 3 conciertos/);assert.match(story.body,/Las entradas/);
  assert.ok(!spoken.includes('announce'));assert.equal(spoken.split('Pearl Jam').length-1,1);
  const ai=bulletinStory({text:'Según NME, la banda prepara una gira.',sourceIds:[a.id]},[translated],[]);
  assert.equal(ai.body,'Según NME, la banda prepara una gira.');
});
test('The API translates only current server-sourced articles and returns Spanish narration with original metadata', async () => {
  const original=globalThis.fetch;let modelCalls=0;
  const pub=new Date(Date.now()-3600000).toUTCString();
  globalThis.fetch=async (url,init={})=>{
    const href=String(url);
    if(href.includes('generativelanguage')){
      modelCalls++;const prompt=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
      if(prompt.task.startsWith('Traduce'))return response(prompt.articles.map(a=>translation(a.id)));
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({items:prompt.articles.map(a=>({text:a.title+'. '+a.excerpt,sourceIds:[a.id]}))})}]}}]}));
    }
    return new Response(`<rss><channel><language>${href.includes('nme.com')?'en':'es'}</language>${href.includes('nme.com')?`<item><title>Pearl Jam announce 3 shows</title><description>Tickets cost 15 euros.</description><link>https://www.nme.com/news/music/story</link><pubDate>${pub}</pubDate></item>`:''}</channel></rss>`);
  };
  const configured={...env,AZURE_SPEECH_KEY:'test',AZURE_SPEECH_REGION:'westeurope'};
  const post=(path,body,origin)=>api(new Request('https://brujula.test'+path,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)}),configured);
  try{
    const news=await getNews();const a=news.articles[0];assert.equal(a.language,'en');
    const translated=await(await post('/api/translate',{id:a.id})).json();assert.match(translated.translation.title,/anuncia/);assert.equal(translated.translation.originalTitle,a.title);
    assert.equal(modelCalls,1);
    const edition=await(await post('/api/edition',{scope:'personal',hours:24,length:'short',preferences:{musica:3},profile:{includeAnniversaries:false},audio:true})).json();
    assert.equal(edition.mode,'ai');assert.equal(edition.articles[0].title,a.title);
    assert.equal(edition.articles[0].url,a.url);assert.equal(edition.articles[0].id,a.id);
    assert.match(edition.articles[0].translation.title,/anuncia/);assert.ok(!edition.audio.clips[0].text.includes('announce'));
    assert.equal((await post('/api/edition',{scope:'personal',hours:24,length:'short',preferences:{musica:3},profile:{includeAnniversaries:false,blockedTerms:['conciertos']},audio:false})).status,422);
    assert.equal((await post('/api/translate',{id:'unknown',title:'arbitrary client text'})).status,404);
    assert.equal((await post('/api/translate',{id:a.id},'https://other.test')).status,403);
    assert.equal((await post('/api/translate',{id:99})).status,400);
    assert.equal((await api(new Request('https://brujula.test/api/translate'))).status,405);
  }finally{globalThis.fetch=original;}
});
