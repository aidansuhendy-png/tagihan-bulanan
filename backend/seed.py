"""Idempotent seed of the user's routine bills. Run: cd /app/backend && python seed.py"""

import asyncio

from lib.db import db, ensure_indexes
from models.bill import Bill

BILLS = [
    ("Oxygen Toko", "Bukan PPOB (Manual)", "", "", False, 28, 220000.0),
    ("Listrik WhiteKost", "", "543101725961", "pln-pasca", True, 20, 0.0),
    ("Indihome 1", "", "122418220970", "indihome", True, 20, 0.0),
    ("Indihome 2", "", "121202274418", "indihome", True, 20, 0.0),
    ("PDAM Mykost", "", "000698070", "pdam", True, 20, 0.0),
    ("Listrik Mamah", "", "536810423948", "pln-pasca", True, 20, 0.0),
    ("Indihome 3", "", "121202276271", "indihome", True, 20, 0.0),
    ("Listrik Mykost", "", "523102398568", "pln-pasca", True, 20, 0.0),
    ("BPJS Mamah", "", "0003176534878", "bpjs-kesehatan", True, 10, 0.0),
    ("BPJS ENDI", "", "0003176479337", "bpjs-kesehatan", True, 10, 0.0),
    ("Wifi Biznet Mykost", "", "1000620319", "biznet", True, 1, 0.0),
    ("Wifi Biznet VIP", "", "1000405095", "biznet", True, 1, 0.0),
]


async def main() -> None:
    await ensure_indexes()
    for title, subtitle, customer_no, sku, is_ppob, due_day, amount in BILLS:
        if await db.bills.find_one({"title": title}):
            continue
        bill = Bill(
            title=title,
            subtitle=subtitle,
            customer_no=customer_no,
            buyer_sku_code=sku,
            is_ppob=is_ppob,
            due_day=due_day,
            amount=amount,
        )
        await db.bills.insert_one(bill.model_dump())
        print("seeded", title)
    print("total bills:", await db.bills.count_documents({}))


if __name__ == "__main__":
    asyncio.run(main())
