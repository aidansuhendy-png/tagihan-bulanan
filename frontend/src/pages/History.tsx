import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { rupiah, type Transaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
                <div key={t.id} className="flex flex-col gap-2 px-3 py-3.5" data-testid={`history-item-${t.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-800">{t.title}</p>
                        <Badge variant={t.kind === "payment" ? "default" : t.kind === "topup" ? "outline" : "secondary"}>
                          {t.kind === "payment" ? "Bayar" : t.kind === "topup" ? "Token" : "Cek"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-slate-400">{fmt(t.created_at)} · rc {t.rc}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.message}</p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-slate-700">{rupiah(t.amount)}</p>
                  </div>

                  {t.sn && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 border border-emerald-100 mt-1">
                      <span className="font-mono text-xs font-bold text-emerald-800 select-all truncate">
                        SN: {t.sn}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 ml-auto shrink-0"
                        onClick={() => {
                          void navigator.clipboard?.writeText(t.sn!.replace(/\s+/g, ""));
                          toast.success("Nomor token berhasil disalin");
                        }}
                        aria-label="Salin token"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
