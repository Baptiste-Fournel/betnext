import { Module } from '@nestjs/common';
import { OddsCalculator } from './domain/OddsCalculator';

@Module({
  providers: [OddsCalculator],
  exports: [OddsCalculator],
})
export class PricingModule {}
