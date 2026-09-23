"""Digiflazz Buyer API client (pascabayar). Server-side only — credentials never leave here."""

import hashlib
import os
from typing import Any

import httpx

TX_URL = "https://api.digiflazz.com/v1/transaction"
PRICE_URL = "https://api.digiflazz.com/v1/price-list"

RC_MESSAGES: dict[str, str] = {
    "00": "Transaksi sukses",
    "01": "Timeout, cek ulang beberapa saat lagi",
    "02": "Transaksi gagal",
    "03": "Transaksi pending",
    "40": "Payload tidak valid",
    "41": "Signature tidak valid (cek username/production key)",
    "42": "Username bermasalah",
    "43": "SKU tidak ditemukan atau non-aktif",
    "44": "Saldo Digiflazz tidak cukup",
    "45": "IP server belum di-whitelist di Digiflazz",
    "60": "Tagihan sudah lunas bulan ini",
}


def _username() -> str:
    return os.environ.get("DIGIFLAZZ_USERNAME", "")


def _api_key() -> str:
    return os.environ.get("DIGIFLAZZ_API_KEY", "")


def tx_sign(ref_id: str) -> str:
    return hashlib.md5(f"{_username()}{_api_key()}{ref_id}".encode()).hexdigest()


def price_sign() -> str:
    return hashlib.md5(f"{_username()}{_api_key()}pricelist".encode()).hexdigest()


async def _post(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as c:
        r = await c.post(url, json=payload)
        try:
            body = r.json()
        except ValueError:
            body = None
    # Digiflazz answers business errors (rc 41/45/…) with HTTP 400 + a normal {"data": …}
    # envelope, so the body is authoritative — only a missing envelope is a transport failure.
    if not isinstance(body, dict) or "data" not in body:
        raise ValueError(f"Respons Digiflazz tidak valid (HTTP {r.status_code})")
    return body


async def pasca(command: str, sku: str, customer_no: str, ref_id: str) -> dict[str, Any]:
    """command: 'inq-pasca' | 'pay-pasca'. Returns the `data` object."""
    payload = {
        "commands": command,
        "username": _username(),
        "buyer_sku_code": sku,
        "customer_no": customer_no,
        "ref_id": ref_id,
        "sign": tx_sign(ref_id),
    }
    body = await _post(TX_URL, payload)
    data = body.get("data")
    return data if isinstance(data, dict) else {"rc": "02", "message": "Respons kosong"}


async def prepaid(sku: str, customer_no: str, ref_id: str) -> dict[str, Any]:
    """Prabayar (token/pulsa) — same endpoint, no `commands`. Returns the `data` object."""
    payload = {
        "username": _username(),
        "buyer_sku_code": sku,
        "customer_no": customer_no,
        "ref_id": ref_id,
        "sign": tx_sign(ref_id),
    }
    body = await _post(TX_URL, payload)
    data = body.get("data")
    return data if isinstance(data, dict) else {"rc": "02", "message": "Respons kosong"}


async def _price_list(cmd: str) -> list[dict[str, Any]]:
    body = await _post(PRICE_URL, {"cmd": cmd, "username": _username(), "sign": price_sign()})
    data = body.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and data.get("message"):
        raise ValueError(str(data["message"]))
    return []


async def price_list_pasca() -> list[dict[str, Any]]:
    return await _price_list("pasca")


async def price_list_prepaid() -> list[dict[str, Any]]:
    return await _price_list("prepaid")
