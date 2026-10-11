import { classifyMusic, musicGenres } from './music-filters.js';
export { musicGenres };
const topic = (id, name, words) => ({ id, name, words: words.split('|') });
export const categories = [
  { id: 'espana', name: 'España y tu zona', icon: '◈', topics: [
    topic('autonomias', 'Comunidades autónomas', 'autonomi*|comunidad autonoma|generalitat|junta de|gobierno regional'),
    topic('local', 'Tu ciudad y transporte', 'ayuntamiento|municipal*|metro|cercanias|transporte publico|trafico'),
    topic('infraestructuras', 'Infraestructuras', 'infraestructura*|ferrocarril|carretera*|aeropuerto*|ave|renfe'),
    topic('rural', 'España rural', 'rural|despoblacion|pueblo*|agricultor*|ganader*'),
    topic('turismo', 'Turismo y viajes', 'turismo|turista*|viaje*|hotel*|vacaciones'),
    topic('tiempo', 'El tiempo y alertas', 'aemet|dana|alerta meteorologica|borrasca*|lluvia*|inundacion*'),
  ] },
  { id: 'politica', name: 'Política', icon: '⚑', topics: [
    topic('gobierno', 'Gobierno y Congreso', 'gobierno|congreso|ministro*|sanchez|consejo de ministros'),
    topic('elecciones', 'Elecciones y partidos', 'eleccion*|electoral*|psoe|feijoo|sumar|vox|podemos|partido popular'),
    topic('leyes', 'Leyes y derechos', 'ley|leyes|legislacion|reforma legal|constitucion*|derechos'),
    topic('corrupcion', 'Corrupción y transparencia', 'corrupcion|soborno*|malversacion|transparencia|financiacion ilegal'),
    topic('ue', 'España en la UE', 'bruselas|europarlamento|comision europea|consejo europeo'),
    topic('territorial', 'Política autonómica', 'politica autonomica|presidente autonomico|parlamento catalan|estatuto|independentismo'),
  ] },
  { id: 'economia', name: 'Economía', icon: '↗', topics: [
    topic('vivienda', 'Vivienda y alquiler', 'vivienda*|alquiler*|hipoteca*|inmobiliari*'),
    topic('bolsillo', 'Precios y tu bolsillo', 'inflacion|precio*|ipc|cesta de la compra|coste de vida'),
    topic('trabajo', 'Empleo y salarios', 'empleo|salario*|paro|laboral|sueldo*|sindic*'),
    topic('empresas', 'Empresas y negocios', 'empresa*|negocio*|startup*|autonomo*|emprendedor*'),
    topic('mercados', 'Bolsa e inversión', 'bolsa|ibex|inversion|accionista*|mercados financieros|cotizacion'),
    topic('impuestos', 'Impuestos y pensiones', 'impuesto*|hacienda|irpf|pension*|jubilacion|seguridad social'),
    topic('energia', 'Energía y facturas', 'factura*|electricidad|gas|petroleo|tarifa*|energia'),
    topic('banca', 'Banca y ahorro', 'banco*|banca|ahorro*|deposito*|bce|tipos de interes'),
  ] },
  { id: 'tecnologia', name: 'Tecnología', icon: '⌘', topics: [
    topic('ia', 'Inteligencia artificial', 'inteligencia artificial|openai|chatgpt|anthropic|claude|modelo de lenguaje|llm|ia'),
    topic('gadgets', 'Móviles y gadgets', 'movil*|smartphone*|iphone|android|gadget*|portatil*|tablet*'),
    topic('apps', 'Redes y aplicaciones', 'aplicacion*|apps|instagram|tiktok|whatsapp|redes sociales|software'),
    topic('ciberseguridad', 'Estafas y ciberseguridad', 'ciber*|phishing|ransomware|estafa*|hack*'),
    topic('privacidad', 'Privacidad y datos', 'privacidad|datos personales|proteccion de datos|cookies|rgpd'),
    topic('conectividad', 'Conectividad e infraestructura', '5g|6g|fibra optica|conectividad|centro de datos|semiconductor*|chip*'),
    topic('hogar', 'Hogar inteligente', 'domotica|hogar inteligente|iot|robot aspirador|alexa'),
    topic('movilidad', 'Movilidad e innovación', 'coche electrico|vehiculo electrico|tesla|conduccion autonoma|bateria*'),
    topic('guias', 'Trucos y guías', 'tutorial|trucos|guia practica|como configurar|como instalar'),
    topic('videojuegos', 'Videojuegos', 'videojuego*|playstation|xbox|nintendo|steam|gaming'),
  ] },
  { id: 'internacional', name: 'Internacional', icon: '◎', topics: [
    topic('conflictos', 'Conflictos y guerras', 'guerra|ucrania|gaza|israel|misil*|bombardeo*|huti*'),
    topic('diplomacia', 'Diplomacia y organismos', 'diplomacia|onu|otan|cumbre|embajador*|tratado*'),
    topic('elecciones-mundo', 'Elecciones en el mundo', 'elecciones presidenciales|elecciones legislativas|elecciones en|trump|casa blanca'),
    topic('economia-global', 'Economía global', 'economia global|arancel*|comercio internacional|economia mundial'),
    topic('humanitaria', 'Migración y crisis humanitarias', 'refugiado*|humanitaria|migracion|hambruna'),
    topic('geopolitica', 'Geopolítica y potencias', 'geopolitica|china|rusia|estados unidos|iran|putin'),
    topic('europa', 'Europa', 'union europea|francia|alemania|italia|reino unido|portugal'),
    topic('latinoamerica', 'América Latina', 'argentina|mexico|colombia|venezuela|brasil|chile|peru|cuba'),
  ] },
  { id: 'deportes', name: 'Deportes', icon: '◉', topics: [
    topic('futbol', 'Fútbol de clubes', 'futbol|laliga|champions|real madrid|barcelona fc|barca|atletico|gol*'),
    topic('selecciones', 'Selecciones y grandes eventos', 'seleccion espanola|mundial de futbol|eurocopa|juegos olimpicos|seleccion de futbol'),
    topic('baloncesto', 'Baloncesto', 'baloncesto|nba|acb|euroliga|basket'),
    topic('formula1', 'Fórmula 1 y motor', 'formula 1|f1|fernando alonso|carlos sainz|motogp|automovilismo'),
    topic('tenis', 'Tenis', 'tenis|alcaraz|nadal|atp|wta|grand slam'),
    topic('ciclismo', 'Ciclismo', 'ciclismo|tour de francia|vuelta a espana|ciclista*'),
    topic('otras-disciplinas', 'Otras disciplinas', 'rugby|atletismo|natacion|balonmano|boxeo|ufc|nfl|golf'),
    topic('sanciones', 'Sanciones y dopaje', 'dopaje|antidopaje|sancion deportiva|tribunal deportivo'),
  ] },
  { id: 'ciencia', name: 'Ciencia', icon: '✳', topics: [
    topic('espacio', 'Espacio y astronomía', 'nasa|astronomia|astronauta*|satelite*|marte|luna|telescopio'),
    topic('investigacion', 'Ciencia e investigación', 'investigacion cientifica|cientifico*|laboratorio|csic|descubrimiento'),
    topic('naturaleza', 'Naturaleza y biología', 'biologia|especie*|biodiversidad|evolucion|genetica|adn'),
    topic('fisica', 'Física y nuevas energías', 'fisica|cuantica|fusion nuclear|particula*|cern'),
    topic('arqueologia', 'Arqueología e historia', 'arqueologia|arqueologico*|fosil*|prehistoria|yacimiento'),
  ] },
  { id: 'cultura', name: 'Cultura', icon: '▤', topics: [
    topic('cine', 'Cine y series', 'cine|pelicula*|serie*|netflix|hbo|rodaje|oscar*'),
    topic('famosos', 'Famosos y espectáculo', 'famoso*|celebridad*|espectaculo|famosas|gala'),
    topic('redes', 'Creadores y redes', 'influencer*|youtuber*|streamer*|creador de contenido'),
    topic('gastronomia', 'Gastronomía', 'gastronomia|restaurante*|chef|receta*|cocina|michelin'),
    topic('libros', 'Libros y literatura', 'libro*|literatura|novela|escritor*|poesia|editorial|premio planeta'),
    topic('arte', 'Arte y museos', 'arte|museo*|exposicion*|pintura|prado|reina sofia'),
    topic('teatro', 'Teatro y escenario', 'teatro|danza|ballet|musical|dramaturg*'),
    topic('television', 'Televisión y streaming', 'television|telecinco|antena 3|streaming|programa de tv'),
  ] },
  { id: 'musica', name: 'Música', icon: '◖', topics: [
    topic('conciertos', 'Conciertos y giras', 'concierto*|gira musical|gira de|recital*'),
    topic('lanzamientos', 'Lanzamientos', 'album|disco|single|nuevo tema|cancion*'),
    topic('festivales', 'Festivales', 'festival de musica|primavera sound|mad cool|sonar|benicassim'),
    topic('espanola', 'Artistas españoles', 'rosalia|aitana|c tangana|alejandro sanz|vetusta morla|estopa|lola indigo'),
    topic('internacional', 'Música internacional', 'taylor swift|bad bunny|beyonce|coldplay|lady gaga|billie eilish'),
    topic('clasica', 'Clásica y ópera', 'opera|orquesta|sinfonia|musica clasica'),
    topic('urbana', 'Urbana y electrónica', 'regueton|trap|hip hop|rap|musica electronica|dj'),
  ] },
  { id: 'salud', name: 'Salud', icon: '✚', topics: [
    topic('sanidad', 'Sanidad pública', 'sanidad|hospital*|lista de espera|atencion primaria|centro de salud'),
    topic('medicina', 'Medicina y tratamientos', 'medicina|medico*|cancer|vacuna*|tratamiento*|enfermedad*'),
    topic('mental', 'Salud mental', 'salud mental|depresion|ansiedad|psicolog*|psiquiatr*'),
    topic('bienestar', 'Alimentación y bienestar', 'nutricion|alimentacion|bienestar|dieta|ejercicio fisico|sueno'),
    topic('investigacion-medica', 'Investigación médica', 'ensayo clinico|investigacion medica|farmaco*|medicamento*'),
  ] },
  { id: 'medioambiente', name: 'Medioambiente', icon: '❋', topics: [
    topic('clima', 'Cambio climático', 'cambio climatico|calentamiento global|emisiones|clima'),
    topic('renovables', 'Energías renovables', 'renovable*|energia solar|eolica|fotovoltaic*|hidrogeno verde'),
    topic('agua', 'Agua y sequía', 'sequia|agua|embalse*|desaladora'),
    topic('animales', 'Animales y conservación', 'conservacion|especies protegidas|fauna|animal*|lince|biodiversidad'),
    topic('incendios', 'Incendios y emergencias', 'incendio forestal|incendio*|inundacion*|desastre natural'),
    topic('sostenibilidad', 'Consumo sostenible', 'sostenibilidad|reciclaje|economia circular|plastico*|residuo*'),
  ] },
  { id: 'sociedad', name: 'Sociedad', icon: '◌', topics: [
    topic('seguridad', 'Seguridad y delitos', 'policia|delito*|detenido*|robo|crimen|asesinat*'),
    topic('justicia', 'Justicia y juicios', 'justicia|juicio|juez|jueces|tribunal|sentencia|fiscalia'),
    topic('igualdad', 'Derechos e igualdad', 'igualdad|feminismo|violencia machista|lgtbi|discriminacion|derechos sociales'),
    topic('emergencias', 'Accidentes y emergencias', 'accidente*|emergencia*|rescate|bombero*'),
    topic('comunidad', 'Comunidad y religión', 'comunidad|religion|iglesia|papa|voluntariado|solidaridad'),
    topic('mascotas', 'Mascotas y animales', 'mascota*|perro*|gato*|veterinari*|bienestar animal'),
    topic('migracion', 'Migración e integración', 'inmigracion|migrante*|integracion|asilo'),
  ] },
  { id: 'educacion', name: 'Educación', icon: '▱', topics: [
    topic('escuela', 'Escuela y enseñanza', 'escuela*|colegio*|ensenanza|profesor*|alumno*|educacion'),
    topic('universidad', 'Universidad y becas', 'universidad|universitari*|beca*|selectividad|ebau|evau'),
    topic('fp', 'Formación profesional', 'formacion profesional|fp|aprendizaje|formacion dual'),
    topic('crianza', 'Crianza y familias', 'crianza|familia*|conciliacion|infancia|padres'),
    topic('politica-educativa', 'Política educativa', 'ley educativa|ministerio de educacion|reforma educativa|pisa'),
  ] },
];

export const regions = [
  ['andalucia', 'Andalucía', 'andalucia|andaluz*|sevilla|malaga|granada|cordoba|cadiz|huelva|jaen|almeria'],
  ['aragon', 'Aragón', 'aragon|aragones*|zaragoza|huesca|teruel'],
  ['asturias', 'Asturias', 'asturias|asturian*|oviedo|gijon'],
  ['baleares', 'Illes Balears', 'baleares|balears|mallorca|menorca|ibiza|palma'],
  ['canarias', 'Canarias', 'canarias|canario*|tenerife|gran canaria|lanzarote|fuerteventura'],
  ['cantabria', 'Cantabria', 'cantabria|cantabr*|santander'],
  ['castilla-mancha', 'Castilla-La Mancha', 'castilla la mancha|mancheg*|toledo|albacete|ciudad real|cuenca|guadalajara'],
  ['castilla-leon', 'Castilla y León', 'castilla y leon|valladolid|salamanca|burgos|leon|zamora|palencia|segovia|soria|avila'],
  ['cataluna', 'Cataluña', 'cataluna|catalunya|catalan*|barcelona|girona|gerona|lleida|lerida|tarragona'],
  ['valencia', 'Comunitat Valenciana', 'comunitat valenciana|comunidad valenciana|valencia|valencian*|alicante|castellon'],
  ['extremadura', 'Extremadura', 'extremadura|extremen*|badajoz|caceres'],
  ['galicia', 'Galicia', 'galicia|galleg*|coruna|lugo|ourense|orense|pontevedra|vigo'],
  ['madrid', 'Comunidad de Madrid', 'madrid|madrilen*|alcala de henares'],
  ['murcia', 'Región de Murcia', 'murcia|murcian*|cartagena'],
  ['navarra', 'Navarra', 'navarra|navarr*|pamplona|iruna'],
  ['pais-vasco', 'País Vasco', 'pais vasco|euskadi|vasc*|bilbao|vitoria|gasteiz|donostia|san sebastian'],
  ['rioja', 'La Rioja', 'la rioja|riojan*|logrono'],
  ['ceuta', 'Ceuta', 'ceuta|ceuti*'], ['melilla', 'Melilla', 'melilla|melill*'],
].map(([id, name, words]) => ({ id, name, words: words.split('|') }));

export const normalizeText = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRE = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termCache = new Map();
export function hasTerm(text, term) {
  if (!termCache.has(term)) {
    const stem = term.endsWith('*');
    termCache.set(term, new RegExp('(?:^| )' + escapeRE(normalizeText(stem ? term.slice(0, -1) : term)) + (stem ? '[a-z]*' : '') + '(?: |$)'));
  }
  return termCache.get(term).test(text);
}
export const matchesWords = (text, words) => words.some(w => hasTerm(text, w));

export function annotateArticle(article, metadata = '', fallback = 'espana') {
  const headline = normalizeText(article.title), body = normalizeText(article.excerpt), tags = normalizeText(metadata);
  const topicIds = [], weights = new Map();
  for (const c of categories) {
    let score = 0;
    for (const t of c.topics) {
      const inTitle = matchesWords(headline, t.words), inTags = matchesWords(tags, t.words), inBody = matchesWords(body, t.words);
      if (inTitle || inTags || inBody) { topicIds.push(c.id + ':' + t.id); score += inTitle ? 5 : inTags ? 3 : 1; }
    }
    if (score) weights.set(c.id, score);
  }
  if (fallback !== 'espana') weights.set(fallback, (weights.get(fallback) || 0) + 3);
  const music = classifyMusic(article, metadata, fallback === 'musica');
  if (music.musicGenres.length && !weights.has('musica')) weights.set('musica', 3);
  const ranked = [...weights].sort((a, b) => b[1] - a[1]);
  const regionIds = regions.filter(r => matchesWords(headline + ' ' + body, r.words)).map(r => r.id);
  return { ...article, category: ranked[0]?.[0] || fallback, categories: ranked.filter(([, n]) => n >= 3).map(([id]) => id), topics: topicIds, regions: regionIds, ...music };
}
export function normalizePreferences(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return Object.fromEntries(categories.map(c => [c.id, Number.isInteger(input[c.id]) && input[c.id] >= 0 && input[c.id] <= 3 ? input[c.id] : 0]));
}
export function normalizeProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const topicInput = input.topics && typeof input.topics === 'object' ? input.topics : {};
  return {
    topics: Object.fromEntries(categories.map(c => [c.id, Array.isArray(topicInput[c.id]) ? [...new Set(topicInput[c.id].filter(id => c.topics.some(t => t.id === id)))].slice(0, 5) : []])),
    region: regions.some(r => r.id === input.region) ? input.region : '',
    city: typeof input.city === 'string' ? input.city.trim().slice(0, 60) : '',
    keywords: Array.isArray(input.keywords) ? [...new Set(input.keywords.filter(x => typeof x === 'string' && normalizeText(x).length >= 3).map(x => x.trim().slice(0, 50)))].slice(0, 10) : [],
    excludedSources: Array.isArray(input.excludedSources) ? [...new Set(input.excludedSources.filter(id => typeof id === 'string'))].slice(0, 30) : [],
    hours: [6, 12, 24, 48].includes(input.hours) ? input.hours : 24,
    topicMode: input.topicMode === 'strict' ? 'strict' : 'priority',
    musicGenres: Array.isArray(input.musicGenres) ? [...new Set(input.musicGenres.filter(id => musicGenres.some(g => g.id === id)))] : [],
    musicSpainOnly: input.musicSpainOnly === true,
  };
}

export function personalize(articles, preferences, limit = 30, profileInput = {}, options = {}) {
  const p = normalizePreferences(preferences), profile = normalizeProfile(profileInput), now = options.now ?? Date.now();
  const city = normalizeText(profile.city);
  const candidates = [];
  for (const a of articles) {
    const hours = (now - +new Date(a.publishedAt)) / 3600000;
    if (!Number.isFinite(hours) || hours < -5 / 60 || hours > profile.hours || profile.excludedSources.includes(a.source)) continue;
    const cats = [...new Set([a.category, ...(a.categories || [])])].filter(id => p[id] > 0);
    if (!cats.length) continue;
    const isMusic = a.category === 'musica' || a.categories?.includes('musica') || a.musicGenres?.length;
    if (isMusic && profile.musicGenres.length && !profile.musicGenres.some(id => a.musicGenres?.includes(id))) continue;
    if (isMusic && profile.musicSpainOnly && a.musicSpainEvent !== true) continue;
    const topicMatches = cats.flatMap(id => profile.topics[id].filter(t => a.topics?.includes(id + ':' + t)).map(t => categories.find(c => c.id === id).topics.find(x => x.id === t).name));
    if (profile.topicMode === 'strict' && cats.every(id => profile.topics[id].length > 0) && !topicMatches.length) continue;
    const text = normalizeText(a.title + ' ' + a.excerpt);
    const keywordMatches = profile.keywords.filter(k => hasTerm(text, k));
    const local = !!((profile.region && a.regions?.includes(profile.region)) || (city.length >= 3 && hasTerm(text, city)));
    const interest = Math.max(...cats.map(id => p[id]));
    const score = interest * 5 + Math.min(topicMatches.length, 2) * 12 + Math.min(keywordMatches.length, 2) * 10 + (local ? 12 : 0) + 30 * Math.exp(-Math.max(0, hours) / 5);
    const genreMatches = isMusic ? musicGenres.filter(g => profile.musicGenres.includes(g.id) && a.musicGenres?.includes(g.id)).map(g => g.name) : [];
    const reasons = [...(isMusic && profile.musicSpainOnly ? ['Conciertos en España'] : []), ...genreMatches.slice(0, 2), ...topicMatches.slice(0, 2), ...keywordMatches.slice(0, 1), ...(local ? ['Tu zona'] : [])];
    candidates.push({ ...a, matchReasons: reasons.length ? reasons : [categories.find(c => c.id === cats[0]).name], affinityScore: score, freshnessTier: hours <= 12 ? 0 : hours <= 24 ? 1 : 2 });
  }
  candidates.sort((a, b) => options.sort === 'recent' ? +new Date(b.publishedAt) - +new Date(a.publishedAt) : a.freshnessTier - b.freshnessTier || b.affinityScore - a.affinityScore || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  if (options.sort === 'recent' || options.diverse === false) return candidates.slice(0, limit);
  // Penalise consecutive concentration; never pull an older freshness tier forward.
  const output = [], sourceCounts = new Map(), categoryCounts = new Map();
  while (candidates.length && output.length < limit) {
    const tier = candidates[0].freshnessTier;
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i]; if (a.freshnessTier !== tier) break;
      if (options.maxPerSource && (sourceCounts.get(a.source) || 0) >= options.maxPerSource) continue;
      const adjusted = a.affinityScore - (sourceCounts.get(a.source) || 0) * 6 - (categoryCounts.get(a.category) || 0) * 3;
      if (adjusted > bestScore) { best = i; bestScore = adjusted; }
    }
    if (bestScore === -Infinity) { candidates.splice(0, candidates.findIndex(a => a.freshnessTier !== tier) < 0 ? candidates.length : candidates.findIndex(a => a.freshnessTier !== tier)); continue; }
    const [a] = candidates.splice(best, 1); output.push(a);
    sourceCounts.set(a.source, (sourceCounts.get(a.source) || 0) + 1);
    categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1);
  }
  return output;
}
