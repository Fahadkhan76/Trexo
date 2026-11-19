import { APP_CONFIG } from '../config';
import type { MunimServices } from './interfaces';
import { mockServices } from './mockServices';

/**
 * Typed service provider switched by VITE_USE_MOCK.
 * A separate backend team can plug in real HTTP implementations matching MunimServices.
 */
export function getServices(): MunimServices {
  if (APP_CONFIG.USE_MOCK) {
    return mockServices;
  }
  // Fallback to mock until remote API implementation is wired
  return mockServices;
}

export const services = getServices();
export type { MunimServices } from './interfaces';
