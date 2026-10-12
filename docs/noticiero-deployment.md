# Noticiero Brújula: publicación y configuración

El frontend y la API se publican juntos en el Site existente:
https://brujula-noticias-espana.alelago.chatgpt.site

Proyecto de Sites: `appgprj_6acac6dfc3848191978dbf5e40888ccb`.
El manifiesto `.openai/hosting.json` se conserva sin cambios en esta fase.

## Variables del Worker de producción

Las variables deben configurarse en el **entorno de producción del proyecto de
Sites**, no en GitHub → Settings → Deploy keys. Las deploy keys dan acceso Git;
no configuran variables del Worker. Tampoco se transfieren automáticamente desde
GitHub Actions Secrets, un `.env` local o un recurso de Azure.

| Nombre exacto | Valor | ¿Secreto? |
| --- | --- | --- |
| `AZURE_SPEECH_KEY` | Una clave del recurso Azure AI Speech | Sí |
| `AZURE_SPEECH_REGION` | La región de ese mismo recurso, por ejemplo `westeurope` | No |
| `GEMINI_API_KEY` | Clave de Gemini obtenida en Google AI Studio | Sí |
| `GEMINI_MODEL` | Opcional: ID del modelo Gemini habilitado para tu clave; si se omite, prueba `gemini-3.5-flash-lite` y después `gemini-3.8-flash` solo si recibe 404 | No |
| `AUDIO_SIGNING_SECRET` | Opcional: secreto aleatorio independiente, de al menos 32 bytes | Sí |

En el editor de variables de producción de Sites, si está disponible en tu
interfaz, crea las entradas con esos nombres exactos, marca como secretos las
indicadas y guarda. Después vuelve a desplegar una versión guardada del Site:
las variables tienen su propia revisión y una publicación aplica esa revisión.

La vía confirmada por el conector Sites es
`sites_update_environment_variables(project_id, set_values)`. Cada entrada lleva
`key`, `value`, `type: "envvar"` y `is_secret`; solo cambian las claves indicadas.
Este entorno no proporciona un enlace verificado a un panel manual de secretos.
Si tu interfaz no ofrece el editor, será necesario un mecanismo seguro de entrada
compatible con Sites; no publiques claves en el chat, el repositorio ni el frontend.
No uses `wrangler secret put` contra un Worker que no esté en tu propia cuenta:
el Worker de esta app lo administra Sites.

Obtén la clave y la región de Azure en el recurso **Azure AI Speech → Keys and
Endpoint**. Para la capa gratuita, selecciona un recurso **F0**, no S0. Obtén la
clave Gemini en https://aistudio.google.com/app/apikey y verifica que el modelo
seleccionado tenga capa gratuita y esté disponible para tu proyecto.

Para crear `AUDIO_SIGNING_SECRET`, puedes ejecutar `openssl rand -hex 32` en tu
propio terminal y guardar el resultado directamente como secreto del Site. No
lo compartas. Si se omite, el parche utiliza `AZURE_SPEECH_KEY` para firmar clips.

### Qué activa cada configuración

- Sin Azure: se mantiene la lectura con la voz del dispositivo; `/api/tts`
  responde 503. La app no necesita claves para mostrar noticias o reproducirlas
  con esa voz.
- Con Azure y sin Gemini/AI Gateway: se generan clips neuronales a partir de
  titulares y extractos originales.
- Con Azure y Gemini: el informativo solicita un guion de radio a Gemini.
- Si falla Gemini: se usan titulares y extractos; si falla Azure o la reproducción
  del clip: se vuelve a la voz del dispositivo desde la noticia afectada.
- `GEMINI_API_KEY` se usa en el nuevo guion de radio. «Pregunta a Brújula» conserva
  su backend original de AI Gateway y necesita `AI_GATEWAY_API_KEY` y
  `AI_GATEWAY_MODEL` para redactar respuestas.

La respuesta de `/api/config` informa `audioAvailable` sin revelar claves. El
parche firma texto y voz con HMAC antes de permitir `POST /api/tts`.

## Caché y límites de esta fase

`server/cache.js` utiliza `caches.default` cuando está disponible y mantiene un
fallback en memoria. Cloudflare Workers dispone de Cache API, pero sus entradas
son locales a cada centro de datos y se pueden expulsar: no es almacenamiento
duradero ni garantiza que nunca se repita una llamada al proveedor. La
operatividad de la caché específica de Sites debe verificarse en producción;
los tests locales prueban el fallback en memoria.

- Guion: TTL de 30 minutos.
- Clips MP3: TTL de 6 horas.
- Memoria: hasta 200 entradas; no hay un límite agregado de bytes en este parche.
- El clip inicial incluye la hora actual de Madrid: generar otra edición en otro
  minuto puede cambiar su texto y producir un clip distinto, aunque se reutilice
  el guion.
- El HMAC no tiene fecha de expiración en esta fase. No debe sustituir la
  protección de acceso del Site ni sus límites de solicitudes.
- Son MP3 **por noticia**, no un único archivo descargable de toda la edición.
- El progreso es por número de noticias y fracción del clip actual; no representa
  un timeline global ponderado por la duración de todos los clips.
- La música de fondo sigue siendo Web Audio, separado del MP3. Que la voz
  continúe en segundo plano no garantiza que continúe esa música.
- Media Session y la reproducción con pantalla bloqueada requieren validación
  en un móvil real. Los tests de navegador no prueban el bloqueo físico de iOS
  o Android.
- Las comprobaciones de citas y cifras no demuestran que todas las afirmaciones
  del modelo sean verdaderas. La duración 3/6/10 minutos es un objetivo: no se
  rellena información ausente de los RSS.

Los límites gratuitos los impone cada proveedor. Azure Speech F0 anuncia una
cuota mensual de caracteres; confirma la vigente en tu recurso. Los límites de
Gemini varían por modelo/proyecto y se consultan en AI Studio. Si se agota una
cuota o el proveedor rechaza la solicitud, la app recurre al fallback; no cambia
por sí sola a un plan de pago.

## Fase 2: almacenamiento y generación nocturna

Sites admite bindings de **D1** para registros, perfiles y trabajos, y **R2** para
MP3 privados. Hoy ambos están a `null` en el manifiesto. Vincularlos requerirá un
cambio posterior de `.openai/hosting.json`, migraciones y una nueva publicación;
no se hace en esta fase.

Cloudflare Workers tiene Cron Triggers, pero el conector de Sites disponible no
expone su configuración nativa. Añadir una función `scheduled()` al código no
crea un trigger. No se ha confirmado que el propietario pueda configurarlo en
este alojamiento administrado.

La alternativa soportada en Sites es una automatización vinculada que llame a
un endpoint protegido, o un scheduler externo con acceso de servicio al Site.
Esa ruta debe verificarse sin una sesión de usuario abierta antes de activarla.
En esta fase no se crea ninguna programación de madrugada.

## Verificación

```sh
npm ci
npm test
npm run check
npm run build
```

Los tests de Gemini/Azure usan respuestas simuladas: no consumen créditos ni
requieren tus claves. La rama se propone a `main` mediante PR; publicarla en
Sites no implica hacer merge en GitHub.
