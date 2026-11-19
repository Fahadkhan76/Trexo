import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useMunimStore } from '../store/useMunimStore';
import type { Product, ProductCategory } from '../types';
import { paiseToRupees, rupeesToPaise } from '../utils/money';

interface ProductFormModalProps {
  open: boolean;
  editingProduct: Product | null;
  onClose: () => void;
}

const CATEGORIES: ProductCategory[] = [
  'Staples & Grains',
  'Oils & Ghee',
  'Snacks & Biscuits',
  'Beverages & Dairy',
  'Personal & Home Care',
  'Spices & Masalas',
];

const EMOJI_CHOICES = ['📦', '🍚', '🌻', '🍪', '🥛', '🧼', '🌶️', '🍵', '🫘', '🧈', '🧀', '🧴'];

export function ProductFormModal({ open, editingProduct, onClose }: ProductFormModalProps) {
  const suppliers = useMunimStore((s) => s.ledger.suppliers);
  const addProduct = useMunimStore((s) => s.addProduct);
  const updateProduct = useMunimStore((s) => s.updateProduct);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Staples & Grains');
  const [emoji, setEmoji] = useState('📦');
  const [unit, setUnit] = useState('1 kg pack');
  const [costRupees, setCostRupees] = useState('');
  const [sellRupees, setSellRupees] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [reorderPoint, setReorderPoint] = useState('5');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? 'sup-kaveri');
  const [expiryDate, setExpiryDate] = useState('');
  const [fastMover, setFastMover] = useState(false);
  const [error, setError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editingProduct) {
      setName(editingProduct.name);
      setSku(editingProduct.sku);
      setCategory(editingProduct.category);
      setEmoji(editingProduct.emoji);
      setUnit(editingProduct.unit);
      setCostRupees(String(paiseToRupees(editingProduct.costPaise)));
      setSellRupees(String(paiseToRupees(editingProduct.sellingPricePaise)));
      setStockQty(String(editingProduct.stockQty));
      setReorderPoint(String(editingProduct.reorderPoint));
      setSupplierId(editingProduct.supplierId);
      setExpiryDate(editingProduct.expiryDate ? editingProduct.expiryDate.slice(0, 10) : '');
      setFastMover(Boolean(editingProduct.fastMover));
    } else {
      setName('');
      setSku(`SKU-${Math.floor(500 + Math.random() * 499)}`);
      setCategory('Staples & Grains');
      setEmoji('📦');
      setUnit('1 kg pack');
      setCostRupees('');
      setSellRupees('');
      setStockQty('15');
      setReorderPoint('5');
      setSupplierId(suppliers[0]?.id ?? 'sup-kaveri');
      setExpiryDate('');
      setFastMover(false);
    }
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
  }, [open, editingProduct, suppliers, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const cost = Number(costRupees);
    const sell = Number(sellRupees);
    const qty = Number(stockQty);
    const reorder = Number(reorderPoint);

    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError('Cost price must be ₹0 or higher.');
      return;
    }
    if (!Number.isFinite(sell) || sell <= 0) {
      setError('Selling price must be greater than ₹0.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Stock quantity cannot be negative.');
      return;
    }
    if (!Number.isFinite(reorder) || reorder < 0) {
      setError('Reorder point cannot be negative.');
      return;
    }

    const expiryISO = expiryDate ? new Date(`${expiryDate}T12:00:00Z`).toISOString() : undefined;

    if (editingProduct) {
      await updateProduct(editingProduct.id, {
        name: trimmedName,
        sku: sku.trim() || editingProduct.sku,
        category,
        emoji,
        unit: unit.trim() || '1 unit',
        costPaise: rupeesToPaise(cost),
        sellingPricePaise: rupeesToPaise(sell),
        stockQty: Math.round(qty),
        reorderPoint: Math.round(reorder),
        supplierId,
        expiryDate: expiryISO,
        fastMover,
      });
    } else {
      await addProduct({
        name: trimmedName,
        sku: sku.trim() || `SKU-${Math.floor(500 + Math.random() * 499)}`,
        category,
        emoji,
        unit: unit.trim() || '1 unit',
        costPaise: rupeesToPaise(cost),
        sellingPricePaise: rupeesToPaise(sell),
        stockQty: Math.round(qty),
        reorderPoint: Math.round(reorder),
        supplierId,
        expiryDate: expiryISO,
        fastMover,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[#FFFDF8] border border-[#E5DFD3] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
          <h2 id="product-modal-title" className="text-xl font-bold text-[#0F172A]">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Product Name *
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                SKU Code
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
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

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Cost (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costRupees}
                onChange={(e) => setCostRupees(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Selling (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellRupees}
                onChange={(e) => setSellRupees(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Stock Qty *
              </label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base tabular-nums"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Reorder At
              </label>
              <input
                type="number"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              >
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Expiry Date (optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-base font-medium text-[#0F172A]">
            <input
              type="checkbox"
              checked={fastMover}
              onChange={(e) => setFastMover(e.target.checked)}
              className="h-5 w-5 rounded border-[#D6CFC0]"
            />
            <span>Mark as fast-moving daily staple</span>
          </label>

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
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
