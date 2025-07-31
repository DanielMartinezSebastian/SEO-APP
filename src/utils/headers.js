export const getCommonHeaders = () => ({
  'Origin': 'https://www.google.com',
  'Referer': 'https://www.google.com/',
  'User-Agent': 'Mozilla/5.0',
  'Accept': '*/*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
});

export const getJsonHeaders = () => ({
  ...getCommonHeaders(),
  'Accept': 'application/json',
  'Content-Type': 'application/json'
});