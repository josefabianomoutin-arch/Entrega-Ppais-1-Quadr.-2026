
export interface Delivery {
  id: string;
  date: string; // ISO string format: 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  item?: string;
  kg?: number;
  value?: number;
  invoiceUploaded: boolean;
  invoiceNumber?: string;
  lots?: {
    id: string;
    lotNumber: string;
    initialQuantity: number;
    remainingQuantity: number;
    barcode?: string;
    expirationDate?: string;
  }[];
  withdrawals?: {
    lotId: string;
    date: string;
    quantity: number;
  }[];
  remainingQuantity?: number;
}

export interface ContractItem {
  name: string;
  totalKg: number;
  valuePerKg: number;
  unit?: string;
  order?: number;
  siafemCode?: string;
  comprasCode?: string;
}

export interface Supplier {
  name: string;
  cpf: string;
  initialValue: number;
  contractItems: ContractItem[];
  deliveries: Delivery[];
  allowedWeeks: number[];
}

export interface WarehouseMovement {
  id: string;
  type: 'entrada' | 'saída';
  timestamp: string;
  lotId: string;
  lotNumber: string;
  itemName: string;
  supplierName: string;
  deliveryId: string;
  inboundInvoice?: string;
  outboundInvoice?: string;
  quantity?: number;
  expirationDate?: string;
}

export interface PerCapitaConfig {
  staffCount?: number;
  inmateCount?: number;
  customValues?: Record<string, string>;
}

export interface CleaningLog {
  id: string;
  date: string;
  responsible: string;
  location: string;
  type: 'diaria' | 'semanal' | 'pesada' | 'preventiva' | 'corretiva';
  observations: string;
  maintenanceDetails?: string;
}

export interface DirectorItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  expirationDate?: string;
}

export interface DirectorPerCapitaLog {
  id: string;
  date: string;
  month?: string;
  week?: string;
  recipient: 'Chefe de Departamento' | 'Diretor de Disciplina';
  items: DirectorItem[];
  totalValue: number;
}

export interface MenuRow {
  id: string;
  period?: 'CAFÉ DA MANHÃ' | 'ALMOÇO' | 'JANTA' | 'LANCHE NOITE' | '';
  foodItem: string; // Descrição da preparação
  contractedItem?: string; // Item do contrato vinculado para análise
  unitWeight: string;
  totalWeight: string;
}

export interface StandardMenu {
  [dayOrDate: string]: MenuRow[];
}

// Representa os cardápios salvos por data específica
export interface DailyMenus {
  [date: string]: MenuRow[];
}
