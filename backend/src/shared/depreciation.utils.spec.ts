/**
 * Casos de prueba manuales — depreciación LISR (línea recta).
 * Ejecutar: npx ts-node src/shared/depreciation.utils.spec.ts (desde backend/)
 */
import { calculateDepreciation, countDepreciationMonths, roundMoney } from "./depreciation.utils";

const assert = (label: string, condition: boolean) => {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`OK: ${label}`);
};

const purchaseThisMonth = new Date(2026, 6, 15); // Jul 2026
const asOfSameMonth = new Date(2026, 6, 20);

const currentMonth = calculateDepreciation({
  purchasePrice: 30000,
  salvageValue: 0,
  depreciationRate: 0.30,
  purchaseDate: purchaseThisMonth,
  asOfDate: asOfSameMonth,
});
assert("Mes en curso: 1 mes depreciado", currentMonth.monthsElapsed === 1);
assert("Mes en curso: depreciación mensual 750", currentMonth.monthlyDepreciation === 750);
assert("Mes en curso: acumulada 750", currentMonth.accumulatedDepreciation === 750);

const lastYear = calculateDepreciation({
  purchasePrice: 30000,
  salvageValue: 0,
  depreciationRate: 0.30,
  purchaseDate: new Date(2024, 0, 10),
  asOfDate: new Date(2026, 6, 1),
});
assert("Activo 2024: >12 meses", lastYear.monthsElapsed > 12);
assert("Activo 2024: bookValue < MOI", lastYear.bookValue < 30000);

const fullyDep = calculateDepreciation({
  purchasePrice: 12000,
  salvageValue: 0,
  depreciationRate: 0.30,
  purchaseDate: new Date(2020, 0, 1),
  asOfDate: new Date(2026, 6, 1),
});
assert("Obsoleto: 100% depreciado", fullyDep.isFullyDepreciated);
assert("Obsoleto: valor en libros $1", fullyDep.bookValue === 1);

assert("Redondeo 2 decimales", roundMoney(10.005) === 10.01);
assert("Meses completos ene→jul", countDepreciationMonths(new Date(2026, 0, 1), new Date(2026, 6, 1)) === 7);

console.log("\nTodos los casos de depreciación pasaron.");
