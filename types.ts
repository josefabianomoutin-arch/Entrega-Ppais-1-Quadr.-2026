
export interface Delivery {
  id: string;
  date: string; // ISO string format: 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  item: string;
  kg: number;
  value: number;
  invoiceUploaded: boolean;
  invoiceNumber?: string;
}

export interface ContractItem {
  name: string;
  kg: number;
  value: number;
}

export interface Producer {
  id:string;
  name: string;
  cpf: string; // Acts as password
  initialValue: number;
  contractItems: ContractItem[];
  deliveries: Delivery[];
}