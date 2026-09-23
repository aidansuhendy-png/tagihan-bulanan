import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { rupiah, type Balance, type Bill, type InquiryResult, type Summary } from "@/lib/types";
import AddBillDialog from "@/components/AddBillDialog";
import BuyTokenDialog from "@/components/BuyTokenDialog";
import BillRow from "@/components/BillRow";
import { Button } from "@/components/ui/button";

export default function Home() {
  const qc = useQueryClient();

  const bills = useQuery({ queryKey: ["bills"], queryFn: () => apiGet<Bill[]>("/bills") });
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => apiGet<Summary>("/summary") });
  const health = useQuery({
    queryKey: ["digiflazz-health"],
    queryFn: () => apiGet<Balance>("/digiflazz/health"),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const checkAll = useMutation({
    mutationFn: async () => {
      const list = (bills.data ?? []).filter((b) => b.is_ppob && b.status !== "PAID");
      let ok = 0;
      for (const b of list) {
        try {
          const r = await apiPost<InquiryResult>(`/bills/${b.id}/check`);
          if (r.ok || r.rc === "60") ok += 1;
        } catch {
          /* keep going; per-bill failures are reported in the summary toast */
        }
      }
      return { ok, total: list.length };
    },
    onSuccess: ({ ok, total }) => {
      void qc.invalidateQueries({ queryKey: ["bills"] });
      void qc.invalidateQueries({ queryKey: ["summary"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      toast[ok === total && total > 0 ? "success" : "warning"](`Cek selesai: ${ok}/${total} berhasil`);
    },
  });

  const list = bills.data ?? [];
  const offline = bills.isError;

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <section className="rounded-3xl bg-white p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Tagihan Rutin</h1>
              <p className="mt-1 max-w-[16rem] text-sm text-slate-400">
                Cek dan bayar listrik, wifi, PDAM & BPJS lewat Digiflazz.
              </p>
            </div>
            <AddBillDialog />
          </div>

          <div
            className="mt-6 flex items-center gap-4 rounded-3xl bg-slate-50 p-5"
            data-testid="summary-card"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total tagihan belum lunas
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900" data-testid="summary-total">
                {rupiah(summary.data?.total_amount ?? 0)}
              </p>
              <p className="text-xs text-slate-400" data-testid="summary-count">
                {summary.data ? `${summary.data.unpaid_count} belum lunas · ${summary.data.paid_count} lunas` : "—"}
              </p>
            </div>
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-100">
              <CalendarDays className="size-6 text-sky-500" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              className="flex-1 rounded-2xl"
              onClick={() => checkAll.mutate()}
              disabled={checkAll.isPending || list.length === 0}
              data-testid="check-all-button"
            >
              {checkAll.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Cek semua tagihan
            </Button>
            <Link
              to="/riwayat"
              className="flex items-center gap-1 rounded-2xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
              data-testid="history-link"
            >
              Riwayat <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mt-2">
            <BuyTokenDialog />
          </div>

          <p
            className={`mt-3 text-xs ${health.data?.ok ? "text-emerald-500" : "text-amber-500"}`}
            data-testid="digiflazz-status"
          >
            {health.isLoading
              ? "Memeriksa koneksi Digiflazz…"
              : health.data
                ? health.data.ok
                  ? health.data.product_count > 0
                    ? `Digiflazz terhubung · ${health.data.product_count} produk pascabayar`
                    : "Digiflazz terhubung"
                  : `Digiflazz: ${health.data.message}`
                : "Status Digiflazz tidak tersedia"}
          </p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          <h2 className="px-3 pb-2 pt-1 text-lg font-semibold text-slate-800">Daftar Tagihan</h2>
          {offline && (
            <p className="px-3 py-6 text-center text-sm text-slate-400" data-testid="bills-offline">
              Data tagihan tidak bisa dimuat saat ini.
            </p>
          )}
          {!offline && list.length === 0 && !bills.isLoading && (
            <p className="px-3 py-6 text-center text-sm text-slate-400" data-testid="bills-empty">
              Belum ada tagihan. Tambahkan dengan tombol +.
            </p>
          )}
          <div className="divide-y divide-slate-100" data-testid="bills-list">
            {!offline && list.map((b) => <BillRow key={b.id} bill={b} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
