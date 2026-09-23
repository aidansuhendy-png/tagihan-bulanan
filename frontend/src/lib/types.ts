// Hand-mirrored from backend/models/bill.py — keep in sync in the same edit.
export type BillStatus = "UNPAID" | "PAID" | "PENDING";

export interface Bill {
  id: string;
  title: string;
  subtitle: string;
  customer_no: string;
  buyer_sku_code: string;
  is_ppob: boolean;
  due_day: number;
  amount: number;
  admin: number;
  customer_name: string;
  status: BillStatus;
  last_ref_id: string;
  last_message: string;
  last_checked_at: string | null;
  days_until_due: number;
  created_at: string;
}

export interface BillCreate {
  title: string;
  subtitle: string;
  customer_no: string;
  buyer_sku_code: string;
  is_ppob: boolean;
  due_day: number;
}

export interface InquiryResult {
  ok: boolean;
  rc: string;
  message: string;
  customer_name: string;
  amount: number;
  admin: number;
  ref_id: string;
  bill: Bill;
}

export interface PaymentResult {
  ok: boolean;
  rc: string;
  message: string;
  sn: string;
  bill: Bill;
}

export interface Transaction {
  id: string;
  bill_id: string;
  title: string;
  customer_no: string;
  buyer_sku_code: string;
  kind: "inquiry" | "payment" | "topup";
  rc: string;
  status: string;
  message: string;
  sn: string;
  amount: number;
  ref_id: string;
  created_at: string;
}

export interface PlnProduct {
  buyer_sku_code: string;
  product_name: string;
  price: number;
  active: boolean;
}

export interface PlnBuyResult {
  ok: boolean;
  rc: string;
  message: string;
  sn: string;
  customer_no: string;
  price: number;
  product_name: string;
}

export interface Product {
  buyer_sku_code: string;
  product_name: string;
  brand: string;
  admin: number;
  active: boolean;
}

export interface Summary {
  total_amount: number;
  unpaid_count: number;
  paid_count: number;
  bill_count: number;
  month: string;
}

export interface Balance {
  ok: boolean;
  message: string;
  product_count: number;
}

export const rupiah = (n: number): string =>
  "Rp " + Math.round(n || 0).toLocaleString("id-ID");

// Due-date reminder derived from server-computed signed days (0 = today, <0 = overdue).
export interface DueReminder {
  text: string;
  cls: string;
  urgent: boolean;
}

export const dueReminder = (days: number): DueReminder | null => {
  if (days < 0) return { text: `Terlambat ${Math.abs(days)} hari`, cls: "text-rose-500", urgent: true };
  if (days === 0) return { text: "Jatuh tempo hari ini", cls: "text-rose-500", urgent: true };
  if (days <= 3) return { text: `Tempo ${days} hari lagi`, cls: "text-amber-500", urgent: true };
  return null;
};
