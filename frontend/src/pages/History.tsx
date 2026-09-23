import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { apiGet } from "@/lib/api";
import { rupiah, type Transaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const fmt = (iso: string): string =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function History() {
  const tx = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiGet<Transaction[]>("/transactions"),
  });

  const list = tx.data ?? [];

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors duration-200 hover:text-slate-900"
            data-testid="back-link"
          >
            <ChevronLeft className="size-4" /> Kembali
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Riwayat</h1>
        </div>

        <section className="rounded-3xl bg-white p-4 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)]">
          {tx.isError && (
            <p className="px-3 py-6 text-center text-sm text-slate-400" data-testid="history-offline">
              Riwayat tidak bisa dimuat saat ini.
            </p>
          )}
          {!tx.isError && list.length === 0 && !tx.isLoading && (
            <p className="px-3 py-6 text-center text-sm text-slate-400" data-testid="history-empty">
              Belum ada transaksi.
            </p>
          )}
          <div className="divide-y divide-slate-100" data-testid="history-list">
            {!tx.isError &&
              list.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-3 py-3" data-testid={`history-item-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-800">{t.title}</p>
                      <Badge variant={t.kind === "payment" ? "default" : t.kind === "topup" ? "outline" : "secondary"}>
                        {t.kind === "payment" ? "Bayar" : t.kind === "topup" ? "Token" : "Cek"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-400">{fmt(t.created_at)} · rc {t.rc}</p>
                    <p className="truncate text-xs text-slate-500">{t.message}</p>
                    {t.sn && <p className="truncate text-xs text-emerald-500">SN: {t.sn}</p>}
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-slate-700">{rupiah(t.amount)}</p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
