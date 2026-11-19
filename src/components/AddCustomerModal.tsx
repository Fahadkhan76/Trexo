import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useMunimStore } from '../store/useMunimStore';

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const addCustomer = useMunimStore((s) => s.addCustomer);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setVillage('');
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
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter customer name.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setError('Enter a valid phone number.');
      return;
    }
    await addCustomer({ name, phone, village });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-customer-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#FFFDF8] border border-[#E5DFD3] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD3]">
          <h2 id="add-customer-title" className="text-xl font-bold text-[#0F172A]">
            Add Udhaar Customer
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
              Customer Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Basavaraj Naik"
              className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1">
              Mobile Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 98450 12345"
              className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 font-mono text-base text-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1">
              Village / Mohalla
            </label>
            <input
              type="text"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="e.g., Harohalli"
              className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-base text-[#0F172A]"
            />
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
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
