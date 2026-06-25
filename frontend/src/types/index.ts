export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "super_admin" | "admin" | "client_manager" | "operator";
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  clientLinks?: { client: { id: string; name: string } }[];
}

export interface Client {
  id: string;
  name: string;
  legalName?: string;
  document?: string;
  email?: string;
  status: "active" | "inactive" | "suspended";
  activationCode: string;
  agentsCount: number;
  printersCount: number;
  openAlertsCount: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  agentVersion?: string;
  osInfo?: string;
  localIp?: string;
  status: "online" | "offline" | "error";
  lastContactAt?: string;
  client?: { id: string; name: string };
  _count?: { printers: number };
}

export interface Printer {
  id: string;
  name: string;
  displayName?: string;
  ipAddress?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: "online" | "offline" | "error" | "warning";
  statusDetail?: string;
  totalPages?: number;
  lastContactAt?: string;
  client?: { id: string; name: string };
  supplyLevels?: { levelPercent: number; supplyType: string; status: string }[];
  _count?: { events: number };
}

export interface PrintJob {
  id: number;
  documentName?: string;
  pages: number;
  colorPages?: number;
  monoPages?: number;
  isDuplex?: boolean;
  username?: string;
  computerName?: string;
  printedAt?: string;
  client?: { id: string; name: string };
  printer?: { id: string; name: string; model?: string };
}

export interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  occurredAt: string;
  client?: { id: string; name: string };
  printer?: { id: string; name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
