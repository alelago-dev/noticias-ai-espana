# Brújula

Una app web instalable para móvil: abrir al salir y escuchar las noticias principales de las últimas horas de España o del mundo, con enlaces al periodismo original y una edición opcional según tus intereses.

## Qué puedes hacer

- Escuchar desde el inicio con un toque: la selección extractiva se prepara al cargar las noticias, sin iniciar audio automáticamente.
- Elegir España, Mundo o Mis temas y las últimas 6, 12 o 24 horas (12 por defecto en el informativo). No se rellena una ventana vacía con noticias antiguas.

- Elegir entre 13 categorías, asignar cuatro niveles de interés y seleccionar hasta cinco subtemas por categoría (89 subtemas disponibles).
- Consultar noticias de 21 medios mediante 30 RSS generales, temáticos y locales. Incluye EL PAÍS, ABC, elDiario.es, Europa Press, Xataka, EL MUNDO, 20minutos, La Vanguardia, El Periódico, El Confidencial, EL ESPAÑOL e Infobae España; también los canales de Barcelona de La Vanguardia, 20minutos y El Periódico, y el de Catalunya de elDiario.es. La disponibilidad depende de que cada medio permita leer su RSS desde el hosting.
- Música: Billboard, Rolling Stone, Pitchfork, NME, Stereogum, Consequence, The Guardian Música, Jenesaispop y Mondo Sonoro. Las secciones musicales aportan su categoría y reconocen subtemas en español e inglés. Los siete canales internacionales se asignan a Mundo salvo referencias locales de España; los titulares y extractos conservan el idioma del medio y el guion con IA se redacta en español. «Mis temas» incluye ambos ámbitos según tus preferencias y la ventana horaria.
- Filtros musicales independientes: indie, rock, rock alternativo, grunge, punk y britpop (sin el límite de cinco subtemas). «Elegir indie y rock» selecciona los seis estilos; no cambia la selección hasta guardar. Sin estilos elegidos, se admiten todos. «Solo conciertos y giras en España» combina el estilo con menciones de eventos en España; desactivarlo permite noticias generales de esas bandas. Se aplican al feed y «Mis temas», respetando ventanas y exclusiones, sin cambiar las puntuaciones ni las ediciones generales. Reconoce palabras de género y una lista ampliable de artistas en titulares, extractos y etiquetas RSS; puede omitir bandas desconocidas o clasificar mal noticias con varias menciones. No verifica fechas de conciertos ni ofrece una agenda completa o avisos automáticos. Los nombres de bandas en intereses propios siguen dando prioridad dentro de los filtros, sin saltárselos.
- Destino de conciertos y giras: España y Europa (incluido Reino Unido) por defecto, Solo España o Cualquier lugar. Afecta al radar y a España/Mundo/Mis temas, conservando discos, canciones y entrevistas de cualquier país. Las visitas con destino fuera de Europa se excluyen; una gira mixta con fechas europeas se conserva. El destino del titular prevalece sobre referencias de contexto en el extracto. Si el RSS no indica un destino reconocido, la opción Europa conserva la noticia; Solo España exige una mención española. Se reconoce una lista ampliable de países, ciudades y festivales, sin verificar fechas ni completar una agenda. Los perfiles anteriores adoptan Europa y conservan el modo independiente Solo conciertos en España.
- Una efeméride musical del día aparece como una tarjeta más en el radar y una nota al final de cada informativo (España/Mundo/Mis temas), con titular, año histórico, fuente de Wikipedia y atribución CC BY-SA 4.0. Se puede guardar, ocultar y excluir mediante No me interesa. «Desactivar todas las efemérides» en la tarjeta o «Mis intereses → Música → Incluir una efeméride musical del día» desactiva su inclusión en este navegador; viene activada para conservar el calendario existente. Los filtros por época (incluidos los 80), tipo, estilos y nombres se respetan; no se inventa una efeméride si no hay coincidencias. Se selecciona como máximo una y cuenta dentro del límite de notas del informativo. No lleva una fecha de publicación ficticia ni rellena una ventana vacía de noticias recientes. Se consulta Wikimedia en español para la fecha de Madrid, con caché de seis horas, y falla sin alterar las noticias. El modelo redacta solo las noticias actuales; el texto histórico se lee de la fuente, sin completarlo con un LLM. MusicBrainz/Discogs no están conectados.
- Priorizar una comunidad autónoma o municipio, añadir hasta diez intereses propios y elegir los medios incluidos.
- Usar una ventana de 6, 12, 24 o 48 horas en el feed personalizado, con 24 horas por defecto.
- Activar «solo mis subtemas» para excluir otros subtemas dentro de las categorías afinadas.
- «No me interesa» en una tarjeta, una nota del informativo o el reproductor permite ocultar esa noticia (hasta 50 IDs recientes), excluir un subtema (hasta 20) o un nombre/frase (hasta 10). El cambio es inmediato, con Deshacer; los filtros se pueden quitar en Mis intereses y guardar. Se aplican al feed y a futuras ediciones España/Mundo/Mis temas, respetando el resto de la selección y las puntuaciones. En una edición ya abierta se saltan notas afectadas, sin borrar guardados. Son reglas explícitas sobre etiquetas y palabras del RSS, no un modelo que deduzca automáticamente gustos de un clic. Se guardan en cada navegador; no hay cuenta, sincronización ni aprendizaje compartido entre visitantes.
- «Traducir al español» convierte el titular y extracto RSS de noticias en inglés, con opción de ver el original. Usa Gemini o el Gateway ya configurado, guarda una caché de 24 horas y comparte llamadas simultáneas iguales. Se mantienen ID, URL, fecha, atribución, clasificación y criterios de selección; no se descarga ni traduce el artículo completo. Los siete canales musicales anglófonos y RSS marcados como en se reconocen. En el informativo se traduce en lote el contenido inglés seleccionado antes del guion, incluidos titulares y extractos del fallback; si el servicio falla, se conserva el original y se avisa. La traducción se etiqueta como automática. Las cifras deben coincidir con las originales, pero esto no garantiza una traducción perfecta. El endpoint solo admite IDs de noticias recientes obtenidas por el servidor y limita las consultas; una guardada antigua sin traducción conservada puede dejar de ser traducible cuando salga de las fuentes. El navegador conserva las últimas 50 traducciones con el texto original para detectar cambios; los guardados traducidos conservan ambos idiomas.
- Buscar titulares, filtrar por tema, ordenar por fecha y guardar noticias en tu dispositivo.
- Preparar una edición breve, habitual o ampliada con referencias a cada fuente.
- Cada noticia anuncia el tema y el titular original antes del resumen y su fuente. El titular aparece también en la transcripción y el reproductor, y se lee una sola vez en las ediciones extractivas.
- Escuchar la edición con la síntesis de voz del navegador, pausar, saltar noticias con un botón visible y volver a la anterior. El cambio de velocidad se aplica desde la siguiente frase sin reiniciar la noticia, también en voces móviles sin eventos de posición.
- Alternar una presentadora y un presentador entre noticias completas, o elegir una sola voz. Se priorizan voces en español de España y variantes naturales cuando están disponibles. Puedes elegir y probar las voces del dispositivo; el cambio se aplica a la siguiente noticia. Si el navegador solo expone una voz en español, la app informa de esa limitación y usa esa voz para ambos turnos, sin simular el género alterando el tono. La lectura respeta frases y pausas, y pronuncia siglas comunes y porcentajes.
- Activar o silenciar «Breaking News Bed», música original aportada por el propietario, como fondo del informativo. El MP3 de unos 44 segundos se reproduce en bucle, pausa y reanuda junto con la narración, y conserva el control de volumen y silencio. El volumen inicial es 38 %; cambiar la pista no aumenta el volumen guardado. Se sirve desde el mismo sitio y el service worker guarda la pista con la interfaz para poder reutilizarla sin conexión. No necesita un servicio de música externo. La reproducción simultánea de voz y fondo en segundo plano depende del navegador y del móvil.
- Preguntar por las noticias y obtener fuentes relacionadas. Con la IA configurada, obtener respuestas y resúmenes con referencias.
- La búsqueda del chat reconoce inteligencia artificial, IA y AI como el mismo tema, incluyendo referencias explícitas a ChatGPT, OpenAI, Claude, Gemini y otros modelos, sin coincidencias dentro de palabras como Galicia. Conserva otros términos de la pregunta y consulta solo noticias de las últimas 24 horas. El chat usa la clave de Gemini existente (los mismos modelos del informativo), o el Gateway si Gemini no está configurado; no necesita un proveedor adicional. Si el proveedor falla, muestra titulares y extractos con sus fuentes, sin afirmar que no hay noticias ni pedir activar una IA que ya está configurada.
- El chat acepta temas de cualquier país y consulta todos los medios incluidos, independientemente del ámbito del informativo o de los intereses del radar; no hace una búsqueda de toda la web. Las consultas de clubes exigen el nombre del club y contexto deportivo, no solo palabras comunes como club o atlético. Atlanta de Buenos Aires requiere referencias al club argentino y no se confunde con Atlético de Madrid, Atlanta United o la ciudad estadounidense. Las demás consultas exigen coincidencia con al menos tres cuartos de los términos significativos. Si no hay evidencia reciente, se explica el límite de cobertura sin mostrar noticias de otra entidad. La detección es heurística y puede omitir referencias abreviadas o destinos ausentes.
- Instalar la app en la pantalla de inicio en Android o iPhone.

## Empezar

Node.js 22 o superior.

```sh
npm ci
npm start
```

Abre `http://localhost:3000`. Si tu entorno usa un proxy y Node 24, puedes iniciar con `node --use-env-proxy server/index.js`.

## Activar la IA

La selección de noticias y la lectura en audio funcionan sin credenciales. En ese caso la interfaz muestra **titulares y extractos RSS**, y las consultas devuelven fuentes relacionadas; no simula respuestas de IA.

Para activar síntesis y respuestas redactadas, configura exclusivamente en el servidor:

```text
AI_GATEWAY_API_KEY=<secreto del servicio>
AI_GATEWAY_MODEL=<ID actual provider/model>
```

Consulta el catálogo actual en `https://ai-gateway.vercel.sh/v1/models`. `.env.example` propone un modelo verificado durante la implementación; comprueba disponibilidad y precio antes de activarlo. Configura un presupuesto en el proveedor. No pongas la clave en código público, en el navegador ni en el chat. En Sites, usa sus ajustes de variables de entorno. Para desarrollo puedes usar `node --env-file=.env server/index.js` después de copiar `.env.example` a `.env`.

La IA admite Vercel AI Gateway mediante AI SDK. El chat también reutiliza Gemini si su clave está configurada, igual que el guion de radio y la traducción. Recibe solo los titulares y extractos seleccionados. Cada párrafo exige referencias a IDs existentes. Si no puede responder con las fuentes, debe abstenerse. La validación de IDs no demuestra la veracidad de todas las afirmaciones: revisa los artículos originales. No hay garantía de «cero alucinaciones».

## Informativo de radio con voz neuronal

«Escuchar ahora» puede locutar un informativo redactado para radio en lugar de leer titulares con la voz del dispositivo. Es opcional y se activa con dos credenciales gratuitas; sin ellas la app sigue funcionando como antes.

El guion alterna frases cortas y medias, integra tema y titular y usa transiciones cuando ayudan, evitando fórmulas repetidas y dramatismo. Elvira y Álvaro conservan su tono natural con una cadencia un 4 % más ágil y pausas entre frases de 240 ms mediante SSML, sin cambiar el tono ni usar estilos no compatibles. La velocidad del reproductor se aplica sobre esa cadencia. La caché identifica el guion por su prompt y el audio por su SSML, para no reutilizar versiones de una locución anterior. La música y el fallback del dispositivo se conservan.

```text
# Voz: Azure Speech (capa gratuita de ~500.000 caracteres al mes; un informativo de 10 minutos usa ~9.000)
AZURE_SPEECH_KEY=<secreto>
AZURE_SPEECH_REGION=<región, por ejemplo westeurope>

# Guion: Gemini (capa gratuita). Alternativa: AI_GATEWAY_API_KEY + AI_GATEWAY_MODEL
GEMINI_API_KEY=<secreto>
GEMINI_MODEL=<opcional; por defecto gemini-3.5-flash-lite y, si responde 404, gemini-3.8-flash. Los proyectos nuevos ya no pueden usar gemini-2.5-* aunque models.list los muestre. Comprueba con: GEMINI_API_KEY=... node scripts/check-gemini.mjs>
```

Cómo funciona:

1. El servidor selecciona las noticias con el mismo algoritmo de siempre y pide al LLM un párrafo de radio por noticia, solo con titulares y extractos. Cada párrafo debe citar noticias existentes, y cualquier cifra que no aparezca en la fuente hace que esa noticia se lea con su titular y extracto originales.
2. La apertura (saludo, hora de Madrid y ámbito) y el cierre se escriben en código, no con el modelo.
3. Cada noticia se convierte en un MP3 (voces `es-ES-ElviraNeural` y `es-ES-AlvaroNeural`, alternadas o fijas según «Voces del informativo»). El navegador lo reproduce con un `<audio>`, con controles de pantalla de bloqueo (Media Session), velocidades y saltos entre noticias.
4. `POST /api/tts` solo sintetiza texto que el propio servidor ha firmado (HMAC con `AUDIO_SIGNING_SECRET`, o la clave de Azure si no se define), de modo que no sirve como proxy de voz gratuito.
5. Si la voz neuronal falla, la app continúa con la voz del dispositivo desde la misma noticia.

Duración: Breve ≈ 3 min, Habitual ≈ 6 min, Ampliada ≈ 10 min como objetivo. Los RSS solo traen extractos cortos, así que la edición puede quedar más breve; no se rellena con conocimiento del modelo.

Caché: los guiones y MP3 se guardan en la Cache API del Worker cuando el alojamiento la ofrece y en memoria en caso contrario; no se persisten entre despliegues. Para generar el informativo de madrugada y conservar los MP3 hay que vincular D1/R2 (siguiente fase).

## Instalar en el móvil

- **Android:** abre la URL HTTPS en Chrome → menú → Instalar aplicación / Añadir a pantalla de inicio.
- **iPhone:** abre la URL en Safari → Compartir → Añadir a pantalla de inicio.

La app requiere internet para cargar noticias. El service worker conserva la interfaz para que se pueda abrir sin conexión, pero no presenta noticias antiguas como si fueran nuevas. Las voces y la reproducción con la pantalla bloqueada dependen del navegador y del dispositivo. Esta versión no descarga archivos MP3 ni incluye notificaciones automáticas.

## Fuentes y privacidad

- Solo canales RSS públicos. No se sortean paywalls ni se descargan artículos completos.
- Infobae España y los canales de música intentan primero su RSS oficial. Si falla, consultan la copia pública del mismo canal en Feedly, conservando el enlace al artículo original, su fecha de publicación y solo el extracto RSS. El respaldo se cachea cinco minutos y se indica en «Fuentes». Esta consulta no usa claves ni cuentas adicionales; depende de la disponibilidad y los límites de Feedly, y falla de forma visible si el servicio deja de permitirla. No utiliza fechas de rastreo para aparentar noticias nuevas.
- La recogida conserva publicaciones de hasta 48 horas. La selección muestra las últimas 24 horas por defecto (configurable a 6, 12 o 48); descarta fechas desconocidas, futuras y enlaces fuera del dominio de la fuente.
- Las categorías y subtemas se asignan con coincidencias de palabras completas y expresiones de títulos, etiquetas y extractos. Las noticias pueden pertenecer a varias categorías; la clasificación puede equivocarse. La ubicación prioriza menciones del lugar en el texto, no identifica el lugar exacto de un acontecimiento.
- Feed y edición «Mis temas» comparten el algoritmo de intereses, subtemas, localidad, temas propios y exclusión de medios. Las ediciones generales España/Mundo no dependen de los intereses: ordenan por recencia, cobertura de titulares similares entre medios, posición en los canales y variedad de temas y medios. Agrupan titulares similares para evitar repeticiones sin combinar afirmaciones. La relevancia es una aproximación automática, no un juicio editorial ni una verificación. La distinción España/Mundo usa secciones, etiquetas y menciones geográficas; puede equivocarse. Las exclusiones de medios se respetan en todas las ediciones. La actualidad separa las noticias de hasta 12 horas, 12–24 horas y 24–48 horas para evitar que una noticia antigua adelante a una nueva solo por afinidad. Dentro de cada grupo, el orden combina afinidad, edad y variedad de medios. El boletín limita las noticias de una sola fuente. No afirma haber contrastado de forma independiente todos los acontecimientos.
- Los canales se comprueban con una caché de dos minutos. La app abierta y visible consulta novedades cada dos minutos y al volver del segundo plano; «Actualizar» fuerza la comprobación salvo una protección de 30 segundos entre consultas. No se garantiza publicación continua de todos los medios. Se muestra la fecha de su última publicación por separado de la hora de comprobación.
- La duración es una estimación del texto disponible. No se amplía el contenido para aparentar 10 minutos.
- Intereses, subtemas, zona y guardados se almacenan en el navegador. No hay cuenta ni sincronización entre dispositivos. Las consultas se envían al servidor y, cuando se activa la IA, al proveedor.
- Antes de una explotación comercial, revisa los términos de reutilización de cada medio y negocia las licencias necesarias. Identificar un medio no implica un acuerdo con él.

## Comprobar y publicar

```sh
npm test
npm run check
npm run build
```

La compilación produce un Worker ESM en `dist/server/index.js` con los recursos de la interfaz incorporados. `.openai/hosting.json` identifica el Site privado. No cambies su ID para actualizarlo.

Para otras plataformas Node, ejecuta `npm start` detrás de HTTPS y configura las dos variables de IA en su administrador de secretos. Para una app en App Store o Google Play, habrá que preparar un contenedor nativo, reproducción de audio persistente y las cuentas de desarrollador correspondientes.

## Probar la app

https://brujula-noticias-espana.alelago.chatgpt.site (acceso público por enlace).

## Estado de esta versión

Intereses, RSS, guardados, boletín extractivo, búsqueda de fuentes y PWA implementados. Síntesis y respuestas con IA preparadas, pendientes de la credencial del proveedor. Voz neuronal por noticia y guion de radio con LLM (opcionales, ver arriba). MP3 persistente, envío matutino/vespertino, cuentas y ampliación a 70–80 medios son pasos posteriores.
