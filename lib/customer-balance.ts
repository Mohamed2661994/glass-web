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
  previous_balance?: NumericLike;
  remaining_amount?: NumericLike;
  paid_amount?: NumericLike;
  row_sort_key?: string | null;
};

const toNumber = (value: NumericLike) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const BALANCE_EPSILON = 0.01;

const balancesMatch = (left: NumericLike, right: NumericLike) =>
  Math.abs(toNumber(left) - toNumber(right)) <= BALANCE_EPSILON;

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

export const orderCustomerStatementRows = <T extends CustomerDebtRow>(
  rows: T[],
  openingBalance: NumericLike = 0,
) => {
  const indexedRows = rows.map((row, index) => ({ row, index }));

  indexedRows.sort((left, right) => {
    const leftKey = String(left.row.row_sort_key ?? "");
    const rightKey = String(right.row.row_sort_key ?? "");
    const byDate = leftKey.localeCompare(rightKey);
    return byDate !== 0 ? byDate : left.index - right.index;
  });

  const orderedRows: T[] = [];
  let currentBalance = toNumber(openingBalance);
  let start = 0;

  while (start < indexedRows.length) {
    const dayKey = String(indexedRows[start].row.row_sort_key ?? "").substring(
      0,
      10,
    );
    let end = start;

    while (
      end < indexedRows.length &&
      String(indexedRows[end].row.row_sort_key ?? "").substring(0, 10) === dayKey
    ) {
      end += 1;
    }

    const dayRows = indexedRows.slice(start, end).map((entry) => entry.row);

    while (dayRows.length > 0) {
      let nextIndex = dayRows.findIndex(
        (row) =>
          row.record_type === "invoice" &&
          balancesMatch(row.previous_balance, currentBalance),
      );

      if (nextIndex === -1) {
        nextIndex = dayRows.findIndex(
          (row) =>
            row.record_type !== "invoice" &&
            dayRows.some(
              (candidate) =>
                candidate.record_type === "invoice" &&
                balancesMatch(
                  candidate.previous_balance,
                  currentBalance - toNumber(row.paid_amount),
                ),
            ),
        );
      }

      if (nextIndex === -1) {
        nextIndex = 0;
      }

      const [row] = dayRows.splice(nextIndex, 1);
      orderedRows.push(row);

      if (row.record_type === "invoice") {
        currentBalance = toNumber(row.remaining_amount);
      } else {
        currentBalance -= toNumber(row.paid_amount);
      }
    }

    start = end;
  }

  return orderedRows;
};
