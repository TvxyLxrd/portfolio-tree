import { Controller, Get, Param } from '@nestjs/common';
import { InstrumentOption, MarketDataService } from './market-data.service';

interface ExchangeInstrumentsResponse {
  exchange: string;
  count: number;
  instruments: InstrumentOption[];
}

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('exchanges/:exchange/instruments')
  async getExchangeInstruments(
    @Param('exchange') exchange: string,
  ): Promise<ExchangeInstrumentsResponse> {
    const normalizedExchange = exchange.toUpperCase();
    const instruments = await this.marketDataService.getExchangeInstruments(normalizedExchange);

    return {
      exchange: normalizedExchange,
      count: instruments.length,
      instruments,
    };
  }
}
