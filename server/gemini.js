// Shared model candidates for the configured Gemini API; retry only on 404.
export const GEMINI_DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
export const geminiModels = env => [...new Set([env.GEMINI_MODEL, ...GEMINI_DEFAULT_MODELS].filter(Boolean))];
