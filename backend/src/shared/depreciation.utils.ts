/**
 * Depreciación en línea recta — LISR Art. 31 (México).
 * Meses completos: el mes de adquisición cuenta como primer mes depreciable.
 */

export const MIN_BOOK_VALUE_MXN = 1;

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export type DepreciationInput = {
  purchasePrice: number;
  salvageValue: number;
  depreciationRate: number;
  purchaseDate: Date;
  asOfDate?: Date;
  minBookValue?: number;
};

export type DepreciationBreakdown = {
  purchasePrice: number;
  salvageValue: number;
  depreciableBase: number;
  depreciationRate: number;
  depreciationRatePercent: number;
  purchaseDate: string;
  asOfDate: string;
  monthsElapsed: number;
  maxDepreciationMonths: number;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isFullyDepreciated: boolean;
  depreciationPercent: number;
  monthsUntilFullyDepreciated: number;
};

/** Meses completos depreciados (mes de compra = mes 1). */
export const countDepreciationMonths = (purchaseDate: Date, asOfDate: Date): number => {
  const start = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
  const end = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);

  if (end < start) return 0;

  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return monthDiff + 1;
};

/** Meses para depreciar el 100% del valor depreciable a tasa constante. */
export const maxDepreciationMonths = (depreciationRate: number): number => {
  if (depreciationRate <= 0) return 0;
  return Math.ceil(12 / depreciationRate);
};

export const calculateDepreciation = (input: DepreciationInput): DepreciationBreakdown => {
  const asOf = input.asOfDate ?? new Date();
  const minBook = input.minBookValue ?? MIN_BOOK_VALUE_MXN;

  const purchasePrice = roundMoney(Math.max(0, input.purchasePrice));
  const salvageValue = roundMoney(Math.max(0, input.salvageValue));
  const depreciableBase = roundMoney(Math.max(0, purchasePrice - salvageValue));
  const rate = input.depreciationRate;

  if (depreciableBase === 0 || rate <= 0) {
    return {
      purchasePrice,
      salvageValue,
      depreciableBase,
      depreciationRate: rate,
      depreciationRatePercent: roundMoney(rate * 100),
      purchaseDate: input.purchaseDate.toISOString(),
      asOfDate: asOf.toISOString(),
      monthsElapsed: 0,
      maxDepreciationMonths: maxDepreciationMonths(rate),
      monthlyDepreciation: 0,
      accumulatedDepreciation: 0,
      bookValue: purchasePrice,
      isFullyDepreciated: false,
      depreciationPercent: 0,
      monthsUntilFullyDepreciated: maxDepreciationMonths(rate),
    };
  }

  const rawMonths = countDepreciationMonths(input.purchaseDate, asOf);
  const maxMonths = maxDepreciationMonths(rate);
  const monthsElapsed = Math.min(rawMonths, maxMonths);

  const monthlyDepreciation = roundMoney(depreciableBase * (rate / 12));
  const accumulatedDepreciation = roundMoney(Math.min(depreciableBase, monthlyDepreciation * monthsElapsed));

  let bookValue = roundMoney(purchasePrice - accumulatedDepreciation);
  const isFullyDepreciated = accumulatedDepreciation >= depreciableBase - Number.EPSILON;

  if (isFullyDepreciated) {
    bookValue = minBook;
  } else {
    bookValue = Math.max(bookValue, minBook);
  }

  const depreciationPercent =
    depreciableBase > 0 ? roundMoney((accumulatedDepreciation / depreciableBase) * 100) : 0;

  const monthsUntilFullyDepreciated = Math.max(0, maxMonths - monthsElapsed);

  return {
    purchasePrice,
    salvageValue,
    depreciableBase,
    depreciationRate: rate,
    depreciationRatePercent: roundMoney(rate * 100),
    purchaseDate: input.purchaseDate.toISOString(),
    asOfDate: asOf.toISOString(),
    monthsElapsed,
    maxDepreciationMonths: maxMonths,
    monthlyDepreciation,
    accumulatedDepreciation,
    bookValue,
    isFullyDepreciated,
    depreciationPercent,
    monthsUntilFullyDepreciated,
  };
};
