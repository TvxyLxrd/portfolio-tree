import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstrumentOption {
  code: string;
  name: string;
  exchange: string;
  type: string;
}

interface EodhdExchangeSymbol {
  Code?: string;
  code?: string;
  Name?: string;
  name?: string;
  Exchange?: string;
  exchange?: string;
  Type?: string;
  type?: string;
}

interface CacheEntry {
  expiresAt: number;
  instruments: InstrumentOption[];
}

@Injectable()
export class MarketDataService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 12 * 60 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  async getExchangeInstruments(exchange: string): Promise<InstrumentOption[]> {
    const cacheKey = exchange.toUpperCase();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.instruments;
    }

    const apiToken = this.configService.get<string>('EODHD_API_TOKEN');

    if (!apiToken) {
      throw new ServiceUnavailableException('EODHD_API_TOKEN is not configured');
    }

    const response = await fetch(this.buildExchangeSymbolUrl(cacheKey, apiToken), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(`EODHD returned ${response.status} for ${cacheKey}`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      throw new BadGatewayException('EODHD returned an unexpected symbol list payload');
    }

    const instruments = payload
      .map((item) => this.toInstrumentOption(item as EodhdExchangeSymbol, cacheKey))
      .filter((instrument): instrument is InstrumentOption => instrument !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMs,
      instruments,
    });

    return instruments;
  }

  private buildExchangeSymbolUrl(exchange: string, apiToken: string): string {
    const url = new URL(`https://eodhd.com/api/exchange-symbol-list/${exchange}`);
    url.searchParams.set('api_token', apiToken);
    url.searchParams.set('fmt', 'json');

    return url.toString();
  }

  private toInstrumentOption(
    item: EodhdExchangeSymbol,
    fallbackExchange: string,
  ): InstrumentOption | null {
    const code = this.readText(item.Code ?? item.code);
    const name = this.readText(item.Name ?? item.name);

    if (!code || !name) {
      return null;
    }

    return {
      code,
      name,
      exchange: this.readText(item.Exchange ?? item.exchange) ?? fallbackExchange,
      type: this.readText(item.Type ?? item.type) ?? '',
    };
  }

  private readText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
