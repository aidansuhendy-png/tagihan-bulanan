# Tagihan Rutin (PPOB Digiflazz)

Aplikasi pribadi untuk mengecek & membayar tagihan pascabayar (PLN, Indihome, Biznet, PDAM, Telkom PSTN, BPJS Kesehatan) via Digiflazz. Tanpa login.

## Stack
FastAPI + MongoDB (`bills`, `transactions`) · React 19 + TanStack Query.

## Backend routes (semua di `/api`)
- `GET /products` — katalog 6 SKU pascabayar (statis)
- `GET /bills`, `POST /bills`, `GET/PATCH/DELETE /bills/{id}`
- `POST /bills/{id}/check` — `inq-pasca` Digiflazz, simpan `amount`, `customer_name`, `last_ref_id`
- `POST /bills/{id}/pay` — `pay-pasca` memakai `last_ref_id` (idempotent per ref), status → PAID/PENDING
- `GET /transactions` — riwayat cek & bayar
- `GET /summary` — total tagihan belum lunas bulan ini
- `GET /digiflazz/health` — price-list probe (deteksi whitelist IP / key salah)

## Digiflazz
Kredensial production di `backend/.env` (`DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_API_KEY`). Sign = md5(username+key+ref_id). IP egress pod: **34.16.56.64** — harus di-whitelist di dashboard Digiflazz, kalau tidak semua panggilan balas `rc=45`.

## Flow
Home (`/`) → kartu ringkasan, "Cek semua tagihan", daftar tagihan (cek per item, bayar dengan dialog konfirmasi, hapus), tambah tagihan. Riwayat di `/riwayat`.

## Seed
`cd /app/backend && python seed.py` — 12 tagihan (11 PPOB + 1 manual "Oxygen Toko" Rp 220.000). Idempotent by title.

## Pengingat jatuh tempo
`Bill.days_until_due` dihitung di `lib/dates.py:days_until_due()` (zona WIB / Asia/Jakarta): signed days ke tanggal jatuh tempo bulan ini (0=hari ini, <0=terlambat, >0=akan datang). Badge di BillRow: merah untuk terlambat / hari-H, kuning untuk ≤3 hari lagi; tagihan PAID tidak diberi pengingat. `rc 60` (sudah lunas bulan ini) → status PAID otomatis. Urutan `/bills`: belum lunas dulu (paling mendesak/terlambat di atas via days_until_due asc), lunas selalu di bawah.

## Beli token listrik (PLN Prabayar)
- `GET /pln/products` — nominal token PLN dari price-list prabayar akun (cmd `prepaid`), filter brand PLN + kategori Token, buang "Cek Nama Token PLN", di-cache 1 jam di `db.pln_products`. Ada `PLN_FALLBACK` bila price-list kena rate-limit & cache kosong.
- `POST /pln/buy` {customer_no, buyer_sku_code} — transaksi prabayar Digiflazz (endpoint sama tanpa `commands`), token dikembalikan di `sn`. Dicatat ke `transactions` dengan kind `topup`. Memakai saldo asli.
- Frontend: `BuyTokenDialog` (tombol "Beli Token Listrik" di Home) — input nomor meter, pilih nominal, konfirmasi, tampilkan token + tombol salin. Riwayat menampilkan badge "Token".
