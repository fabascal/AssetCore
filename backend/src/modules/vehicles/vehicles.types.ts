export const vehicleTypes = ["SEDAN", "SUV", "PICKUP", "VAN", "TRUCK", "MOTORCYCLE", "OTHER"] as const;
export type VehicleType = (typeof vehicleTypes)[number];

export const vehicleTypeLabels: Record<VehicleType, string> = {
  SEDAN: "Sedan",
  SUV: "SUV",
  PICKUP: "Pickup",
  VAN: "Van",
  TRUCK: "Camion",
  MOTORCYCLE: "Motocicleta",
  OTHER: "Otro",
};

export const vehicleDocumentTypes = [
  "CARTA_COMPROMISO",
  "TARJETA_CIRCULACION",
  "POLIZA_SEGURO",
  "FACTURA_MANTENIMIENTO",
  "FACTURA_COMPRA",
  "VERIFICACION",
  "OTRO",
] as const;
export type VehicleDocumentType = (typeof vehicleDocumentTypes)[number];

export const vehicleDocumentTypeLabels: Record<VehicleDocumentType, string> = {
  CARTA_COMPROMISO: "Carta Compromiso",
  TARJETA_CIRCULACION: "Tarjeta de Circulacion",
  POLIZA_SEGURO: "Poliza de Seguro",
  FACTURA_MANTENIMIENTO: "Factura de Mantenimiento",
  FACTURA_COMPRA: "Factura de Compra",
  VERIFICACION: "Verificacion",
  OTRO: "Otro",
};
