
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
  totalKg: number; // Para 'un', é o peso total. Para outros, é a quantidade de unidades (dúzias, baldes, sacos, etc).
  valuePerKg: number; // Para 'un', é o valor/kg. Para outros, é o valor por unidade.
  unit?: string; // Unidade de medida do item, ex: 'balde-18', 'dz-auto', 'kg-1'
  order?: number;
}

export interface Supplier {
  name: string;
  cpf: string; // Atua como senha e identificador único (CPF ou CNPJ)
  initialValue: number;
  contractItems: ContractItem[];
  deliveries: Delivery[];
  allowedWeeks: number[];
}

export interface WarehouseMovement {
  id: string;
  type: 'entrada' | 'saída';
  timestamp: string; // ISO string for date and time
  lotId: string;
  lotNumber: string;
  itemName: string;
  supplierName: string;
  deliveryId: string;
  outboundInvoice?: string; // Optional, only for 'saída'
}