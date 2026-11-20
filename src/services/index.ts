import type { MunimServices } from './interfaces';
import { mockServices } from './mockServices';

/**
 * Local mock service provider.
 * A separate backend team can plug in real HTTP implementations matching MunimServices.
 */
export function getServices(): MunimServices {
  return mockServices;
}

export const services = getServices();
export type { MunimServices } from './interfaces';
