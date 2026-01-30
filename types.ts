
export interface Delivery {
  id: string;
  date: string; // ISO string format: 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  item?: string;
  kg?: number;
  value?: number;
  invoiceUploaded: boolean;
  invoiceNumber?: string;
  // PEPS fields
  lots?: {
    id: string;
    lotNumber: string;
    initialQuantity: number;
    remainingQuantity: number;
    barcode?: string;
    expirationDate?: string; // Data de validade do lote
  }[];
  withdrawals?: {
    lotId: string;
    date: string;
    quantity: number;
  }[];
  remainingQuantity?: number; // Total remaining for this delivery item
}

export interface ContractItem {
  name: string;
  totalKg: number;
  valuePerKg: number;
  unit?: string;
  order?: number;
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
  type: 'diaria' | 'semanal' | 'pesada';
  observations: string;
}
