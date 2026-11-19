import { useEffect, useRef, useState } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { getDictionary, getProductDisplayName } from '../i18n';
import { useMunimStore } from '../store/useMunimStore';
import type { Sale } from '../types';
import { formatShortDate } from '../utils/dates';
import { formatINR } from '../utils/money';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const language = useMunimStore((s) => s.language);
  const products = useMunimStore((s) => s.ledger.products);
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>('A5');
  const printBtnRef = useRef<HTMLButtonElement>(null);

  const dict = getDictionary(language);

  useEffect(() => {
    if (!sale) return;
    printBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [sale, onClose]);

  if (!sale) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-xl bg-white border border-[#E5DFD3] shadow-2xl transition-all ${
          paperSize === 'A5' ? 'max-w-xl' : 'max-w-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen-only toolbar */}
        <div className="no-print flex items-center justify-between gap-3 border-b border-[#E5DFD3] bg-[#FAF7F0] px-5 py-3 rounded-t-xl">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-base">
            <CheckCircle2 className="h-5 w-5" />
            <span id="receipt-modal-title">Bill {sale.billNumber} Completed</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#D6CFC0] bg-white p-0.5">
              {(['A5', 'A4'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPaperSize(sz)}
                  className={`min-h-[34px] rounded-md px-3 text-sm font-semibold ${
                    paperSize === sz ? 'bg-[#0F172A] text-white' : 'text-[#475569]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            <button
              ref={printBtnRef}
              type="button"
              onClick={() => window.print()}
              className="flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>{dict.printReceipt}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#E5DFD3]"
              aria-label="Close receipt"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable A5 / A4 Invoice Sheet */}
        <div className="print-only-sheet p-6 text-[#0F172A]">
          <div className="flex items-start justify-between border-b border-slate-300 pb-4">
            <div>
              <h3 className="text-xl font-bold">{APP_CONFIG.STORE_NAME}</h3>
              <p className="text-sm text-[#475569]">{APP_CONFIG.STORE_SUBTITLE}</p>
              <p className="text-sm text-[#475569]">
                Ph: {APP_CONFIG.STORE_PHONE} · GSTIN: {APP_CONFIG.STORE_GSTIN}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-base font-bold">Bill #{sale.billNumber}</div>
              <div className="text-sm text-[#475569]">{formatShortDate(sale.createdAt)}</div>
              {sale.customerName && (
                <div className="mt-1 text-sm font-semibold">Customer: {sale.customerName}</div>
              )}
            </div>
          </div>

          <table className="mt-4 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-[#475569]">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Disc</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => {
                const matched = products.find((p) => p.id === item.productId);
                const label = matched ? getProductDisplayName(matched, language) : item.name;
                return (
                  <tr key={item.productId} className="border-b border-slate-200">
                    <td className="py-2.5 pr-2 font-medium">{label}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{item.qty}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatINR(item.unitPricePaise)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-[#475569]">
                      {item.lineDiscountPaise > 0 ? `-${formatINR(item.lineDiscountPaise)}` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                      {formatINR(item.lineTotalPaise)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col items-end space-y-1.5 text-sm">
            <div className="flex w-72 max-w-full justify-between gap-4">
              <span className="text-[#475569]">{dict.billSubtotal}</span>
              <span className="font-mono tabular-nums shrink-0">{formatINR(sale.grossSubtotalPaise)}</span>
            </div>
            {sale.itemDiscountTotalPaise > 0 && (
              <div className="flex w-72 max-w-full justify-between gap-4 text-emerald-800">
                <span>{dict.itemDiscounts}</span>
                <span className="font-mono tabular-nums shrink-0">
                  -{formatINR(sale.itemDiscountTotalPaise)}
                </span>
              </div>
            )}
            {sale.overallDiscountPaise > 0 && (
              <div className="flex w-72 max-w-full justify-between gap-4 text-emerald-800">
                <span>{dict.overallDiscount}</span>
                <span className="font-mono tabular-nums shrink-0">
                  -{formatINR(sale.overallDiscountPaise)}
                </span>
              </div>
            )}
            <div className="flex w-72 max-w-full justify-between gap-4 border-t border-slate-300 pt-2 text-lg font-bold">
              <span>{dict.grandTotal}</span>
              <span className="font-mono tabular-nums shrink-0">{formatINR(sale.totalPaise)}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm text-[#475569]">
            <div>
              {language === 'kn' ? 'ಪಾವತಿ' : language === 'hi' ? 'भुगतान' : 'Payment'}:{' '}
              <span className="font-semibold text-[#0F172A] uppercase">{sale.paymentMode}</span>
              {sale.payment.cashPaise > 0 && ` · ${dict.cash} ${formatINR(sale.payment.cashPaise)}`}
              {sale.payment.upiPaise > 0 && ` · ${dict.upi} ${formatINR(sale.payment.upiPaise)}`}
              {sale.payment.creditPaise > 0 && ` · ${dict.creditUdhaar} ${formatINR(sale.payment.creditPaise)}`}
            </div>
            <div>
              {language === 'kn'
                ? 'ಖರೀದಿಗೆ ಧನ್ಯವಾದಗಳು!'
                : language === 'hi'
                  ? 'खरीदारी के लिए धन्यवाद!'
                  : 'Thank you for shopping!'}
            </div>
          </div>
          <div className="mt-3 text-center text-xs font-medium text-[#475569]">
            Powered by Trexo
          </div>
        </div>
      </div>
    </div>
  );
}
