"""Saved bills + Digiflazz pascabayar inquiry/payment. All routes mount under /api."""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pymongo import DESCENDING

from lib.db import db
from lib.dates import days_until_due
from lib.digiflazz import RC_MESSAGES, pasca, prepaid, price_list_pasca, price_list_prepaid
from models.bill import (
    Balance,
    Bill,
    BillCreate,
    BillUpdate,
    InquiryResult,
    PaymentResult,
    PlnBuyRequest,
    PlnBuyResult,
    PlnProduct,
    Product,
    Summary,
    Transaction,
)

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG: list[Product] = [
    Product(buyer_sku_code="pln-pasca", product_name="PLN Pascabayar", brand="PLN", admin=4000),
    Product(buyer_sku_code="indihome", product_name="Speedy & Indihome", brand="INDIHOME", admin=2500),
    Product(buyer_sku_code="bpjs-kesehatan", product_name="BPJS Kesehatan", brand="BPJS", admin=2500),
    Product(buyer_sku_code="pdam", product_name="PDAM PAM Jaya", brand="PDAM", admin=3500),
    Product(buyer_sku_code="biznet", product_name="Biznet Home", brand="BIZNET", admin=3000),
    Product(buyer_sku_code="telkom-pstn", product_name="Telkom PSTN", brand="TELKOM", admin=2500),
]

# Last-resort nominal list for when Digiflazz price-list is rate-limited and no cache exists.
# SKU codes are this account's PLN token products; prices are indicative (Digiflazz charges the
# live price at purchase time regardless).
PLN_FALLBACK: list[PlnProduct] = [
    PlnProduct(buyer_sku_code="pre34294815", product_name="PLN 5.000", price=6105),
    PlnProduct(buyer_sku_code="pre34294816", product_name="PLN 10.000", price=11105),
    PlnProduct(buyer_sku_code="pre34294817", product_name="PLN 15.000", price=16110),
    PlnProduct(buyer_sku_code="pln20", product_name="PLN 20.000", price=19610),
    PlnProduct(buyer_sku_code="pln50", product_name="PLN 50.000", price=51030),
    PlnProduct(buyer_sku_code="pln100", product_name="PLN 100.000", price=101075),
    PlnProduct(buyer_sku_code="pre34294813", product_name="PLN 500.000", price=499500),
    PlnProduct(buyer_sku_code="pln1000", product_name="PLN 1.000.000", price=1002000),
]


def _bill(doc: dict[str, Any]) -> Bill:
    bill = Bill(**{k: v for k, v in doc.items() if k != "_id"})
    bill.days_until_due = days_until_due(bill.due_day)
    return bill


async def _get_doc(bill_id: str) -> dict[str, Any]:
    doc = await db.bills.find_one({"id": bill_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tagihan tidak ditemukan")
    return doc


async def _log_tx(**kw: Any) -> None:
    await db.transactions.insert_one(Transaction(**kw).model_dump())


def _rc_message(data: dict[str, Any]) -> str:
    rc = str(data.get("rc", ""))
    return str(data.get("message") or RC_MESSAGES.get(rc, "Tidak diketahui"))


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


@router.get("/products", response_model=list[Product])
async def products() -> list[Product]:
    return CATALOG


@router.get("/bills", response_model=list[Bill])
async def list_bills() -> list[Bill]:
    docs = await db.bills.find().to_list(500)
    bills = [_bill(d) for d in docs]
    # Paling mendesak di atas: belum lunas dulu, urut dari yang paling lewat jatuh tempo
    # (days_until_due terkecil), lalu tagihan lunas selalu di bawah.
    bills.sort(key=lambda b: (b.status == "PAID", b.days_until_due, b.title))
    return bills


@router.post("/bills", response_model=Bill)
async def create_bill(payload: BillCreate) -> Bill:
    bill = Bill(**payload.model_dump())
    await db.bills.insert_one(bill.model_dump())
    return bill


@router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str) -> Bill:
    return _bill(await _get_doc(bill_id))


@router.patch("/bills/{bill_id}", response_model=Bill)
async def update_bill(bill_id: str, payload: BillUpdate) -> Bill:
    await _get_doc(bill_id)
    changes = {k: v for k, v in payload.model_dump().items() if v is not None}
    if changes:
        await db.bills.update_one({"id": bill_id}, {"$set": changes})
    return _bill(await _get_doc(bill_id))


@router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str) -> dict[str, bool]:
    await _get_doc(bill_id)
    await db.bills.delete_one({"id": bill_id})
    return {"deleted": True}


@router.post("/bills/{bill_id}/check", response_model=InquiryResult)
async def check_bill(bill_id: str) -> InquiryResult:
    doc = await _get_doc(bill_id)
    bill = _bill(doc)
    if not bill.is_ppob:
        raise HTTPException(status_code=400, detail="Tagihan manual tidak bisa dicek otomatis")
    if not bill.customer_no or not bill.buyer_sku_code:
        raise HTTPException(status_code=400, detail="Nomor pelanggan / produk belum diisi")

    ref_id = f"INQ{uuid.uuid4().hex[:16]}"
    try:
        data = await pasca("inq-pasca", bill.buyer_sku_code, bill.customer_no, ref_id)
    except Exception as exc:  # network / provider outage
        logger.exception("inq-pasca failed")
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi Digiflazz: {exc}") from exc

    rc = str(data.get("rc", ""))
    ok = rc == "00"
    already_paid = rc == "60"
    message = "Tagihan sudah lunas bulan ini" if already_paid else _rc_message(data)
    amount = _num(data.get("selling_price")) or _num(data.get("price"))
    admin = _num(data.get("admin"))

    changes: dict[str, Any] = {
        "last_message": message,
        "last_checked_at": datetime.now(timezone.utc),
    }
    if ok:
        changes.update(
            {
                "amount": amount,
                "admin": admin,
                "customer_name": str(data.get("customer_name") or ""),
                "last_ref_id": ref_id,
                "status": "UNPAID",
            }
        )
    elif already_paid:
        # rc 60: tidak ada tagihan karena sudah dibayar bulan ini — tandai lunas.
        changes.update({"amount": 0, "status": "PAID"})
    await db.bills.update_one({"id": bill_id}, {"$set": changes})

    await _log_tx(
        bill_id=bill_id,
        title=bill.title,
        customer_no=bill.customer_no,
        buyer_sku_code=bill.buyer_sku_code,
        kind="inquiry",
        rc=rc,
        status=str(data.get("status") or ""),
        message=message,
        amount=amount,
        ref_id=ref_id,
    )

    return InquiryResult(
        ok=ok,
        rc=rc,
        message=message,
        customer_name=str(data.get("customer_name") or ""),
        amount=amount,
        admin=admin,
        ref_id=ref_id,
        bill=_bill(await _get_doc(bill_id)),
    )


@router.post("/bills/{bill_id}/pay", response_model=PaymentResult)
async def pay_bill(bill_id: str) -> PaymentResult:
    doc = await _get_doc(bill_id)
    bill = _bill(doc)
    if not bill.is_ppob:
        # Manual bill: just mark it paid.
        await db.bills.update_one({"id": bill_id}, {"$set": {"status": "PAID"}})
        await _log_tx(bill_id=bill_id, title=bill.title, kind="payment", rc="00",
                      status="Sukses", message="Ditandai lunas (manual)", amount=bill.amount)
        return PaymentResult(ok=True, rc="00", message="Ditandai lunas",
                             bill=_bill(await _get_doc(bill_id)))

    if bill.status == "PAID":
        raise HTTPException(status_code=400, detail="Tagihan ini sudah lunas")
    if not bill.last_ref_id:
        raise HTTPException(status_code=400, detail="Cek tagihan dulu sebelum membayar")

    try:
        data = await pasca("pay-pasca", bill.buyer_sku_code, bill.customer_no, bill.last_ref_id)
    except Exception as exc:
        logger.exception("pay-pasca failed")
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi Digiflazz: {exc}") from exc

    rc = str(data.get("rc", ""))
    message = _rc_message(data)
    sn = str(data.get("sn") or "")
    ok = rc == "00"
    status = "PAID" if ok else ("PENDING" if rc in {"01", "03"} else "UNPAID")

    await db.bills.update_one(
        {"id": bill_id}, {"$set": {"status": status, "last_message": message}}
    )
    await _log_tx(
        bill_id=bill_id,
        title=bill.title,
        customer_no=bill.customer_no,
        buyer_sku_code=bill.buyer_sku_code,
        kind="payment",
        rc=rc,
        status=str(data.get("status") or ""),
        message=message,
        sn=sn,
        amount=_num(data.get("selling_price")) or bill.amount,
        ref_id=bill.last_ref_id,
    )
    return PaymentResult(ok=ok, rc=rc, message=message, sn=sn,
                         bill=_bill(await _get_doc(bill_id)))


@router.get("/transactions", response_model=list[Transaction])
async def list_transactions(limit: int = 100) -> list[Transaction]:
    docs = await db.transactions.find().sort("created_at", DESCENDING).to_list(limit)
    return [Transaction(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@router.get("/summary", response_model=Summary)
async def summary() -> Summary:
    docs = await db.bills.find().to_list(500)
    bills = [_bill(d) for d in docs]
    unpaid = [b for b in bills if b.status != "PAID"]
    return Summary(
        total_amount=sum(b.amount for b in unpaid),
        unpaid_count=len(unpaid),
        paid_count=len(bills) - len(unpaid),
        bill_count=len(bills),
        month=datetime.now(timezone.utc).strftime("%Y-%m"),
    )


@router.get("/digiflazz/health", response_model=Balance)
async def digiflazz_health() -> Balance:
    # Cache 10 menit: probe price-list terlalu sering memicu rate-limit Digiflazz.
    cache = await db.meta.find_one({"_id": "health"})
    if cache and (time.time() - float(cache.get("ts", 0))) < 600:
        return Balance(**cache["val"])

    try:
        items: list[dict[str, Any]] = await price_list_pasca()
        val = Balance(ok=True, message="Terhubung ke Digiflazz", product_count=len(items))
    except Exception as exc:
        msg = str(exc).lower()
        if "limit" in msg or "pricelist" in msg or "limitasi" in msg:
            # Kena rate-limit price-list => auth & whitelist IP sudah benar, jadi tetap terhubung.
            val = Balance(
                ok=True,
                message="Terhubung ke Digiflazz",
                product_count=int(cache["val"].get("product_count", 0)) if cache else 0,
            )
        else:
            val = Balance(ok=False, message=f"Tidak terhubung: {exc}")
    else:
        if not items:
            val = Balance(ok=False, message="Digiflazz menolak permintaan (cek whitelist IP / key)")

    if val.ok:
        await db.meta.replace_one(
            {"_id": "health"}, {"_id": "health", "ts": time.time(), "val": val.model_dump()}, upsert=True
        )
    return val


@router.get("/pln/products", response_model=list[PlnProduct])
async def pln_products() -> list[PlnProduct]:
    """Nominal token PLN dari price-list prabayar akun ini (di-cache 1 jam)."""
    cache = await db.pln_products.find_one({"_id": "pln"})
    if cache and (time.time() - float(cache.get("ts", 0))) < 3600:
        return [PlnProduct(**p) for p in cache["items"]]

    try:
        raw = await price_list_prepaid()
    except Exception:
        if cache:
            return [PlnProduct(**p) for p in cache["items"]]
        return PLN_FALLBACK

    pln = [p for p in raw if str(p.get("brand", "")).upper() == "PLN"]
    tokens = [p for p in pln if "token" in str(p.get("category", "")).lower()]
    chosen = tokens or pln
    products = [
        PlnProduct(
            buyer_sku_code=str(p.get("buyer_sku_code", "")),
            product_name=str(p.get("product_name", "")),
            price=_num(p.get("price")),
            active=bool(p.get("buyer_product_status")) and bool(p.get("seller_product_status")),
        )
        for p in chosen
        if p.get("buyer_sku_code") and "cek nama" not in str(p.get("product_name", "")).lower()
    ]
    products = [p for p in products if p.active]
    products.sort(key=lambda p: p.price)
    if not products:
        return [PlnProduct(**p) for p in cache["items"]] if cache else PLN_FALLBACK
    await db.pln_products.replace_one(
        {"_id": "pln"},
        {"_id": "pln", "ts": time.time(), "items": [p.model_dump() for p in products]},
        upsert=True,
    )
    return products


@router.post("/pln/buy", response_model=PlnBuyResult)
async def pln_buy(req: PlnBuyRequest) -> PlnBuyResult:
    if not req.customer_no.strip() or not req.buyer_sku_code.strip():
        raise HTTPException(status_code=400, detail="Nomor meter dan nominal wajib diisi")

    ref_id = f"PLN{uuid.uuid4().hex[:16]}"
    try:
        data = await prepaid(req.buyer_sku_code, req.customer_no.strip(), ref_id)
    except Exception as exc:
        logger.exception("prepaid pln failed")
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi Digiflazz: {exc}") from exc

    rc = str(data.get("rc", ""))
    ok = rc == "00"
    message = str(data.get("message") or RC_MESSAGES.get(rc, "Tidak diketahui"))
    sn = str(data.get("sn") or "")
    price = _num(data.get("price")) or _num(data.get("selling_price"))
    pname = str(data.get("product_name") or req.buyer_sku_code)

    await _log_tx(
        title=f"Token PLN — {pname}",
        customer_no=req.customer_no.strip(),
        buyer_sku_code=req.buyer_sku_code,
        kind="topup",
        rc=rc,
        status=str(data.get("status") or ""),
        message=message,
        sn=sn,
        amount=price,
        ref_id=ref_id,
    )
    return PlnBuyResult(
        ok=ok, rc=rc, message=message, sn=sn,
        customer_no=req.customer_no.strip(), price=price, product_name=pname,
    )
