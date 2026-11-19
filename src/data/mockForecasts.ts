import type { ForecastHorizon } from '../types';

export interface HorizonSeedConfig {
  horizon: ForecastHorizon;
  days: number;
  growthPct: number;
  buckets: { label: string; factor: number }[];
}

export const FORECAST_HORIZON_CONFIG: Record<ForecastHorizon, HorizonSeedConfig> = {
  '1W': {
    horizon: '1W',
    days: 7,
    growthPct: 14,
    buckets: [
      { label: 'Mon', factor: 0.9 },
      { label: 'Tue', factor: 0.95 },
      { label: 'Wed', factor: 1.0 },
      { label: 'Thu', factor: 1.05 },
      { label: 'Fri', factor: 1.15 },
      { label: 'Sat', factor: 1.35 },
      { label: 'Sun', factor: 1.25 },
    ],
  },
  '1M': {
    horizon: '1M',
    days: 30,
    growthPct: 18,
    buckets: [
      { label: 'Week 1', factor: 0.95 },
      { label: 'Week 2', factor: 1.08 },
      { label: 'Week 3', factor: 1.14 },
      { label: 'Week 4', factor: 1.26 },
    ],
  },
  '6M': {
    horizon: '6M',
    days: 180,
    growthPct: 24,
    buckets: [
      { label: 'M1', factor: 1.0 },
      { label: 'M2', factor: 1.06 },
      { label: 'M3', factor: 1.14 },
      { label: 'M4', factor: 1.2 },
      { label: 'M5', factor: 1.28 },
      { label: 'M6', factor: 1.32 },
    ],
  },
  '1Y': {
    horizon: '1Y',
    days: 365,
    growthPct: 31,
    buckets: [
      { label: 'Q1', factor: 1.04 },
      { label: 'Q2', factor: 1.16 },
      { label: 'Q3', factor: 1.29 },
      { label: 'Q4', factor: 1.42 },
    ],
  },
};
