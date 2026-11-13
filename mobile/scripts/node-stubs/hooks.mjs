// Module hooks for store/ tests under node (TEST-1 part C):
// - @capacitor/* resolves to ./capacitor.mjs;
// - a .json import without `with { type: 'json' }` (Vite allows it) loads
//   as a module whose default export is the parsed file;
// - files that read import.meta.env get one (Vite's build-time values),
//   from VITE_* in the environment. It is added on line 1, so coverage
//   line numbers stay true.
const STUB = new URL('./capacitor.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@capacitor/')) return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('.json') && !context.importAttributes?.type) {
    const { source } = await next(url, { ...context, format: 'json', importAttributes: { type: 'json' } });
    return { format: 'module', source: `export default ${source};`, shortCircuit: true };
  }
  const out = await next(url, context);
  if (url.startsWith('file:') && url.includes('/src/') && out.format === 'module') {
    const text = String(out.source);
    if (text.includes('import.meta.env')) {
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_')));
      return { ...out, source: `import.meta.env = ${JSON.stringify(env)};${text}` };
    }
  }
  return out;
}
