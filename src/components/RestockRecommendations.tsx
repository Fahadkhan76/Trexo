import { useEffect, useState } from 'react';
import { getDictionary } from '../i18n';
import { useMunimStore } from '../store/useMunimStore';
import type { LedgerState } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000';
const RECOMMENDATIONS_URL = `${API_BASE_URL}/api/restock/recommendations`;
const PAGE_SIZE = 100;
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
  | { status: 'error'; message: string }
  | { status: 'loaded'; rows: Recommendation[]; total: number };

type LoadMoreState = 'idle' | 'loading' | 'error';

interface RecommendationPage {
  rows: Recommendation[];
  total: number;
}

async function fetchRecommendationPage(
  offset: number,
  signal: AbortSignal,
  ledger: LedgerState
): Promise<RecommendationPage> {
  const url = `${RECOMMENDATIONS_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: ledger.products, sales: ledger.sales, suppliers: ledger.suppliers }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Restock API returned HTTP ${response.status} ${response.statusText}`.trim());
  }
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Restock API response must be an array');
  const headerTotal = Number.parseInt(response.headers.get('X-Total-Count') ?? '', 10);
  return {
    rows,
    total: Number.isFinite(headerTotal) ? headerTotal : offset + rows.length,
  };
}

export function RestockRecommendations() {
  const language = useMunimStore((s) => s.language);
  const ledger = useMunimStore((s) => s.ledger);
  const dict = getDictionary(language);
  const [state, setState] = useState<RecommendationsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>('idle');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    async function loadRecommendations() {
      setState({ status: 'loading' });
      setLoadMoreState('idle');
      try {
        const page = await fetchRecommendationPage(0, controller.signal, ledger);
        if (!cancelled) {
          setState({ status: 'loaded', rows: page.rows, total: page.total });
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: timedOut
            ? 'Request timed out after 8 seconds.'
            : error instanceof Error
              ? error.message
              : 'Unknown network error.',
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, ledger]);

  async function loadMoreRows() {
    if (state.status !== 'loaded' || loadMoreState === 'loading') return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setLoadMoreState('loading');
    try {
      const page = await fetchRecommendationPage(state.rows.length, controller.signal, ledger);
      setState((current) =>
        current.status === 'loaded'
          ? { status: 'loaded', rows: [...current.rows, ...page.rows], total: page.total }
          : current
      );
      setLastUpdated(new Date());
      setLoadMoreState('idle');
    } catch {
      setLoadMoreState('error');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <section className="khata-surface rounded-xl p-4 space-y-3" aria-labelledby="api-restock-heading">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 id="api-restock-heading" className="text-lg font-bold text-[#0F172A]">
            {dict.restockApiTitle}
            {state.status === 'loaded' && ` (${numberFormat.format(state.total)})`}
          </h3>
          <span className="rounded-md border border-[#D6CFC0] bg-[#F4EFE4] px-2.5 py-0.5 text-xs font-semibold text-[#475569]">
            {dict.demoDataBadge}
          </span>
          {lastUpdated && (
            <span className="text-xs text-[#475569]">
              {dict.restockLastUpdated}: {lastUpdated.toLocaleTimeString('en-IN')}
            </span>
          )}
        </div>
        <p className="text-sm text-[#475569]">{dict.restockApiSubtitle}</p>
      </div>

      {state.status === 'loading' && (
        <div role="status" aria-label={dict.restockLoading} className="space-y-2">
          <div className="h-4 w-56 animate-pulse rounded bg-[#E5DFD3]" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F4EFE4]" />
          ))}
          <span className="sr-only">{dict.restockLoading}</span>
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-950">
          <p className="font-semibold">{dict.restockErrorTitle}</p>
          <p className="mt-1 font-mono text-xs">{state.message}</p>
          <p className="mt-1">{dict.restockErrorHint}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 min-h-[40px] rounded-lg bg-[#0F172A] px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {dict.restockRetry}
          </button>
        </div>
      )}

      {state.status === 'loaded' && (state.rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-[#D6CFC0] p-6 text-center text-sm text-[#475569]">
          {dict.restockEmpty}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#475569]">
            {dict.restockShowing
              .replace('{shown}', numberFormat.format(state.rows.length))
              .replace('{total}', numberFormat.format(state.total))}
          </p>
          <div className="max-h-96 overflow-auto" tabIndex={0} role="region" aria-labelledby="api-restock-heading">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 bg-[#FAF7F0] text-[#475569]">
              <tr>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 font-semibold">{dict.restockSkuProduct}</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">{dict.restockCurrentStock}</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">{dict.restockAvgDailySales}</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">{dict.restockLeadTime}</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 text-right font-semibold">{dict.restockSuggestedQty}</th>
                <th scope="col" className="border-b border-[#E5DFD3] px-2 py-2.5 font-semibold">{dict.restockStatus}</th>
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
                    <div className="text-xs text-[#475569]">{dict.restockAsOf} {row.as_of_date}</div>
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
          {state.rows.length < state.total && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadMoreRows()}
                disabled={loadMoreState === 'loading'}
                className="min-h-[40px] rounded-lg border border-[#D6CFC0] bg-[#FAF7F0] px-4 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] disabled:cursor-wait disabled:opacity-60"
              >
                {loadMoreState === 'loading' ? dict.restockLoadingMore : dict.restockLoadMore}
              </button>
              {loadMoreState === 'error' && (
                <span role="alert" className="text-xs font-medium text-red-800">
                  {dict.restockLoadMoreError}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
