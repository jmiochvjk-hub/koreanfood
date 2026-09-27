# Catalog imports

## Olive Young seed

`oliveyoung-200-review.csv` contains 200 unique products collected from the
public Olive Young ranking pages on 2026-09-27:

- 100 from the overall ranking
- 64 additional skincare products after deduplication
- 36 additional makeup products after deduplication

Only factual listing metadata is stored: Olive Young product ID, Korean brand
and product name, displayed prices, official image URL, and official product
URL. Long-form descriptions are intentionally excluded.

Olive Young does not expose a reliable package barcode in these ranking
listings. `barcode` is therefore blank and the SQL import marks each row as
`pending_physical_scan`. Add verified EAN/UPC/GTIN values to
`public.item_barcodes`; never infer or manufacture a barcode.

The checked-in SQL import is generated from this review file and is idempotent:

```text
migrations/20260927_04_import_oliveyoung_200.sql
```

Before a future refresh, preserve the previous CSV for audit, review large
price/name changes, and verify that image hotlinks are still permitted by the
retailer.
