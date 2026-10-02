"""Pydantic models for saved bills and PPOB transactions. Mirrored in frontend/src/lib/types.ts."""

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field


def _now() -> str:
    zone = os.environ.get("APP_TZ", "Asia/Jakarta")
    return datetime.now(ZoneInfo(zone)).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


BillStatus = Literal["UNPAID", "PAID", "PENDING"]


class BillBase(BaseModel):
    title: str
    subtitle: str = ""
    customer_no: str = ""
    buyer_sku_code: str = ""
    is_ppob: bool = True
    due_day: int = 20


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    customer_no: Optional[str] = None
    buyer_sku_code: Optional[str] = None
    is_ppob: Optional[bool] = None
    due_day: Optional[int] = None
    amount: Optional[float] = None
    status: Optional[BillStatus] = None
    paid_month: Optional[str] = None


class Bill(BillBase):
    id: str = Field(default_factory=_uid)
    amount: float = 0
    admin: float = 0
    customer_name: str = ""
    status: BillStatus = "UNPAID"
    paid_month: str = ""
    last_ref_id: str = ""
    last_message: str = ""
    last_checked_at: Optional[str] = None
    days_until_due: int = 0
    created_at: str = Field(default_factory=_now)


class InquiryResult(BaseModel):
    ok: bool
    rc: str
    message: str
    customer_name: str = ""
    amount: float = 0
    admin: float = 0
    ref_id: str = ""
    bill: Bill


class PaymentResult(BaseModel):
    ok: bool
    rc: str
    message: str
    sn: str = ""
    bill: Bill


class Transaction(BaseModel):
    id: str = Field(default_factory=_uid)
    bill_id: str = ""
    title: str
    customer_no: str = ""
    buyer_sku_code: str = ""
    kind: Literal["inquiry", "payment", "topup"]
    rc: str = ""
    status: str = ""
    message: str = ""
    sn: str = ""
    amount: float = 0
    ref_id: str = ""
    created_at: str = Field(default_factory=_now)


class PlnProduct(BaseModel):
    buyer_sku_code: str
    product_name: str
    price: float = 0
    active: bool = True


class PlnBuyRequest(BaseModel):
    customer_no: str
    buyer_sku_code: str


class PlnBuyResult(BaseModel):
    ok: bool
    rc: str
    message: str
    sn: str = ""
    customer_no: str = ""
    price: float = 0
    product_name: str = ""


class Product(BaseModel):
    buyer_sku_code: str
    product_name: str
    brand: str = ""
    admin: float = 0
    active: bool = True


class Summary(BaseModel):
    total_amount: float
    unpaid_count: int
    paid_count: int
    bill_count: int
    month: str


class Balance(BaseModel):
    ok: bool
    message: str
    product_count: int = 0
