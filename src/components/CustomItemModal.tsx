import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useMunimStore } from '../store/useMunimStore';
import type { ProductCategory } from '../types';
import { rupeesToPaise } from '../utils/money';

interface CustomItemModalProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated?: () => void;
}

const CATEGORIES: ProductCategory[] = [
  'Staples & Grains',
  'Oils & Ghee',
  'Snacks & Biscuits',
  'Beverages & Dairy',
  'Personal & Home Care',
  'Spices & Masalas',
];

const EMOJI_CHOICES = ['📦', '🍚', '🫙', '🍪', '🥛', '🧼', '🌶️', '🍵', '🥜', '🍯'];

export function CustomItemModal({
  open,
  initialName = '',
  onClose,
  onCreated,
}: CustomItemModalProps) {
  const suppliers = useMunimStore((s) => s.ledger.suppliers);
  const addProduct = useMunimStore((s) => s.addProduct);
  const addToCart = useMunimStore((s) => s.addToCart);
  const pushToast = useMunimStore((s) => s.pushToast);

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<ProductCategory>('Staples & Grains');
  const [emoji, setEmoji] = useState('📦');
  const [unit, setUnit] = useState('1 pack');
  const [costRupees, setCostRupees] = useState('');
  const [sellRupees, setSellRupees] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [reorderPoint, setReorderPoint] = useState('3');
  const [error, setError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError('');
    window.setTimeout(() => nameRef.current?.focus(), 20);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, initialName, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const sell = Number(sellRupees);
    const cost = costRupees === '' ? Math.round(sell * 0.85 * 100) / 100 : Number(costRupees);
    const qty = Number(stockQty);
    const reorder = Number(reorderPoint);

    if (!trimmedName) {
      setError('Enter a product name.');
      return;
    }
    if (!Number.isFinite(sell) || sell <= 0) {
      setError('Enter a valid selling price greater than ₹0.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError('Enter a valid cost price.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Stock quantity cannot be negative.');
      return;
    }

    const created = await addProduct({
      sku: `CUST-${Math.floor(100 + Math.random() * 899)}`,
      name: trimmedName,
      category,
      emoji,
      unit: unit.trim() || '1 unit',
      costPaise: rupeesToPaise(cost),
      sellingPricePaise: rupeesToPaise(sell),
      stockQty: Math.round(qty),
      reorderPoint: Math.max(0, Math.round(Number.isFinite(reorder) ? reorder : 3)),
      supplierId: suppliers[0]?.id ?? 'sup-kaveri',
      isCustom: true,
    });

    if (created.stockQty > 0) {
      const result = addToCart(created);
      if (!result.ok && result.message) {
        pushToast({ message: result.message, tone: 'warning' });
      }
    }
    onCreated?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-item-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#FFFDF8] border border-[#E5DFD3] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
          <h2 id="custom-item-title" className="text-xl font-bold text-[#0F172A]">
            Add Custom Item to Catalog
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F4EFE4]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1">
              Item Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Fresh Coconut Piece"
              className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Unit / Pack Size
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., 1 piece, 500 g"
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`h-10 w-10 rounded-lg border text-xl flex items-center justify-center ${
                    emoji === em
                      ? 'border-[#0F172A] bg-[#0F172A]/10'
                      : 'border-[#E5DFD3] bg-white hover:bg-[#F4EFE4]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellRupees}
                onChange={(e) => setSellRupees(e.target.value)}
                placeholder="e.g., 45"
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Cost Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costRupees}
                onChange={(e) => setCostRupees(e.target.value)}
                placeholder="Optional (auto 85%)"
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A] tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Opening Stock Qty
              </label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Reorder Alert Point
              </label>
              <input
                type="number"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A] tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-4 py-2 text-base font-medium text-[#0F172A] hover:bg-[#F4EFE4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-[#0F172A] px-5 py-2 text-base font-semibold text-white hover:bg-slate-800"
            >
              Save & Add to Cart
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
