type NumericLike = number | string | null | undefined;

type CustomerBalanceResponse = {
  total_sales?: NumericLike;
  total_paid?: NumericLike;
  balance?: NumericLike;
  balance_due?: NumericLike;
};

type CustomerDebtRow = {
  record_type?: string | null;
  subtotal?: NumericLike;
  discount_total?: NumericLike;
  total?: NumericLike;
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
    return (
      Math.round(
        (toNumber(response.total_sales) - toNumber(response.total_paid)) * 100,
      ) / 100
    );
  }

  if (response.balance != null || response.balance_due != null) {
    return toNumber(response.balance ?? response.balance_due);
  }

  return null;
};

export const calculateNetCustomerDebt = (
  rows: CustomerDebtRow[],
  openingBalance: NumericLike = 0,
) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let balance = toNumber(openingBalance);
  let hasMovement = false;

  for (const row of rows) {
    if (row.record_type === "invoice") {
      hasMovement = true;

      const remainingAmount = toNumber(row.remaining_amount);
      const subtotal = toNumber(row.subtotal);
      const discountTotal = toNumber(row.discount_total);
      const total = toNumber(row.total);
      const paidAmount = toNumber(row.paid_amount);

      const invoiceOutstanding =
        row.remaining_amount != null
          ? remainingAmount
          : (row.subtotal != null || row.discount_total != null
              ? subtotal - discountTotal
              : total) - paidAmount;

      balance = invoiceOutstanding;
      continue;
    }

    const paymentAmount = toNumber(row.paid_amount);
    if (paymentAmount !== 0) {
      hasMovement = true;
    }
    balance -= paymentAmount;
  }

  if (!hasMovement) return null;

  return Math.round(balance * 100) / 100;
};
