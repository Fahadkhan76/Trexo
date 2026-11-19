import type { Language, Product, ProductCategory } from '../types';

export interface TranslationDictionary {
  appTitle: string;
  tagline: string;
  navCounter: string;
  navInventory: string;
  navRestock: string;
  onlineLabel: string;
  offlineLabel: string;
  connectivityNote: string;
  demoDataBadge: string;
  resetDemoData: string;
  resetConfirmTitle: string;
  resetConfirmBody: string;
  resetConfirmAction: string;
  cancel: string;
  privacyShow: string;
  privacyHide: string;
  heroTrappedCash: string;
  heroTrappedSub: string;
  heroLostSales: string;
  heroLostSalesSub: string;
  searchPlaceholder: string;
  allCategories: string;
  customItem: string;
  addToCart: string;
  outOfStock: string;
  lowStock: string;
  deadStock: string;
  nearExpiry: string;
  healthy: string;
  parkBill: string;
  parkedBills: string;
  completeBill: string;
  billSubtotal: string;
  itemDiscounts: string;
  overallDiscount: string;
  grandTotal: string;
  belowCostWarning: string;
  cash: string;
  upi: string;
  creditUdhaar: string;
  split: string;
  selectCustomer: string;
  addCustomer: string;
  rescueStuckCash: string;
  supplierActionDue: string;
  lowStockAction: string;
  applyCounterDiscount: string;
  addToReturnList: string;
  generateReturnSlip: string;
  copyList: string;
  shareWhatsApp: string;
  demoForecastBadge: string;
  expectedSales: string;
  recommendedPurchase: string;
  demandGrowth: string;
  addToPO: string;
  stopReordering: string;
  undo: string;
  printReceipt: string;
}

const en: TranslationDictionary = {
  appTitle: 'Trexo',
  tagline: 'Free your cash. Never run out.',
  navCounter: 'Counter',
  navInventory: 'Inventory',
  navRestock: 'Restock',
  onlineLabel: 'Online',
  offlineLabel: 'Unreliable / Offline',
  connectivityNote: 'Works with unreliable connectivity · Data saved on this device',
  demoDataBadge: 'Demo data',
  resetDemoData: 'Reset demo data',
  resetConfirmTitle: 'Reset demo data?',
  resetConfirmBody:
    'This clears any bills, discounts, custom items, and stock edits and restores the starting kirana store scenario.',
  resetConfirmAction: 'Yes, restore demo data',
  cancel: 'Cancel',
  privacyShow: 'Show sensitive figures',
  privacyHide: 'Hide cost & profit',
  heroTrappedCash: 'Cash trapped in dead stock',
  heroTrappedSub: 'Unsold qty × cost price across idle items',
  heroLostSales: 'Estimated sales lost to stockouts',
  heroLostSalesSub: 'Seeded estimate from low & out-of-stock fast movers',
  searchPlaceholder: 'Search item or scan SKU (press / to focus, Enter to add)',
  allCategories: 'All',
  customItem: 'Custom Item',
  addToCart: 'Add',
  outOfStock: 'Out of Stock',
  lowStock: 'Low Stock',
  deadStock: 'Dead Stock',
  nearExpiry: 'Near Expiry',
  healthy: 'Healthy',
  parkBill: 'Park Bill',
  parkedBills: 'Parked Bills',
  completeBill: 'Complete Bill',
  billSubtotal: 'Subtotal',
  itemDiscounts: 'Item Discounts',
  overallDiscount: 'Overall Discount',
  grandTotal: 'Grand Total',
  belowCostWarning: 'Selling price is below cost price',
  cash: 'Cash',
  upi: 'UPI',
  creditUdhaar: 'Udhaar',
  split: 'Split',
  selectCustomer: 'Select customer',
  addCustomer: 'Add Customer',
  rescueStuckCash: 'Rescue Stuck Cash',
  supplierActionDue: 'Supplier Action Due',
  lowStockAction: 'Low Stock Reorder',
  applyCounterDiscount: 'Apply Counter Discount',
  addToReturnList: 'Add to Supplier Return List',
  generateReturnSlip: 'Generate Return Slip',
  copyList: 'Copy List',
  shareWhatsApp: 'Share on WhatsApp',
  demoForecastBadge: 'Demo forecast',
  expectedSales: 'Expected Sales',
  recommendedPurchase: 'Recommended Purchase Value',
  demandGrowth: 'Demand Growth',
  addToPO: 'Add to Purchase Order',
  stopReordering: 'Stop Reordering',
  undo: 'Undo',
  printReceipt: 'Print A5/A4 Receipt',
};

const hi: TranslationDictionary = {
  appTitle: 'Trexo',
  tagline: 'Free your cash. Never run out.',
  navCounter: 'काउंटर',
  navInventory: 'इन्वेंटरी',
  navRestock: 'रीस्टॉक',
  onlineLabel: 'ऑनलाइन',
  offlineLabel: 'नेटवर्क कमजोर / ऑफलाइन',
  connectivityNote: 'कमज़ोर नेटवर्क में भी काम करता है · डेटा इस डिवाइस में सेव है',
  demoDataBadge: 'डेमो डेटा',
  resetDemoData: 'डेमो डेटा रीसेट करें',
  resetConfirmTitle: 'डेमो डेटा रीसेट करें?',
  resetConfirmBody:
    'इससे सभी बिल, छूट, नए आइटम और स्टॉक बदलाव हट जाएंगे और शुरुआती किराना डेटा वापस आ जाएगा।',
  resetConfirmAction: 'हाँ, रीसेट करें',
  cancel: 'रद्द करें',
  privacyShow: 'गोपनीय आंकड़े दिखाएं',
  privacyHide: 'लागत व मुनाफा छिपाएं',
  heroTrappedCash: 'डेड स्टॉक में फंसा पैसा',
  heroTrappedSub: 'न बिके सामान की संख्या × खरीद मूल्य',
  heroLostSales: 'स्टॉक खत्म होने से अनुमानित नुकसान',
  heroLostSalesSub: 'कम व खत्म तेज बिकने वाले सामान का अनुमान',
  searchPlaceholder: 'आइटम खोजें या SKU टाइप करें (/ दबाएं, Enter से जोड़ें)',
  allCategories: 'सभी',
  customItem: 'नया आइटम',
  addToCart: 'जोड़ें',
  outOfStock: 'स्टॉक खत्म',
  lowStock: 'कम स्टॉक',
  deadStock: 'डेड स्टॉक',
  nearExpiry: 'जल्द एक्सपायरी',
  healthy: 'ठीक स्टॉक',
  parkBill: 'बिल होल्ड करें',
  parkedBills: 'होल्ड बिल',
  completeBill: 'बिल पूरा करें',
  billSubtotal: 'उप-योग',
  itemDiscounts: 'आइटम छूट',
  overallDiscount: 'कुल छूट',
  grandTotal: 'कुल राशि',
  belowCostWarning: 'बिक्री मूल्य खरीद मूल्य से कम है',
  cash: 'नकद',
  upi: 'UPI',
  creditUdhaar: 'उधार',
  split: 'बांटकर',
  selectCustomer: 'ग्राहक चुनें',
  addCustomer: 'नया ग्राहक',
  rescueStuckCash: 'फंसा पैसा निकालें',
  supplierActionDue: 'सप्लायर वापसी / बकाया',
  lowStockAction: 'कम स्टॉक ऑर्डर',
  applyCounterDiscount: 'काउंटर छूट लगाएं',
  addToReturnList: 'सप्लायर वापसी में जोड़ें',
  generateReturnSlip: 'वापसी पर्ची बनाएं',
  copyList: 'सूची कॉपी करें',
  shareWhatsApp: 'व्हाट्सएप पर भेजें',
  demoForecastBadge: 'डेमो पूर्वानुमान',
  expectedSales: 'अनुमानित बिक्री',
  recommendedPurchase: 'सुझावित खरीद मूल्य',
  demandGrowth: 'मांग में बढ़ोतरी',
  addToPO: 'खरीद ऑर्डर में जोड़ें',
  stopReordering: 'रीऑर्डर रोकें',
  undo: 'वापस लें',
  printReceipt: 'A5/A4 रसीद प्रिंट करें',
};

const kn: TranslationDictionary = {
  appTitle: 'Trexo',
  tagline: 'Free your cash. Never run out.',
  navCounter: 'ಕೌಂಟರ್',
  navInventory: 'ದಾಸ್ತಾನು',
  navRestock: 'ರೀಸ್ಟಾಕ್',
  onlineLabel: 'ಆನ್‌ಲೈನ್',
  offlineLabel: 'ನೆಟ್‌ವರ್ಕ್ ದುರ್ಬಲ / ಆಫ್‌ಲೈನ್',
  connectivityNote: 'ದುರ್ಬಲ ನೆಟ್‌ವರ್ಕ್‌ನಲ್ಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ · ಡೇಟಾ ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿದಿದೆ',
  demoDataBadge: 'ಡೆಮೋ ಡೇಟಾ',
  resetDemoData: 'ಡೆಮೋ ಡೇಟಾ ಮರುಹೊಂದಿಸಿ',
  resetConfirmTitle: 'ಡೆಮೋ ಡೇಟಾ ಮರುಹೊಂದಿಸುವುದೇ?',
  resetConfirmBody:
    'ಇದು ಎಲ್ಲಾ ಬಿಲ್‌ಗಳು, ರಿಯಾಯಿತಿಗಳು ಮತ್ತು ದಾಸ್ತಾನು ಬದಲಾವಣೆಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ ಆರಂಭಿಕ ಕಿರಾಣಿ ಡೇಟಾವನ್ನು ಮರುಸ್ಥಾಪಿಸುತ್ತದೆ.',
  resetConfirmAction: 'ಹೌದು, ಮರುಹೊಂದಿಸಿ',
  cancel: 'ರದ್ದುಮಾಡಿ',
  privacyShow: 'ಗೌಪ್ಯ ಅಂಕಿ ತೋರಿಸಿ',
  privacyHide: 'ವೆಚ್ಚ ಮತ್ತು ಲಾಭ ಮರೆಮಾಡಿ',
  heroTrappedCash: 'ಡೆಡ್ ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಸಿಲುಕಿದ ಹಣ',
  heroTrappedSub: 'ಮಾರಾಟವಾಗದ ಪ್ರಮಾಣ × ಖರೀದಿ ಬೆಲೆ',
  heroLostSales: 'ಸ್ಟಾಕ್ ಇಲ್ಲದೆ ಕಳೆದ ಅಂದಾಜು ಮಾರಾಟ',
  heroLostSalesSub: 'ಕಡಿಮೆ/ಖಾಲಿಯಾದ ವೇಗದ ವಸ್ತುಗಳ ಅಂದಾಜು',
  searchPlaceholder: 'ವಸ್ತು ಹುಡುಕಿ ಅಥವಾ SKU ನಮೂದಿಸಿ (/ ಒತ್ತಿ, Enter ನಿಂದ ಸೇರಿಸಿ)',
  allCategories: 'ಎಲ್ಲಾ',
  customItem: 'ಹೊಸ ವಸ್ತು',
  addToCart: 'ಸೇರಿಸಿ',
  outOfStock: 'ಸ್ಟಾಕ್ ಖಾಲಿ',
  lowStock: 'ಕಡಿಮೆ ಸ್ಟಾಕ್',
  deadStock: 'ಡೆಡ್ ಸ್ಟಾಕ್',
  nearExpiry: 'ಶೀಘ್ರ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ',
  healthy: 'ಉತ್ತಮ ಸ್ಟಾಕ್',
  parkBill: 'ಬಿಲ್ ಹೋಲ್ಡ್ ಮಾಡಿ',
  parkedBills: 'ಹೋಲ್ಡ್ ಬಿಲ್‌ಗಳು',
  completeBill: 'ಬಿಲ್ ಪೂರ್ಣಗೊಳಿಸಿ',
  billSubtotal: 'ಉಪ-ಮೊತ್ತ',
  itemDiscounts: 'ವಸ್ತು ರಿಯಾಯಿತಿ',
  overallDiscount: 'ಒಟ್ಟು ರಿಯಾಯಿತಿ',
  grandTotal: 'ಒಟ್ಟು ಮೊತ್ತ',
  belowCostWarning: 'ಮಾರಾಟ ಬೆಲೆ ಖರೀದಿ ಬೆಲೆಗಿಂತ ಕಡಿಮೆಯಿದೆ',
  cash: 'ನಗದು',
  upi: 'UPI',
  creditUdhaar: 'ಉಧಾರ್',
  split: 'ಹಂಚಿಕೆ',
  selectCustomer: 'ಗ್ರಾಹಕರನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  addCustomer: 'ಹೊಸ ಗ್ರಾಹಕ',
  rescueStuckCash: 'ಸಿಲುಕಿದ ಹಣ ಬಿಡಿಸಿ',
  supplierActionDue: 'ಪೂರೈಕೆದಾರ ಬಾಕಿ / ವಾಪಸ್',
  lowStockAction: 'ಕಡಿಮೆ ಸ್ಟಾಕ್ ಆರ್ಡರ್',
  applyCounterDiscount: 'ಕೌಂಟರ್ ರಿಯಾಯಿತಿ ಹಾಕಿ',
  addToReturnList: 'ವಾಪಸ್ ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ',
  generateReturnSlip: 'ವಾಪಸ್ ಚೀಟಿ ರಚಿಸಿ',
  copyList: 'ಪಟ್ಟಿ ನಕಲಿಸಿ',
  shareWhatsApp: 'WhatsApp ನಲ್ಲಿ ಹಂಚಿ',
  demoForecastBadge: 'ಡೆಮೋ ಮುನ್ಸೂಚನೆ',
  expectedSales: 'ನಿರೀಕ್ಷಿತ ಮಾರಾಟ',
  recommendedPurchase: 'ಶಿಫಾರಸು ಖರೀದಿ ಮೌಲ್ಯ',
  demandGrowth: 'ಬೇಡಿಕೆ ಬೆಳವಣಿಗೆ',
  addToPO: 'ಖರೀದಿ ಆರ್ಡರ್‌ಗೆ ಸೇರಿಸಿ',
  stopReordering: 'ಮರುಆರ್ಡರ್ ನಿಲ್ಲಿಸಿ',
  undo: 'ರದ್ದುಪಡಿಸಿ',
  printReceipt: 'A5/A4 ರಸೀದಿ ಮುದ್ರಿಸಿ',
};

const dictionaries: Record<Language, TranslationDictionary> = {
  en,
  hi,
  kn,
};

const CATEGORY_LABELS: Record<Language, Record<ProductCategory, string>> = {
  en: {
    'Staples & Grains': 'Staples & Grains',
    'Oils & Ghee': 'Oils & Ghee',
    'Snacks & Biscuits': 'Snacks & Biscuits',
    'Beverages & Dairy': 'Beverages & Dairy',
    'Personal & Home Care': 'Personal & Home Care',
    'Spices & Masalas': 'Spices & Masalas',
  },
  hi: {
    'Staples & Grains': 'अनाज और दालें',
    'Oils & Ghee': 'तेल और घी',
    'Snacks & Biscuits': 'स्नैक्स और बिस्किट',
    'Beverages & Dairy': 'पेय और डेयरी',
    'Personal & Home Care': 'पर्सनल व होम केयर',
    'Spices & Masalas': 'मसाले',
  },
  kn: {
    'Staples & Grains': 'ಧಾನ್ಯಗಳು ಮತ್ತು ಬೇಳೆ',
    'Oils & Ghee': 'ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ',
    'Snacks & Biscuits': 'ತಿಂಡಿ ಮತ್ತು ಬಿಸ್ಕತ್',
    'Beverages & Dairy': 'ಪಾನೀಯ ಮತ್ತು ಹಾಲು',
    'Personal & Home Care': 'ಮನೆ ಮತ್ತು ವೈಯಕ್ತಿಕ',
    'Spices & Masalas': 'ಮಸಾಲೆ ಪದಾರ್ಥಗಳು',
  },
};

export function getDictionary(lang: Language): TranslationDictionary {
  return dictionaries[lang] ?? dictionaries.en;
}

export function getCategoryLabel(category: ProductCategory, lang: Language): string {
  return CATEGORY_LABELS[lang]?.[category] ?? category;
}

export function getProductDisplayName(
  product: Pick<Product, 'name' | 'nameHi' | 'nameKn'>,
  lang: Language
): string {
  if (lang === 'hi' && product.nameHi) return product.nameHi;
  if (lang === 'kn' && product.nameKn) return product.nameKn;
  return product.name;
}
