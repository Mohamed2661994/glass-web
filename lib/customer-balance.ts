type NumericLike = number | string | null | undefined;

type CustomerBalanceResponse = {
  total_sales?: NumericLike;
  total_paid?: NumericLike;
  balance?: NumericLike;
  balance_due?: NumericLike;
};

type CustomerDebtRow = {
  record_type?: string | null;
  remaining_amount?: NumericLike;
  paid_amount?: NumericLike;
};

const toNumber = (value: NumericLike) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const extractCustomerBalance = (
  response: CustomerBalanceResponse | null | undefined,
) => {
  if (!response) return null;

  if (response.total_sales != null && response.total_paid != null) {
    return Math.round((toNumber(response.total_sales) - toNumber(response.total_paid)) * 100) / 100;
  }

  if (response.balance != null || response.balance_due != null) {
    return toNumber(response.balance ?? response.balance_due);
  }

  return null;
};

export const calculateNetCustomerDebt = (rows: CustomerDebtRow[]) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let lastRemaining = 0;
  let paymentsAfterLastInvoice = 0;
  let hasInvoice = false;

  for (const row of rows) {
    if (row.record_type === "invoice") {
      hasInvoice = true;
      lastRemaining = toNumber(row.remaining_amount);
      paymentsAfterLastInvoice = 0;
      continue;
    }

    paymentsAfterLastInvoice += toNumber(row.paid_amount);
  }

  if (!hasInvoice) return null;

  return Math.round((lastRemaining - paymentsAfterLastInvoice) * 100) / 100;
};