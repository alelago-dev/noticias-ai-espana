import test from 'node:test';
import assert from 'node:assert/strict';
import { findEvidence } from '../server/news.js';
import { synthesize } from '../server/ai.js';
import { api } from '../server/handler.js';

const articles = [
  {id:'ia',title:'Una película utiliza IA',excerpt:'La productora explica su uso.',sourceName:'Xataka'},
  {id:'brand',title:'OpenAI presenta ChatGPT',excerpt:'Anuncia nuevas funciones.',sourceName:'20minutos'},
  {id:'english',title:'Artificial intelligence in Japan',excerpt:'A new model is announced.',sourceName:'Medio'},
  {id:'irrelevant',title:'Galicia cambia su política inmobiliaria',excerpt:'Japón analiza precios de vivienda.',topics:['tecnologia:ia']},
];
const env={GEMINI_API_KEY:'test-key',GEMINI_ENDPOINT:'https://gemini.test'};
const modelResponse=paragraphs=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({paragraphs})}]}}]}));

test('AI queries find acronyms, the full phrase and explicit model names without substring or metadata matches',()=>{
  for(const question of ['¿Qué noticias hay sobre inteligencia artificial?','¿Qué hay sobre IA?','¿Qué novedades hay sobre AI?','Artificial intelligence']) {
    assert.deepEqual(findEvidence(question,articles).map(a=>a.id),['ia','brand','english'],question);
  }
  assert.deepEqual(findEvidence('Noticias sobre ChatGPT',articles).map(a=>a.id),['brand']);
  assert.equal(findEvidence('¿Qué noticias hay?',articles).length,0);
});

test('AI topic matching preserves other constraints and does not return unrelated substring matches',()=>{
  assert.deepEqual(findEvidence('AI in Japan',articles).map(a=>a.id),['english']);
  assert.equal(findEvidence('IA en Madrid',articles).length,0);
  assert.equal(findEvidence('Noticias de arte',[{title:'Es parte del debate',excerpt:''}]).length,0);
});

test('The named Argentine Atlanta club never resolves to Atlético Madrid, US teams or the US city',()=>{
  const candidates = [
    {id:'madrid',title:'El Atlético de Madrid Femenino entra en una categoría global',excerpt:'El club deja huella en el deporte.'},
    {id:'city',title:'Atlanta ofrece nuevos vuelos a Buenos Aires',excerpt:'Turismo entre Estados Unidos y Argentina.'},
    {id:'united',title:'Atlanta United ficha un jugador de Argentina',excerpt:'Procede de Buenos Aires.'},
    {id:'club',title:'El Club Atlético Atlanta presenta su plantilla',excerpt:'El equipo empieza a entrenar.'},
    {id:'bohemio',title:'Atlanta ganó su partido',excerpt:'El Bohemio suma puntos en la Primera Nacional.'},
  ];
  assert.deepEqual(findEvidence('Club atlético Atlanta de buenos aires',candidates).map(a=>a.id),['club','bohemio']);
  assert.equal(findEvidence('Club atlético Atlanta de buenos aires',candidates.slice(0,3)).length,0);
  assert.equal(findEvidence('Noticias del club Atlanta de Buenos Aires sobre fichajes',candidates.slice(3)).length,0,'extra constraints are retained');
});

test('Club names and international topics are matched without an implicit Spain restriction',()=>{
  const candidates = [
    {id:'river',title:'River Plate gana su partido en Argentina',excerpt:'El club celebra el resultado.',coverage:'mundo'},
    {id:'other',title:'Otro club atlético ganó su partido',excerpt:'Se juega en Buenos Aires.',coverage:'mundo'},
    {id:'travel',title:'Barcelona inaugura una ruta turística',excerpt:'Un recorrido por museos.',coverage:'espana'},
    {id:'barca',title:'Barcelona anuncia un fichaje',excerpt:'El equipo prepara su temporada.',coverage:'espana'},
  ];
  assert.deepEqual(findEvidence('Club River Plate',candidates).map(a=>a.id),['river']);
  assert.deepEqual(findEvidence('Club Barcelona',candidates).map(a=>a.id),['barca']);
  assert.deepEqual(findEvidence('Noticias sobre Argentina',candidates).map(a=>a.id),['river']);
  assert.equal(findEvidence('Club Atlético Atlanta de Buenos Aires',candidates).length,0);
});

test('The existing Gemini configuration answers questions using only supplied RSS and valid citations',async()=>{
  let requests=0;
  const result=await synthesize(articles.slice(0,2),env,'¿Qué noticias hay sobre inteligencia artificial?',async(url,init)=>{
    requests++;
    assert.match(String(url),/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(init.headers['x-goog-api-key'],'test-key');
    const body=JSON.parse(init.body);
    assert.match(body.systemInstruction.parts[0].text,/EXCLUSIVAMENTE/);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).articles.map(a=>a.id),['ia','brand']);
    return modelResponse([{text:'Una película utiliza IA, según Xataka.',sourceIds:['ia']}]);
  });
  assert.equal(requests,1);assert.equal(result.mode,'ai');assert.deepEqual(result.paragraphs[0].sourceIds,['ia']);
  const noQuestion=await synthesize(articles,env,undefined,async()=>{throw Error('Should not change ordinary edition behavior');});
  assert.equal(noQuestion.mode,'extractive');
});

test('Gemini question answers retry 404 models, abstain, and retain sources on provider or citation failures',async()=>{
  const tried=[];
  const result=await synthesize(articles,env,'Noticias de IA',async url=>{
    tried.push(String(url));
    return tried.length===1 ? new Response('{}',{status:404}) : modelResponse([{text:'OpenAI presenta ChatGPT.',sourceIds:['brand']}]);
  });
  assert.equal(result.mode,'ai');assert.equal(tried.length,2);assert.match(tried[1],/gemini-3\.8-flash/);
  const empty=await synthesize(articles,env,'Pregunta sin respuesta',async()=>modelResponse([]));
  assert.equal(empty.mode,'ai');assert.deepEqual(empty.paragraphs,[]);
  for(const fetcher of [async()=>new Response('{}',{status:500}),async()=>new Response('invalid json'),async()=>modelResponse([{text:'Inventado',sourceIds:['unknown']}])]) {
    const fallback=await synthesize(articles,env,'Noticias de IA',fetcher);
    assert.equal(fallback.mode,'extractive');assert.equal(fallback.paragraphs.length,articles.length);
    assert.equal(fallback.paragraphs[0].text,articles[0].title+'. '+articles[0].excerpt);
  }
});

test('The screenshot question works through the API with Gemini, stays within 24h and fails back honestly',async()=>{
  const original=globalThis.fetch;let fail=false,modelCalls=0;
  const date=hours=>new Date(Date.now()-hours*3600000).toUTCString();
  globalThis.fetch=async(url,init={})=>{
    const href=String(url);
    if(href.includes('gemini.test')) {
      modelCalls++;if(fail)return new Response('{}',{status:503});
      const prompt=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
      assert.equal(prompt.articles.length,1);
      assert.equal(prompt.articles[0].title,'Una película utiliza IA');
      return modelResponse([{text:'Una película utiliza IA, según Xataka.',sourceIds:[prompt.articles[0].id]}]);
    }
    const feed=href.includes('xataka.com') ? `<item><title>Una película utiliza IA</title><description>La productora explica su uso.</description><link>https://www.xataka.com/cine/reciente</link><pubDate>${date(1)}</pubDate></item><item><title>OpenAI publica un modelo</title><link>https://www.xataka.com/ia/antigua</link><pubDate>${date(30)}</pubDate></item>` : href.includes('20minutos.es') ? `<item><title>El Atlético de Madrid Femenino deja huella</title><description>Un club que gana títulos.</description><link>https://www.20minutos.es/deportes/club</link><pubDate>${date(1)}</pubDate></item>` : '';
    return new Response('<rss><channel>'+feed+'</channel></rss>');
  };
  const ask=(question,config=env)=>api(new Request('https://brujula.test/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})}),config);
  try {
    const response=await ask('¿Qué noticias hay sobre inteligencia artificial?');
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.mode,'ai');assert.equal(result.articles.length,1);assert.equal(result.message,null);
    assert.equal(result.paragraphs[0].sourceIds[0],result.articles[0].id);
    assert.equal((await(await ask('Elecciones en Japón')).json()).mode,'insufficient');assert.equal(modelCalls,1);
    const atlanta=await(await ask('Club atlético Atlanta de Buenos Aires')).json();
    assert.equal(atlanta.mode,'insufficient');assert.deepEqual(atlanta.articles,[]);assert.match(atlanta.message,/cualquier país/);assert.equal(modelCalls,1);
    fail=true;
    const fallback=await(await ask('Noticias sobre IA')).json();
    assert.equal(fallback.mode,'extractive');assert.match(fallback.message,/No se pudo redactar/);assert.ok(!fallback.message.includes('activar'));
    const unconfigured=await(await ask('Noticias sobre IA',{})).json();
    assert.equal(unconfigured.mode,'extractive');assert.match(unconfigured.message,/requiere activar/);
  }finally{globalThis.fetch=original;}
});
