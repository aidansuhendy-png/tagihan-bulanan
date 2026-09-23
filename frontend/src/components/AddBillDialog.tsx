import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { Bill, BillCreate, Product } from "@/lib/types";
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

const MANUAL = "manual";

// Default pintar tanggal jatuh tempo per jenis — mengikuti konvensi umum, tetap bisa diubah.
const DUE_DEFAULTS: Record<string, number> = {
  "pln-pasca": 20,
  indihome: 20,
  "telkom-pstn": 20,
  pdam: 20,
  "bpjs-kesehatan": 10,
  biznet: 1,
};

export default function AddBillDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("pln-pasca");
  const [customerNo, setCustomerNo] = useState("");
  const [dueDay, setDueDay] = useState("20");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products"),
  });

  const labels: Record<string, string> = { [MANUAL]: "Tagihan manual" };
  for (const p of products ?? []) labels[p.buyer_sku_code] = p.product_name;

  const create = useMutation({
    mutationFn: (body: BillCreate) => apiPost<Bill>("/bills", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bills"] });
      void qc.invalidateQueries({ queryKey: ["summary"] });
      toast.success("Tagihan ditambahkan");
      setOpen(false);
      setTitle("");
      setCustomerNo("");
    },
    onError: () => toast.error("Gagal menambah tagihan"),
  });

  const submit = () => {
    if (!title.trim()) return toast.error("Nama tagihan wajib diisi");
    const isPpob = sku !== MANUAL;
    if (isPpob && !customerNo.trim()) return toast.error("Nomor pelanggan wajib diisi");
    create.mutate({
      title: title.trim(),
      subtitle: isPpob ? "" : "Bukan PPOB (Manual)",
      customer_no: isPpob ? customerNo.trim() : "",
      buyer_sku_code: isPpob ? sku : "",
      is_ppob: isPpob,
      due_day: Number(dueDay) || 20,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon" variant="secondary" className="rounded-2xl" data-testid="add-bill-open" aria-label="Tambah tagihan">
            <Plus className="size-5" />
          </Button>
        }
      />
      <DialogContent data-testid="add-bill-dialog">
        <DialogHeader>
          <DialogTitle>Tambah Tagihan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bill-title">Nama tagihan</Label>
            <Input
              id="bill-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Listrik Rumah"
              data-testid="add-bill-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis tagihan</Label>
            <Select
              value={sku}
              onValueChange={(v: string) => {
                setSku(v);
                if (v !== MANUAL) setDueDay(String(DUE_DEFAULTS[v] ?? 20));
              }}
            >
              <SelectTrigger data-testid="add-bill-sku">
                <SelectValue>{(v) => labels[v as string] ?? "Pilih produk"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((p) => (
                  <SelectItem key={p.buyer_sku_code} value={p.buyer_sku_code}>
                    {p.product_name}
                  </SelectItem>
                ))}
                <SelectItem value={MANUAL}>Tagihan manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sku !== MANUAL && (
            <div className="space-y-1.5">
              <Label htmlFor="bill-customer">Nomor pelanggan</Label>
              <Input
                id="bill-customer"
                value={customerNo}
                onChange={(e) => setCustomerNo(e.target.value)}
                placeholder="543101725961"
                data-testid="add-bill-customer"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bill-due">Tanggal jatuh tempo</Label>
            <Input
              id="bill-due"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              data-testid="add-bill-due"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="add-bill-cancel">
            Batal
          </Button>
          <Button onClick={submit} disabled={create.isPending} data-testid="add-bill-submit">
            {create.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
