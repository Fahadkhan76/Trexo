import { useEffect, useState } from 'react';

const RECOMMENDATIONS_URL = 'http://127.0.0.1:5000/api/restock/recommendations';
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

interface Recommendation {
  sku: string;
  brand: string;
  category: string;
  region: string;
  sales_channel: string;
  pack_type: string;
  as_of_date: string;
  current_stock: number;
  average_daily_sales: number;
  supplier_lead_time_days: number;
  suggested_reorder_quantity: number;
  status: string;
}

type RecommendationsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; rows: Recommendation[] };

export function RestockRecommendations() {
  const [state, setState] = useState<RecommendationsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      try {
        const response = await fetch(RECOMMENDATIONS_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`Restock API returned HTTP ${response.status}`);
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error('Restock API response must be an array');
        if (!controller.signal.aborted) setState({ status: 'loaded', rows });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' });
      }
    }

    void loadRecommendations();
    return () => controller.abort();
  }, []);

  return (
    <section className="khata-surface rounded-xl p-4 space-y-3" aria-labelledby="api-restock-heading">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 id="api-restock-heading" className="text-lg font-bold text-[#0F172A]">
            Restock API Recommendations
            {state.status === 'loaded' && ` (${numberFormat.format(state.rows.length)})`}
          </h3>
          <span className="rounded-md border border-[#D6CFC0] bg-[#F4EFE4] px-2.5 py-0.5 text-xs font-semibold text-[#475569]">
            Demo data
          </span>
        </div>
        <p className="text-sm text-[#475569]">Reorder estimates based on recorded sales and supplier lead times.</p>
      </div>

      {state.status === 'loading' && (
        <p role="status" className="rounded-xl border border-dashed border-[#D6CFC0] p-6 text-center text-sm text-[#475569]">
          Loading restock recommendations…
        </p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-950">
          <p className="font-semibold">Could not load restock recommendations.</p>
          <p>Start Flask by running <code>python app.py</code> from the <code>backend</code> folder, then reload this page.</p>
        </div>
      )}

      {state.status === 'loaded' && (state.rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-[#D6CFC0] p-6 text-center text-sm text-[#475569]">
          No restock recommendations found.
        </p>
      ) : (
        <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-labelledby="api-restock-heading">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 bg-[#FAF7F0] text-[#475569]">
              <tr>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 font-semibold">SKU / Product</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">Current Stock</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">Avg. Daily Sales</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">Supplier Lead Time (Days)</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">Suggested Reorder Qty</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-[#0F172A] [&_td]:border-b [&_td]:border-[#E5DFD3] [&_td]:px-2 [&_td]:py-2.5">
              {state.rows.map((row) => (
                <tr
                  key={JSON.stringify([row.sku, row.region, row.sales_channel, row.pack_type])}
                  className="hover:bg-[#FAF7F0]/75"
                >
                  <td>
                    <div className="font-semibold">{row.sku} · {row.brand}</div>
                    <div className="text-xs text-[#475569]">
                      {row.category} · {row.region} · {row.sales_channel} · {row.pack_type}
                    </div>
                    <div className="text-xs text-[#475569]">As of {row.as_of_date}</div>
                  </td>
                  <td className="text-right font-mono tabular-nums">{numberFormat.format(row.current_stock)}</td>
                  <td className="text-right font-mono tabular-nums">{numberFormat.format(row.average_daily_sales)}</td>
                  <td className="text-right font-mono tabular-nums">{numberFormat.format(row.supplier_lead_time_days)}</td>
                  <td className="text-right font-mono font-bold tabular-nums text-emerald-800">
                    {numberFormat.format(row.suggested_reorder_quantity)}
                  </td>
                  <td>
                    <span className="inline-block rounded-md border border-[#D6CFC0] bg-[#FAF7F0] px-2 py-0.5 text-xs font-semibold text-[#475569]">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
