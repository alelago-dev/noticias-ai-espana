# Brújula

Una app web instalable para móvil que organiza noticias de medios españoles según tus intereses, prepara una edición para leer o escuchar y enlaza siempre al periodismo original.

## Qué puedes hacer

- Elegir entre 12 categorías y asignar cuatro niveles de interés.
- Consultar noticias recientes de EL PAÍS, ABC, elDiario.es, Europa Press, Xataka y EL MUNDO mediante sus RSS públicos.
- Buscar titulares, filtrar por tema, ordenar por fecha y guardar noticias en tu dispositivo.
- Preparar una edición breve, habitual o ampliada con referencias a cada fuente.
- Escuchar la edición con la síntesis de voz del navegador, pausar, cambiar de velocidad y avanzar entre noticias.
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

## Instalar en el móvil

- **Android:** abre la URL HTTPS en Chrome → menú → Instalar aplicación / Añadir a pantalla de inicio.
- **iPhone:** abre la URL en Safari → Compartir → Añadir a pantalla de inicio.

La app requiere internet para cargar noticias. El service worker conserva la interfaz para que se pueda abrir sin conexión, pero no presenta noticias antiguas como si fueran nuevas. Las voces y la reproducción con la pantalla bloqueada dependen del navegador y del dispositivo. Esta versión no descarga archivos MP3 ni incluye notificaciones automáticas.

## Fuentes y privacidad

- Solo canales RSS públicos. No se sortean paywalls ni se descargan artículos completos.
- El feed muestra publicaciones fechadas dentro de las últimas 72 horas; descarta fechas desconocidas, futuras y enlaces fuera del dominio de la fuente.
- Las categorías se asignan con reglas de palabras clave; pueden equivocarse.
- El boletín busca variedad de medios y limita las noticias de una sola fuente. No afirma haber contrastado de forma independiente todos los acontecimientos.
- La duración es una estimación del texto disponible. No se amplía el contenido para aparentar 10 minutos.
- Intereses y guardados se almacenan en el navegador. No hay cuenta ni sincronización entre dispositivos. Las consultas se envían al servidor y, cuando se activa la IA, al proveedor.
- Antes de una explotación comercial, revisa los términos de reutilización de cada medio y negocia las licencias necesarias. Identificar un medio no implica un acuerdo con él.

## Comprobar y publicar

```sh
npm test
npm run check
npm run build
```

La compilación produce un Worker ESM en `dist/server/index.js` con los recursos de la interfaz incorporados. `.openai/hosting.json` identifica el Site privado. No cambies su ID para actualizarlo.

Para otras plataformas Node, ejecuta `npm start` detrás de HTTPS y configura las dos variables de IA en su administrador de secretos. Para una app en App Store o Google Play, habrá que preparar un contenedor nativo, reproducción de audio persistente y las cuentas de desarrollador correspondientes.

## Estado de esta versión

Intereses, RSS, guardados, boletín extractivo, búsqueda de fuentes y PWA implementados. Síntesis y respuestas con IA preparadas, pendientes de la credencial del proveedor. Voz profesional, MP3, envío matutino/vespertino, cuentas y ampliación a 70–80 medios son pasos posteriores.
