import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { apiPost, apiDelete, ApiError } from "@/lib/api";
import { rupiah, dueReminder, type Bill, type InquiryResult, type PaymentResult } from "@/lib/types";
import { skuStyle } from "@/lib/sku";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const errMsg = (e: unknown): string => {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return e instanceof Error ? e.message : "Terjadi kesalahan";
};

export default function BillRow({ bill }: { bill: Bill }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { Icon, tint, fg, label } = skuStyle(bill.buyer_sku_code);
  const paid = bill.status === "PAID";
  const reminder = paid ? null : dueReminder(bill.days_until_due);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["bills"] });
    void qc.invalidateQueries({ queryKey: ["summary"] });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const check = useMutation({
    mutationFn: () => apiPost<InquiryResult>(`/bills/${bill.id}/check`),
    onSuccess: (r) => {
      invalidate();
      if (r.ok) toast.success(`${bill.title}: ${rupiah(r.amount)}`, { description: r.customer_name || r.message });
      else if (r.rc === "60" || r.bill.status === "PAID")
        toast.success(`${bill.title} sudah lunas bulan ini`, { description: "Ditandai lunas otomatis" });
      else toast.error(`Gagal cek (rc ${r.rc})`, { description: r.message });
    },
    onError: (e) => toast.error("Gagal cek tagihan", { description: errMsg(e) }),
  });

  const pay = useMutation({
    mutationFn: () => apiPost<PaymentResult>(`/bills/${bill.id}/pay`),
    onSuccess: (r) => {
      invalidate();
      setConfirmOpen(false);
      if (r.ok) toast.success(`${bill.title} lunas`, { description: r.sn ? `SN: ${r.sn}` : r.message });
      else toast.error(`Pembayaran ${r.rc === "03" ? "pending" : "gagal"} (rc ${r.rc})`, { description: r.message });
    },
    onError: (e) => toast.error("Gagal membayar", { description: errMsg(e) }),
  });

  const remove = useMutation({
    mutationFn: () => apiDelete<{ deleted: boolean }>(`/bills/${bill.id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Tagihan dihapus");
    },
  });

  return (
    <div
      className="group flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-colors duration-200 hover:bg-slate-50"
      data-testid={`bill-row-${bill.id}`}
    >
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>
        <Icon className={`size-4 ${fg}`} />
      </div>

      <div className="min-w-0 flex-1 pr-1">
        <div className="flex items-center gap-1">
          <p className="font-semibold text-slate-800 text-sm leading-tight" data-testid={`bill-title-${bill.id}`}>
            {bill.title}
          </p>
          {reminder?.urgent && (
            <span
              className={`size-1.5 shrink-0 rounded-full ${reminder.cls.replace("text-", "bg-")}`}
              aria-hidden
            />
          )}
        </div>
        <p className="truncate text-[11px] text-slate-400">
          {bill.is_ppob ? bill.customer_no : bill.subtitle || "Manual"}
        </p>
      </div>

      <div className="shrink-0 text-right pr-2">
        <p
          className={`font-semibold tabular-nums text-xs md:text-sm ${paid ? "text-emerald-500" : "text-slate-800"}`}
          data-testid={`bill-amount-${bill.id}`}
        >
          {rupiah(bill.amount)}
        </p>
        {reminder ? (
          <p className={`text-[11px] font-medium ${reminder.cls}`} data-testid={`bill-due-${bill.id}`}>
            {reminder.text}
          </p>
        ) : (
          <p className="text-[11px] text-slate-400" data-testid={`bill-due-${bill.id}`}>
            jt. tempo tgl {bill.due_day}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {bill.is_ppob && !paid && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-sky-500 hover:text-sky-600"
            disabled={check.isPending}
            onClick={() => check.mutate()}
            data-testid={`bill-check-${bill.id}`}
            aria-label="Cek tagihan"
          >
            {check.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          className={paid ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"}
          disabled={paid || (bill.is_ppob && bill.amount <= 0)}
          onClick={() => setConfirmOpen(true)}
          data-testid={`bill-pay-${bill.id}`}
          aria-label="Bayar tagihan"
        >
          <CheckCircle2 className="size-5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-slate-400 hover:text-rose-500 transition-colors duration-200"
          onClick={() => remove.mutate()}
          data-testid={`bill-delete-${bill.id}`}
          aria-label="Hapus tagihan"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid={`pay-dialog-${bill.id}`}>
          <DialogHeader>
            <DialogTitle>Bayar {bill.title}?</DialogTitle>
            <DialogDescription>
              {bill.is_ppob
                ? `Saldo Digiflazz akan terpotong ${rupiah(bill.amount)} untuk ${bill.customer_name || bill.customer_no}.`
                : "Tagihan manual akan ditandai lunas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} data-testid={`pay-cancel-${bill.id}`}>
              Batal
            </Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending} data-testid={`pay-confirm-${bill.id}`}>
              {pay.isPending ? "Memproses…" : "Ya, bayar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
