// El sitio de un estudio se guarda como host (ejemplo.com) o, si está en desarrollo, como host:puerto.

// Un sitio en desarrollo: localhost, una IP de red privada o un dominio .local/.test, con o sin puerto
export function isLocalSite(site) {
  const host = String(site || '').replace(/:\d+$/, '');
  return host === 'localhost' || /\.(local|localhost|test)$/.test(host) ||
    /^(127|10)\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
}

// Origen con el que se pide un sitio: http en desarrollo, https en producción
export const siteOrigin = (site) => `${isLocalSite(site) ? 'http' : 'https'}://${site}`;
