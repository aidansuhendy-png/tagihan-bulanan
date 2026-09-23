import { Zap, Wifi, ShieldPlus, Droplets, Phone, Receipt } from "lucide-react";
import type { ComponentType } from "react";

interface SkuStyle {
  Icon: ComponentType<{ className?: string }>;
  tint: string;
  fg: string;
  label: string;
}

const STYLES: Record<string, SkuStyle> = {
  "pln-pasca": { Icon: Zap, tint: "bg-amber-100", fg: "text-amber-500", label: "PLN Pascabayar" },
  indihome: { Icon: Wifi, tint: "bg-rose-100", fg: "text-rose-500", label: "Indihome" },
  "bpjs-kesehatan": { Icon: ShieldPlus, tint: "bg-emerald-100", fg: "text-emerald-500", label: "BPJS Kesehatan" },
  pdam: { Icon: Droplets, tint: "bg-sky-100", fg: "text-sky-500", label: "PDAM" },
  biznet: { Icon: Wifi, tint: "bg-indigo-100", fg: "text-indigo-500", label: "Biznet Home" },
  "telkom-pstn": { Icon: Phone, tint: "bg-violet-100", fg: "text-violet-500", label: "Telkom PSTN" },
};

const FALLBACK: SkuStyle = {
  Icon: Receipt,
  tint: "bg-slate-100",
  fg: "text-slate-500",
  label: "Manual",
};

export const skuStyle = (sku: string): SkuStyle => STYLES[sku] ?? FALLBACK;
