import { prisma } from "../../shared/prisma";
import { calculateDepreciation, type DepreciationBreakdown } from "../../shared/depreciation.utils";

const assetDepreciationSelect = {
  id: true,
  assetCode: true,
  brand: true,
  model: true,
  serialNumber: true,
  status: true,
  purchaseDate: true,
  purchasePrice: true,
  equipmentValue: true,
  salvageValue: true,
  assetTypeId: true,
  assetType: {
    select: {
      id: true,
      name: true,
      depreciationRate: true,
      usefulLifeYears: true,
    },
  },
} as const;

type AssetDepreciationRow = {
  id: number;
  assetCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  purchaseDate: Date | null;
  purchasePrice: number | null;
  equipmentValue: number | null;
  salvageValue: number;
  assetTypeId: number | null;
  assetType: {
    id: number;
    name: string;
    depreciationRate: number;
    usefulLifeYears: number;
  } | null;
};

export type AssetDepreciationResponse = {
  asset: {
    id: number;
    assetCode: string;
    brand: string;
    model: string;
    serialNumber: string;
    status: string;
    assetType: { id: number; name: string; depreciationRate: number } | null;
  };
  depreciation: DepreciationBreakdown | null;
  warnings: string[];
};

const resolvePurchasePrice = (asset: AssetDepreciationRow): number | null => {
  if (asset.purchasePrice != null && asset.purchasePrice > 0) return asset.purchasePrice;
  if (asset.equipmentValue != null && asset.equipmentValue > 0) return asset.equipmentValue;
  return null;
};

export const buildAssetDepreciation = (
  asset: AssetDepreciationRow,
  asOfDate?: Date,
): { depreciation: DepreciationBreakdown | null; warnings: string[] } => {
  const warnings: string[] = [];
  const purchasePrice = resolvePurchasePrice(asset);

  if (!asset.purchaseDate) {
    warnings.push("Falta fecha de compra para calcular depreciación.");
    return { depreciation: null, warnings };
  }

  if (purchasePrice == null) {
    warnings.push("Falta MOI (purchasePrice o equipmentValue).");
    return { depreciation: null, warnings };
  }

  const rate = asset.assetType?.depreciationRate;
  if (rate == null || rate <= 0) {
    warnings.push("El tipo de activo no tiene tasa de depreciación LISR configurada.");
    return { depreciation: null, warnings };
  }

  const depreciation = calculateDepreciation({
    purchasePrice,
    salvageValue: asset.salvageValue ?? 0,
    depreciationRate: rate,
    purchaseDate: asset.purchaseDate,
    asOfDate,
  });

  return { depreciation, warnings };
};

export const getAssetDepreciation = async (assetId: number, asOfDate?: Date): Promise<AssetDepreciationResponse | null> => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: assetDepreciationSelect,
  });

  if (!asset) return null;

  const { depreciation, warnings } = buildAssetDepreciation(asset, asOfDate);

  return {
    asset: {
      id: asset.id,
      assetCode: asset.assetCode,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serialNumber,
      status: asset.status,
      assetType: asset.assetType
        ? {
            id: asset.assetType.id,
            name: asset.assetType.name,
            depreciationRate: asset.assetType.depreciationRate,
          }
        : null,
    },
    depreciation,
    warnings,
  };
};

export type FinancialSummaryResponse = {
  asOfDate: string;
  totalOriginalValue: number;
  totalBookValue: number;
  totalAccumulatedDepreciation: number;
  activeAssetsCount: number;
  assetsWithDepreciationData: number;
  fullyDepreciatedCount: number;
  nearingFullDepreciation: Array<{
    id: number;
    assetCode: string;
    brand: string;
    model: string;
    bookValue: number;
    monthsUntilFullyDepreciated: number;
    projectedFullDepreciationDate: string | null;
  }>;
};

export const getFinancialSummary = async (asOfDate?: Date): Promise<FinancialSummaryResponse> => {
  const asOf = asOfDate ?? new Date();

  const assets = await prisma.asset.findMany({
    where: { status: { not: "SCRAP" } },
    select: assetDepreciationSelect,
  });

  let totalOriginalValue = 0;
  let totalBookValue = 0;
  let totalAccumulatedDepreciation = 0;
  let assetsWithDepreciationData = 0;
  let fullyDepreciatedCount = 0;

  const nearingFullDepreciation: FinancialSummaryResponse["nearingFullDepreciation"] = [];

  for (const asset of assets) {
    const { depreciation } = buildAssetDepreciation(asset, asOf);
    if (!depreciation) continue;

    assetsWithDepreciationData += 1;
    totalOriginalValue += depreciation.purchasePrice;
    totalBookValue += depreciation.bookValue;
    totalAccumulatedDepreciation += depreciation.accumulatedDepreciation;

    if (depreciation.isFullyDepreciated) {
      fullyDepreciatedCount += 1;
    }

    if (
      !depreciation.isFullyDepreciated &&
      depreciation.monthsUntilFullyDepreciated > 0 &&
      depreciation.monthsUntilFullyDepreciated <= 3
    ) {
      const projected = new Date(asOf.getFullYear(), asOf.getMonth() + depreciation.monthsUntilFullyDepreciated, 1);
      nearingFullDepreciation.push({
        id: asset.id,
        assetCode: asset.assetCode,
        brand: asset.brand,
        model: asset.model,
        bookValue: depreciation.bookValue,
        monthsUntilFullyDepreciated: depreciation.monthsUntilFullyDepreciated,
        projectedFullDepreciationDate: projected.toISOString(),
      });
    }
  }

  return {
    asOfDate: asOf.toISOString(),
    totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
    totalBookValue: Math.round(totalBookValue * 100) / 100,
    totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
    activeAssetsCount: assets.length,
    assetsWithDepreciationData,
    fullyDepreciatedCount,
    nearingFullDepreciation: nearingFullDepreciation.sort(
      (a, b) => a.monthsUntilFullyDepreciated - b.monthsUntilFullyDepreciated,
    ),
  };
};
