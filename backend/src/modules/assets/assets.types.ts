export const assetStatuses = ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "SCRAP"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const deviceTypes = ["LAPTOP", "DESKTOP", "SERVER", "PRINTER", "MONITOR", "OTHER"] as const;
export type DeviceType = (typeof deviceTypes)[number];

export const storageTypes = ["SSD", "HDD", "NVME"] as const;
export type StorageType = (typeof storageTypes)[number];
