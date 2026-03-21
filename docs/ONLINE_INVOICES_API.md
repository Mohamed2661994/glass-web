# Online Invoices API

## Endpoint

- Method: `POST`
- URL: `/integrations/online-invoices`

## Authentication

Send one of the following:

- Header `X-API-Key: <ONLINE_INVOICE_API_KEY>`
- Or `Authorization: Bearer <ONLINE_INVOICE_API_KEY>`

## Required Environment Variables

- `ONLINE_INVOICE_API_KEY`: shared secret used by the external website
- `ONLINE_INVOICE_BRANCH_ID` (optional): force all online invoices into a specific branch

## Request Body

```json
{
  "source": "website",
  "externalOrderId": "ORD-10025",
  "invoiceType": "retail",
  "customer": {
    "name": "اسم العميل",
    "phone": "01000000000"
  },
  "notes": "ملاحظات الطلب",
  "paidAmount": 0,
  "items": [
    {
      "code": "6223001234567",
      "quantity": 2
    },
    {
      "code": "6223000001111",
      "quantity": 1,
      "package": "علبة"
    }
  ]
}
```

## Field Rules

- `source`: logical source name, defaults to `website`
- `externalOrderId`: required unique external order identifier
- `invoiceType`: required, must be `retail` or `wholesale`
- `customer.name`: required
- `customer.phone`: optional
- `paidAmount`: optional, defaults to `0`
- `items`: required non-empty array
- `items[].code`: required, matched against `products.barcode` and `product_variants.barcode`
- `items[].quantity`: required and must be greater than `0`
- `items[].package`: optional, backend will auto-resolve package when missing

## Backend Behavior

1. Validates API key.
2. Prevents duplicates using `invoice_source + external_order_id`.
3. Matches each item by barcode.
4. Resolves price from the local system:
   - `retail` uses `retail_price`
   - `wholesale` uses `wholesale_price`
5. Creates a normal invoice in the system.
6. Inserts `invoice_items`.
7. Updates `stock` and `stock_movements`.
8. Inserts `cash_in` if `paidAmount > 0`.

## Success Response

```json
{
  "success": true,
  "invoice_id": 1234,
  "external_order_id": "ORD-10025",
  "invoice_type": "retail",
  "total": 500,
  "paid_amount": 0,
  "remaining_amount": 500,
  "journal_posted": false
}
```

## Duplicate Response

```json
{
  "success": true,
  "duplicate": true,
  "invoice_id": 1234,
  "invoice_type": "retail",
  "total": 500,
  "paid_amount": 0,
  "remaining_amount": 500
}
```

## Common Errors

- `401 Unauthorized integration request`: wrong or missing API key
- `400 externalOrderId مطلوب`: external order id was not sent
- `400 invoiceType لازم يكون retail أو wholesale`: invalid invoice type
- `400 اسم العميل مطلوب`: customer name missing
- `400 لازم ترسل items`: items array missing or empty
- `500 الكود ... غير موجود في الأصناف`: barcode does not exist in the system

## Recommended Production URL

Replace the domain below with the deployed backend domain:

```text
POST https://your-backend-domain.com/integrations/online-invoices
```