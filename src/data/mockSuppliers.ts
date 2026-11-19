import type { Supplier } from '../types';
import { daysFromNowISO } from '../utils/dates';

export function createSeedSuppliers(now: Date = new Date()): Supplier[] {
  return [
    {
      id: 'sup-kaveri',
      name: 'Kaveri Wholesale Distributors',
      contactName: 'Prakash Shetty',
      phone: '+91 98451 11204',
      pendingBalancePaise: 1480000, // ₹14,800
      paymentDueDate: daysFromNowISO(2, now),
      categories: ['Staples & Grains', 'Oils & Ghee'],
    },
    {
      id: 'sup-annapurna',
      name: 'Annapurna Agro & Masala Traders',
      contactName: 'Venkatesh Rao',
      phone: '+91 99002 34819',
      pendingBalancePaise: 625000, // ₹6,250
      paymentDueDate: daysFromNowISO(6, now),
      categories: ['Spices & Masalas', 'Beverages & Dairy'],
    },
    {
      id: 'sup-deccan',
      name: 'Deccan FMCG & Home Supply',
      contactName: 'Nagaraj Kulkarni',
      phone: '+91 97400 88512',
      pendingBalancePaise: 940000, // ₹9,400
      paymentDueDate: daysFromNowISO(11, now),
      categories: ['Snacks & Biscuits', 'Personal & Home Care'],
    },
  ];
}
