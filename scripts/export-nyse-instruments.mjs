import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const exchange = 'NYSE';
const outputPath = resolve('public/data/nyse-instruments.json');

const apiToken = process.env.EODHD_API_TOKEN ?? (await readEnvToken());

if (!apiToken) {
  throw new Error('EODHD_API_TOKEN is required to export NYSE instruments.');
}

const url = new URL(`https://eodhd.com/api/exchange-symbol-list/${exchange}`);
url.searchParams.set('api_token', apiToken);
url.searchParams.set('fmt', 'json');

const response = await fetch(url, {
  headers: {
    Accept: 'application/json',
  },
});

if (!response.ok) {
  throw new Error(`EODHD returned ${response.status} for ${exchange}.`);
}

const payload = await response.json();

if (!Array.isArray(payload)) {
  throw new Error('EODHD returned an unexpected symbol list payload.');
}

const instruments = payload
  .map((item) => toInstrumentOption(item))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

await mkdir(resolve('public/data'), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ exchange, count: instruments.length, instruments }, null, 2)}\n`,
  'utf8',
);

console.log(`Exported ${instruments.length} ${exchange} instruments to ${outputPath}.`);

async function readEnvToken() {
  try {
    const envFile = (await readFile(resolve('.env'), 'utf8')).replace(/^\uFEFF/, '');
    const match = envFile.match(/^EODHD_API_TOKEN=(.+)$/m);

    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

function toInstrumentOption(item) {
  const code = readText(item.Code ?? item.code);
  const name = readText(item.Name ?? item.name);

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    exchange: readText(item.Exchange ?? item.exchange) ?? exchange,
    type: readText(item.Type ?? item.type) ?? '',
  };
}

function readText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
