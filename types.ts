
export interface Delivery {
  id: string;
  date: string; // ISO string format: 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  item?: string;
  kg?: number;
  value?: number;
  invoiceUploaded: boolean;
  invoiceNumber?: string;
}

export interface ContractItem {
  name: string;
  totalKg: number;
  valuePerKg: number;
  order?: number;
}

export interface Producer {
  name: string;
  cpf: string; // Atua como senha e identificador único
  initialValue: number;
  contractItems: ContractItem[];
  deliveries: Delivery[];
  allowedWeeks: number[];
}
