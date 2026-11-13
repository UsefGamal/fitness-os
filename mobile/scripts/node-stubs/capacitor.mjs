// Stand-ins for @capacitor/* when store/ code runs under node (TEST-1
// part C). Nothing native: isNativePlatform() is false, every plugin
// method resolves to {}. Tests that need a plugin to answer set
// globalThis.__capacitorPlugins[name] = { method() {...} }.
const plugins = (globalThis.__capacitorPlugins ??= {});

export function registerPlugin(name) {
  return new Proxy({}, {
    get: (_, method) => (typeof method === 'string' ? (...args) => Promise.resolve(plugins[name]?.[method] ? plugins[name][method](...args) : {}) : undefined),
  });
}

export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', isPluginAvailable: () => false };
export const App = registerPlugin('App');
export const Filesystem = registerPlugin('Filesystem');
export const Directory = { Data: 'DATA', Documents: 'DOCUMENTS', Cache: 'CACHE' };
export const Encoding = { UTF8: 'utf8' };
export const Haptics = registerPlugin('Haptics');
export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
export const NotificationType = { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' };
export const LocalNotifications = registerPlugin('LocalNotifications');
export const Share = registerPlugin('Share');
