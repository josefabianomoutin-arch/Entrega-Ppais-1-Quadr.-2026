
export interface Delivery {
  id: string;
  date: string; // ISO string format: 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  arrivalTime?: string; // NOVO: Horário real de chegada na subportaria
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
  barcode?: string; // NOVO: Código de barras global do item
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
  timestamp: string; // Registro do sistema
  date: string;      // Data real do documento (YYYY-MM-DD)
  lotId: string;
  lotNumber: string;
  itemName: string;
  supplierName: string;
  deliveryId: string;
  inboundInvoice?: string;
  outboundInvoice?: string;
  quantity?: number;
  unitPrice?: number; // NOVO
  totalValue?: number; // NOVO
  expirationDate?: string;
  barcode?: string; // Este campo agora armazena o Código de Barras da Nota Fiscal
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
  preparationDetails?: string;
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

export interface FinancialRecord {
  id: string;
  tipo: 'RECURSO' | 'DESPESA';
  ptres: '380302' | '380303' | '380304' | '380308' | '380328';
  selecao: string;
  natureza: '339030' | '339039';
  modalidade: string;
  dataSolicitacao: string;
  valorSolicitado: number;
  dataRecebimento: string;
  valorRecebido: number;
  justificativa: string;
  descricao: string;
  localUtilizado: string;
  valorUtilizado: number;
  numeroProcesso: string;
  dataPagamento: string;
  status: string;
  dataFinalizacaoProcesso: string; // NOVO
  numeroEmpenho: string; // NOVO
}

export type UserRole = 'admin' | 'supplier' | 'almoxarifado' | 'itesp' | 'financeiro' | 'subportaria';
