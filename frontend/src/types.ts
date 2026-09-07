export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "SCRAP";

export const assetStatusLabels: Record<AssetStatus, string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Asignado",
  MAINTENANCE: "Mantenimiento",
  SCRAP: "Baja",
};

export type AssetDecommissionReason = "END_OF_LIFE" | "DAMAGE" | "THEFT" | "OTHER";

export const assetDecommissionReasonLabels: Record<AssetDecommissionReason, string> = {
  END_OF_LIFE: "Fin de vida útil",
  DAMAGE: "Daño / irreparable",
  THEFT: "Robo / extravío",
  OTHER: "Otro",
};
export type StorageType = "SSD" | "HDD" | "NVME";

export type AssetType = {
  id: number;
  name: string;
  usefulLifeYears: number;
  depreciationRate?: number;
  isActive: boolean;
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

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "PROVIDER" | "CLOSED" | "CANCELLED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketLevel = "LEVEL_1" | "LEVEL_2" | "PROVEEDOR";

export type TicketAttachment = {
  id: number;
  ticketId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: {
    id: number;
    fullName: string;
  } | null;
};

export type TicketComment = {
  id: number;
  ticketId: number;
  body: string;
  createdAt: string;
  author?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

export type Ticket = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  level: TicketLevel;
  supportTopicId: number | null;
  assignedToId: number | null;
  assetId: number;
  createdAt: string;
  supportTopic?: {
    id: number;
    name: string;
  } | null;
  assignedTo?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  asset?: {
    id: number;
    assetCode: string;
    brand: string;
    model: string;
    serialNumber?: string;
  };
  events?: Array<{
    id: number;
    action: string;
    createdAt: string;
    details?: Record<string, unknown>;
    actor?: {
      id: number;
      fullName: string;
      email: string;
    } | null;
  }>;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
  _count?: {
    comments: number;
    attachments: number;
  };
};

export type CustodyDocument = {
  id: number;
  assetId: number;
  assignedToName: string;
  assignedToDate: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: number; fullName: string } | null;
};

export type Asset = {
  id: number;
  assetCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  equipmentValue?: number | null;
  purchasePrice?: number | null;
  salvageValue?: number | null;
  status: AssetStatus;
  assetTypeId?: number | null;
  assetType?: { id: number; name: string; usefulLifeYears: number; depreciationRate?: number } | null;
  processor?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  storageType?: StorageType | null;
  purchaseDate?: string | null;
  warrantyEnd?: string | null;
  usefulLifeYears?: number | null;
  endOfLifeDate?: string | null;
  locationId?: number | null;
  locationPath?: string | null;
  location?: { id: number; name: string; parentId?: number | null; parent?: { id: number; name: string } | null } | null;
  assignedToName?: string | null;
  assignedToDate?: string | null;
  decommissionReason?: AssetDecommissionReason | null;
  decommissionNotes?: string | null;
  decommissionedAt?: string | null;
  decommissionedBy?: { id: number; fullName: string; email: string } | null;
  specifications?: Record<string, string>;
  custodyDocs?: CustodyDocument[];
  tickets?: Ticket[];
};

// ── Vehicles ─────────────────────────────────

export type VehicleType = "SEDAN" | "SUV" | "PICKUP" | "VAN" | "TRUCK" | "MOTORCYCLE" | "OTHER";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  SEDAN: "Sedan",
  SUV: "SUV",
  PICKUP: "Pickup",
  VAN: "Van",
  TRUCK: "Camion",
  MOTORCYCLE: "Motocicleta",
  OTHER: "Otro",
};

export type VehicleDocumentType = "CARTA_COMPROMISO" | "TARJETA_CIRCULACION" | "POLIZA_SEGURO" | "FACTURA_MANTENIMIENTO" | "FACTURA_COMPRA" | "VERIFICACION" | "OTRO";

export const vehicleDocumentTypeLabels: Record<VehicleDocumentType, string> = {
  CARTA_COMPROMISO: "Carta Compromiso",
  TARJETA_CIRCULACION: "Tarjeta de Circulacion",
  POLIZA_SEGURO: "Poliza de Seguro",
  FACTURA_MANTENIMIENTO: "Factura de Mantenimiento",
  FACTURA_COMPRA: "Factura de Compra",
  VERIFICACION: "Verificacion",
  OTRO: "Otro",
};

export type VehicleDocument = {
  id: number;
  vehicleId: number;
  documentType: VehicleDocumentType;
  description?: string | null;
  expiresAt?: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: number; fullName: string } | null;
};

export type Vehicle = {
  id: number;
  vehicleCode: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  plateNumber: string;
  serialNumber?: string | null;
  engineNumber?: string | null;
  vehicleType: VehicleType;
  mileage?: number | null;
  status: AssetStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  salvageValue?: number | null;
  warrantyEnd?: string | null;
  usefulLifeYears?: number | null;
  endOfLifeDate?: string | null;
  locationId?: number | null;
  locationPath?: string | null;
  location?: { id: number; name: string; parentId?: number | null; parent?: { id: number; name: string } | null } | null;
  assignedToName?: string | null;
  assignedToDate?: string | null;
  decommissionReason?: AssetDecommissionReason | null;
  decommissionNotes?: string | null;
  decommissionedAt?: string | null;
  decommissionedBy?: { id: number; fullName: string; email: string } | null;
  specifications?: Record<string, string>;
  documents?: VehicleDocument[];
};

// ── Projects & Gantt ─────────────────────────────────

export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD" | "CANCELLED";
export type GanttTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type DependencyType = "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH";

export type TaskDependency = {
  id: number;
  predecessorId?: number;
  successorId?: number;
  type: DependencyType;
};

export type ProjectTask = {
  id: number;
  projectId: number;
  parentTaskId: number | null;
  name: string;
  description: string | null;
  status: GanttTaskStatus;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  isCritical: boolean;
  isMilestone: boolean;
  sortOrder: number;
  assignedToId: number | null;
  assetId: number | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: number; fullName: string; email: string } | null;
  asset?: { id: number; assetCode: string; brand: string; model: string } | null;
  children?: ProjectTask[];
  dependenciesAsPredecessor: TaskDependency[];
  dependenciesAsSuccessor: TaskDependency[];
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: ProjectTask[];
  _count?: { tasks: number };
};
