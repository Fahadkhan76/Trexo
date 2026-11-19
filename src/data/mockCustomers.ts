import type { Customer } from '../types';
import { daysAgoISO } from '../utils/dates';

export function createSeedCustomers(now: Date = new Date()): Customer[] {
  return [
    {
      id: 'cust-ramesh',
      name: 'Ramesh Gowda',
      phone: '98452 77101',
      village: 'Harohalli Gate',
      udhaarPaise: 145000, // ₹1,450
      lastPaymentAt: daysAgoISO(6, now),
      notes: 'Monthly ration account',
    },
    {
      id: 'cust-sunita',
      name: 'Sunita Devi',
      phone: '99801 55320',
      village: 'Kanakapura Town',
      udhaarPaise: 82000, // ₹820
      lastPaymentAt: daysAgoISO(3, now),
      notes: 'Pays every Saturday',
    },
    {
      id: 'cust-mahesh',
      name: 'Mahesh Patil',
      phone: '97310 66284',
      village: 'Maralawadi',
      udhaarPaise: 230000, // ₹2,300
      lastPaymentAt: daysAgoISO(12, now),
      notes: 'Tea stall supplies',
    },
    {
      id: 'cust-kavitha',
      name: 'Kavitha Sharma',
      phone: '96114 29045',
      village: 'Sathanur Road',
      udhaarPaise: 45000, // ₹450
      lastPaymentAt: daysAgoISO(2, now),
      notes: 'Regular dairy & snacks',
    },
  ];
}
