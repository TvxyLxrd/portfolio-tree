import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MarketDataModule,
  ],
})
export class AppModule {}
