import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Copy, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { rupiah, type PlnBuyResult, type PlnProduct } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const errMsg = (e: unknown): string => {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return e instanceof Error ? e.message : "Terjadi kesalahan";
};

export default function BuyTokenDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerNo, setCustomerNo] = useState("");
  const [sku, setSku] = useState("");
  const [result, setResult] = useState<PlnBuyResult | null>(null);

  const products = useQuery({
    queryKey: ["pln-products"],
    queryFn: () => apiGet<PlnProduct[]>("/pln/products"),
    enabled: open,
    retry: false,
  });

  const labels: Record<string, string> = {};
  for (const p of products.data ?? []) labels[p.buyer_sku_code] = `${p.product_name} · ${rupiah(p.price)}`;

  const reset = () => {
    setCustomerNo("");
    setSku("");
    setResult(null);
  };

  const buy = useMutation({
    mutationFn: () => apiPost<PlnBuyResult>("/pln/buy", { customer_no: customerNo, buyer_sku_code: sku }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      setResult(r);
      if (r.ok) toast.success("Token berhasil dibeli", { description: r.sn });
      else toast.error(`Gagal beli token (rc ${r.rc})`, { description: r.message });
    },
    onError: (e) => toast.error("Gagal membeli token", { description: errMsg(e) }),
  });

  const submit = () => {
    if (!customerNo.trim()) return toast.error("Nomor meter / ID pelanggan wajib diisi");
    if (!sku) return toast.error("Pilih nominal token dulu");
    buy.mutate();
  };

  const copyToken = () => {
    if (result?.sn) {
      void navigator.clipboard?.writeText(result.sn.replace(/\s+/g, ""));
      toast.success("Token disalin");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            className="w-full rounded-2xl"
            data-testid="buy-token-open"
          >
            <Zap className="size-4 text-amber-500" />
            Beli Token Listrik
          </Button>
        }
      />
      <DialogContent data-testid="buy-token-dialog">
        <DialogHeader>
          <DialogTitle>Beli Token Listrik (PLN Prabayar)</DialogTitle>
        </DialogHeader>

        {result?.ok ? (
          <div className="space-y-4" data-testid="buy-token-result">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm text-slate-500">{result.product_name}</p>
              <p className="text-xs text-slate-400">Meter {result.customer_no}</p>
              <p
                className="mt-1 select-all break-all font-mono text-xl font-bold tracking-wide text-slate-900"
                data-testid="buy-token-sn"
              >
                {result.sn || "-"}
              </p>
              <Button variant="outline" size="sm" onClick={copyToken} data-testid="buy-token-copy">
                <Copy className="size-4" /> Salin token
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset} data-testid="buy-token-again">
                Beli lagi
              </Button>
              <Button onClick={() => setOpen(false)} data-testid="buy-token-done">
                Selesai
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pln-customer">Nomor meter / ID pelanggan</Label>
                <Input
                  id="pln-customer"
                  value={customerNo}
                  onChange={(e) => setCustomerNo(e.target.value)}
                  placeholder="Contoh: 32100xxxxxxx"
                  data-testid="buy-token-customer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nominal token</Label>
                <Select value={sku} onValueChange={(v: string) => setSku(v)}>
                  <SelectTrigger data-testid="buy-token-nominal">
                    <SelectValue placeholder="Pilih nominal">
                      {(v) => labels[v as string] ?? "Pilih nominal"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(products.data ?? []).map((p) => (
                      <SelectItem key={p.buyer_sku_code} value={p.buyer_sku_code}>
                        {p.product_name} · {rupiah(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {products.isLoading && (
                  <p className="text-xs text-slate-400">Memuat daftar nominal…</p>
                )}
                {!products.isLoading && (products.data?.length ?? 0) === 0 && (
                  <p className="text-xs text-amber-500" data-testid="buy-token-empty">
                    Daftar nominal belum tersedia (cek koneksi / limit price-list Digiflazz).
                  </p>
                )}
                {result && !result.ok && (
                  <p className="text-xs text-rose-500" data-testid="buy-token-error">
                    {result.message} (rc {result.rc})
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Pembelian memakai saldo Digiflazz asli. Pastikan nomor meter benar.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="buy-token-cancel">
                Batal
              </Button>
              <Button onClick={submit} disabled={buy.isPending} data-testid="buy-token-submit">
                {buy.isPending ? "Memproses…" : "Beli token"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
