export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "SCRAP";
export type StorageType = "SSD" | "HDD" | "NVME";

export type AssetType = {
  id: number;
  name: string;
  usefulLifeYears: number;
  isActive: boolean;
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
  status: AssetStatus;
  assetTypeId?: number | null;
  assetType?: { id: number; name: string; usefulLifeYears: number } | null;
  processor?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  storageType?: StorageType | null;
  purchaseDate?: string | null;
  warrantyEnd?: string | null;
  usefulLifeYears?: number | null;
  endOfLifeDate?: string | null;
  locationId?: number | null;
  location?: { id: number; name: string; parentId?: number | null; parent?: { id: number; name: string } | null } | null;
  assignedToName?: string | null;
  assignedToDate?: string | null;
  specifications?: Record<string, string>;
  custodyDocs?: CustodyDocument[];
  tickets?: Ticket[];
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
