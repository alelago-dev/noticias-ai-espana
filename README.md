# Brújula

Una app web instalable para móvil: abrir al salir y escuchar las noticias principales de las últimas horas de España o del mundo, con enlaces al periodismo original y una edición opcional según tus intereses.

## Qué puedes hacer

- Escuchar desde el inicio con un toque: la selección extractiva se prepara al cargar las noticias, sin iniciar audio automáticamente.
- Elegir España, Mundo o Mis temas y las últimas 6, 12 o 24 horas (12 por defecto en el informativo). No se rellena una ventana vacía con noticias antiguas.

- Elegir entre 13 categorías, asignar cuatro niveles de interés y seleccionar hasta cinco subtemas por categoría (89 subtemas disponibles).
- Consultar noticias recientes de EL PAÍS, ABC, elDiario.es, Europa Press, Xataka, EL MUNDO, 20minutos, La Vanguardia, El Periódico, El Confidencial, EL ESPAÑOL e Infobae España mediante 21 RSS generales, temáticos y locales. Incluye los canales de Barcelona de La Vanguardia, 20minutos y El Periódico, y el de Catalunya de elDiario.es; la disponibilidad depende de que cada medio permita leer su RSS desde el hosting.
- Priorizar una comunidad autónoma o municipio, añadir hasta diez intereses propios y elegir los medios incluidos.
- Usar una ventana de 6, 12, 24 o 48 horas en el feed personalizado, con 24 horas por defecto.
- Activar «solo mis subtemas» para excluir otros subtemas dentro de las categorías afinadas.
- Buscar titulares, filtrar por tema, ordenar por fecha y guardar noticias en tu dispositivo.
- Preparar una edición breve, habitual o ampliada con referencias a cada fuente.
- Cada noticia anuncia el tema y el titular original antes del resumen y su fuente. El titular aparece también en la transcripción y el reproductor, y se lee una sola vez en las ediciones extractivas.
- Escuchar la edición con la síntesis de voz del navegador, pausar, saltar noticias con un botón visible y volver a la anterior. El cambio de velocidad se aplica desde la siguiente frase sin reiniciar la noticia, también en voces móviles sin eventos de posición.
- Alternar una presentadora y un presentador entre noticias completas, o elegir una sola voz. Se priorizan voces en español de España y variantes naturales cuando están disponibles. Puedes elegir y probar las voces del dispositivo; el cambio se aplica a la siguiente noticia. Si el navegador solo expone una voz en español, la app informa de esa limitación y usa esa voz para ambos turnos, sin simular el género alterando el tono. La lectura respeta frases y pausas, y pronuncia siglas comunes y porcentajes.
- Activar o silenciar un fondo musical instrumental original con ritmo de informativo (126 pulsos por minuto, entrada de metales sintetizados, pulso continuo, bajo, bombo y caja), ajustar su volumen y conservar la preferencia en el dispositivo. El volumen inicial es 38 %; al actualizar desde el fondo anterior se aumenta una sola vez en 8 puntos, respetando el silencio y la desactivación. La música se pausa y termina junto con la narración; no precisa archivos ni servicios externos.
- Preguntar por las noticias y obtener fuentes relacionadas. Con la IA configurada, obtener respuestas y resúmenes con referencias.
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

La IA usa AI SDK y Vercel AI Gateway. Recibe solo los titulares y extractos seleccionados. Cada párrafo exige referencias a IDs existentes. Si no puede responder con las fuentes, debe abstenerse. La validación de IDs no demuestra la veracidad de todas las afirmaciones: revisa los artículos originales. No hay garantía de «cero alucinaciones».

## Informativo de radio con voz neuronal

«Escuchar ahora» puede locutar un informativo redactado para radio en lugar de leer titulares con la voz del dispositivo. Es opcional y se activa con dos credenciales gratuitas; sin ellas la app sigue funcionando como antes.

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
- Infobae España intenta primero su RSS oficial. Si falla, consulta la copia pública del mismo canal en Feedly, conservando el enlace al artículo de Infobae, su fecha de publicación y solo el extracto RSS. El respaldo se cachea cinco minutos y se indica en «Fuentes». Esta consulta no usa claves ni cuentas adicionales; depende de la disponibilidad y los límites de Feedly, y falla de forma visible si el servicio deja de permitirla. No utiliza fechas de rastreo para aparentar noticias nuevas.
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

https://brujula-noticias-espana.alelago.chatgpt.site (acceso privado con la cuenta propietaria).

## Estado de esta versión

Intereses, RSS, guardados, boletín extractivo, búsqueda de fuentes y PWA implementados. Síntesis y respuestas con IA preparadas, pendientes de la credencial del proveedor. Voz neuronal por noticia y guion de radio con LLM (opcionales, ver arriba). MP3 persistente, envío matutino/vespertino, cuentas y ampliación a 70–80 medios son pasos posteriores.
