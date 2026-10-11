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

export function classifyMusic(article, metadata = '', trustedMusicFeed = false) {
  const text = normalize(article.title + ' ' + (article.excerpt || '') + ' ' + metadata);
  const isMusic = trustedMusicFeed || musicalContext.test(text) || distinctiveArtists.some(a => includes(text, a));
  if (!isMusic) return { musicGenres: [], musicSpainEvent: false };
  const found = new Set(styles.filter(s => [...s.words, ...s.artists].some(w => includes(text, w))).map(s => s.id));
  if (found.has('grunge') || found.has('britpop')) found.add('alternativo');
  if (found.has('alternativo') || found.has('grunge') || found.has('britpop') || found.has('punk') || includes(text, 'indie rock')) found.add('rock');
  const musicSpainEvent = spanishFestivals.some(f => includes(text, f)) ||
    (liveEvent.test(text) && spanishPlaces.some(p => includes(text, p)));
  return { musicGenres: [...found], musicSpainEvent };
}
