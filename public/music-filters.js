// Recognition uses RSS text only, never an artist's guessed tour schedule.
const styles = [
  ['indie', 'Indie', 'indie|indie rock|indie pop', 'arctic monkeys|the strokes|the national|interpol|foals|franz ferdinand|fontaines d c|fontaines dc|wet leg|the libertines|belle and sebastian|the postal service|death cab for cutie|vampire weekend|fleet foxes|big thief|wilco|vetusta morla|love of lesbian|los planetas|carolina durante'],
  ['rock', 'Rock', 'rock|rock and roll|rock n roll|hard rock', 'the rolling stones|rolling stones|the beatles|led zeppelin|ac dc|foo fighters|queens of the stone age|bruce springsteen|neil young|david bowie|jack white'],
  ['alternativo', 'Rock alternativo', 'alternative rock|rock alternativo|alt rock|post punk|shoegaze', 'radiohead|r e m|rem|pixies|the smashing pumpkins|smashing pumpkins|sonic youth|the cure|placebo|muse|deftones|garbage|nine inch nails|queens of the stone age|foo fighters|red hot chili peppers|idles|fontaines d c|fontaines dc'],
  ['grunge', 'Grunge', 'grunge|post grunge', 'nirvana|pearl jam|soundgarden|alice in chains|stone temple pilots|temple of the dog|mudhoney|screaming trees|audioslave'],
  ['punk', 'Punk', 'punk|punk rock|pop punk|post punk|hardcore punk', 'green day|the clash|ramones|sex pistols|bad religion|the offspring|blink 182|sum 41|rancid|nofx|pennywise|idles|amyl and the sniffers|turnstile'],
  ['britpop', 'Britpop', 'britpop|brit pop', 'oasis|blur|pulp|suede|supergrass|elastica|the verve|ocean colour scene|cast'],
].map(([id, name, words, artists]) => ({ id, name, words: words.split('|'), artists: artists.split('|') }));

export const musicGenres = styles.map(({ id, name }) => ({ id, name }));
const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const includes = (text, term) => (' ' + text + ' ').includes(' ' + term + ' ');
const musicalContext = /\b(music|musica|musical|musico|musicos|cantante|cantantes|song|songs|cancion|canciones|album|albums|disco|discos|concierto|conciertos|concert|concerts|guitar|guitarra|indie rock|alternative rock|rock alternativo|punk rock|britpop|grupo musical|banda musical)\b/;
// Ambiguous names require music context: Oasis, Blur, Pulp, Cast, Muse, Nirvana...
const distinctiveArtists = styles.flatMap(s => s.artists).filter(a => a.split(' ').length > 1 && !['screaming trees', 'stone temple pilots', 'the national', 'big thief', 'green day', 'r e m'].includes(a));
const spanishPlaces = 'espana|spain|spanish dates|spanish tour|madrid|barcelona|bilbao|valencia|sevilla|malaga|zaragoza|granada|murcia|alicante|a coruna|la coruna|santiago de compostela|vigo|oviedo|gijon|santander|pamplona|san sebastian|donostia|vitoria|valladolid|salamanca|cordoba|cadiz|almeria|tarragona|girona|lleida|badajoz|caceres|logrono|toledo|albacete|huelva|jaen|mallorca|ibiza|menorca|tenerife|gran canaria|lanzarote|fuerteventura|benicassim'.split('|');
const spanishFestivals = 'primavera sound barcelona|mad cool|bilbao bbk live|azkena rock|festival internacional de benicassim|sonorama|o son do camino|resurrection fest|canela party|low festival|warm up festival'.split('|');
const liveEvent = /\b(concierto|conciertos|concert|concerts|gira|giras|tour|tours|gig|gigs|recital|recitales|festival|festivals|festivales|actuara|actuaran|tocara|tocaran|entradas|tickets|live show|live shows)\b/;
const europeanPlaces = 'europa|europe|european tour|european dates|uk|united kingdom|reino unido|britain|england|inglaterra|scotland|escocia|wales|gales|ireland|irlanda|france|francia|germany|alemania|italy|italia|portugal|netherlands|paises bajos|holland|belgium|belgica|switzerland|suiza|austria|denmark|dinamarca|sweden|suecia|norway|noruega|finland|finlandia|poland|polonia|czech republic|chequia|greece|grecia|hungary|hungria|croatia|croacia|romania|rumania|iceland|islandia|serbia|slovakia|eslovaquia|slovenia|eslovenia|bulgaria|estonia|latvia|letonia|lithuania|lituania|luxembourg|luxemburgo|malta|cyprus|chipre|albania|montenegro|bosnia|ukraine|ucrania|london|londres|manchester|liverpool|glasgow|edinburgh|edimburgo|dublin|belfast|paris|berlin|hamburg|hamburgo|munich|amsterdam|rotterdam|brussels|bruselas|rome|roma|milan|milano|lisbon|lisboa|porto|oporto|copenhagen|copenhague|stockholm|estocolmo|oslo|helsinki|warsaw|varsovia|prague|praga|vienna|viena|athens|atenas|budapest|zurich'.split('|');
const otherPlaces = 'australia|australian tour|australian dates|new zealand|nueva zelanda|sydney|sidney|melbourne|brisbane|perth|adelaide|auckland|wellington|north america|norteamerica|south america|sudamerica|latin america|latinoamerica|united states|estados unidos|usa|u s|us tour|us dates|american tour|canada|toronto|vancouver|new york|nueva york|los angeles|chicago|mexico|argentina|brazil|brasil|chile|colombia|buenos aires|sao paulo|rio de janeiro|bogota|lima|santiago de chile|japan|japon|tokyo|tokio|asia|singapore|singapur|south korea|corea del sur|seoul|seul|south africa|sudafrica'.split('|');
const europeanFestivals = 'glastonbury|reading festival|leeds festival|rock en seine|rock am ring|rock im park|download festival uk|primavera sound porto|roskilde|pukkelpop|rock werchter|sziget'.split('|');
const generalRelease = /\b(album|albums|disco|discos|single|singles|song|songs|cancion|canciones|entrevista|interview)\b/;

function eventLocations(text) {
  // Discard origin phrases: a London band visiting Australia is not a UK date.
  text = text.replace(/\b\w+(?: \w+)? (?:band|rockers|banda|grupo)\b/g, ' ');
  const spain = spanishPlaces.some(p => includes(text, p)) || spanishFestivals.some(p => includes(text, p));
  const europe = spain || europeanPlaces.some(p => includes(text, p)) || europeanFestivals.some(p => includes(text, p));
  return [...(spain ? ['spain'] : []), ...(europe ? ['europe'] : []), ...(otherPlaces.some(p => includes(text, p)) ? ['other'] : [])];
}

/** Geographic preference affects live-event news only, including general editions. */
export function musicEventAllowed(article, region = 'europe') {
  if (region === 'world' || article.kind === 'anniversary') return true;
  const metadata = typeof article.musicLiveEvent === 'boolean' ? article : classifyMusic(article, '', article.category === 'musica' || article.categories?.includes('musica'));
  const places = metadata.musicEventLocations || [];
  // Unknown destinations stay visible in the default preference: an RSS with
  // no location is not evidence of a foreign tour. Spain-only is stricter.
  return !metadata.musicLiveEvent || places.includes(region) || (region === 'europe' && places.length === 0);
}

export function classifyMusic(article, metadata = '', trustedMusicFeed = false) {
  const text = normalize(article.title + ' ' + (article.excerpt || '') + ' ' + metadata);
  const isMusic = trustedMusicFeed || musicalContext.test(text) || distinctiveArtists.some(a => includes(text, a));
  if (!isMusic) return { musicGenres: [], musicSpainEvent: false, musicLiveEvent: false, musicEventLocations: [] };
  const found = new Set(styles.filter(s => [...s.words, ...s.artists].some(w => includes(text, w))).map(s => s.id));
  if (found.has('grunge') || found.has('britpop')) found.add('alternativo');
  if (found.has('alternativo') || found.has('grunge') || found.has('britpop') || found.has('punk') || includes(text, 'indie rock')) found.add('rock');
  const musicSpainEvent = spanishFestivals.some(f => includes(text, f)) ||
    (liveEvent.test(text) && spanishPlaces.some(p => includes(text, p)));
  const headline = normalize(article.title);
  const musicLiveEvent = (eventLocations(headline).length > 0 && /\b(play|plays|playing|perform|performs|performing|shows)\b/.test(headline) && !generalRelease.test(headline)) || liveEvent.test(headline) || [...spanishFestivals, ...europeanFestivals].some(f => includes(headline, f)) || (!generalRelease.test(headline) && liveEvent.test(text));
  // The destination named in the headline takes precedence over background
  // references in the excerpt. A mixed European/Australian tour remains relevant.
  const headlineLocations = eventLocations(headline);
  const musicEventLocations = musicLiveEvent ? (headlineLocations.length ? headlineLocations : eventLocations(text)) : [];
  return { musicGenres: [...found], musicSpainEvent, musicLiveEvent, musicEventLocations };
}
