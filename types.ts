
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
  invoiceUrl?: string;
  invoiceDate?: string; // NOVO: Data de emissão da NF
  barcode?: string; // NOVO: Código de barras da NF
  receiptTermNumber?: string; // NOVO: Número do termo de recebimento
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
  becCode?: string;
  category?: 'KIT PPL' | 'PPAIS' | 'ESTOCÁVEIS' | 'PERECÍVEIS' | 'AUTOMAÇÃO' | 'PRODUTOS DE LIMPEZA' | 'OUTROS';
}

export interface Supplier {
  name: string;
  cpf: string;
  initialValue: number;
  contractItems: ContractItem[];
  deliveries: Delivery[];
  allowedWeeks: number[];
  observations?: string;
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
  expirationDate?: string;
  barcode?: string; // NOVO CAMPO
}

export interface PerCapitaSupplier {
  id: string;
  name: string;
  cpfCnpj: string;
  processNumber: string;
  monthlySchedule: Record<string, number[]>; // month name -> array of week numbers (1-5)
  contractItems?: ContractItem[];
  deliveries?: Delivery[];
}

export interface PerCapitaConfig {
  staffCount?: number;
  inmateCount?: number;
  customValues?: Record<string, string>;
  seiProcessNumbers?: Record<string, string>;
  seiProcessDefinitions?: Record<string, string>;
  monthlyQuota?: Record<string, number>;
  monthlyResource?: Record<string, number>;
  ptresResources?: Record<string, { pieces: number; services: number }>;
  ppaisProducers?: PerCapitaSupplier[];
  pereciveisSuppliers?: PerCapitaSupplier[];
  monthlyAdvances?: Record<string, number>;
}

export interface CleaningLog {
  id: string;
  date: string;
  responsible: string;
  location: string;
  type: 'diaria' | 'semanal' | 'pesada' | 'preventiva' | 'corretiva';
  observations: string;
  maintenanceDetails?: string;
  serviceProcessId?: string;
  partsProcessId?: string;
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
  notaCredito?: string; // NOVO
}

export interface ThirdPartyEntryLog {
  id: string;
  date: string;
  time?: string; // Horário agendado
  locations: string;
  companyName: string;
  companyCnpj: string;
  vehicle?: string; // NOVO
  plate?: string;   // NOVO
  monitoringResponsible: string;
  pestControlResponsible: string;
  serviceExecutionNumber: string;
  contractNumber?: string; // NOVO: Número do contrato
  serviceDetails?: string;
  status: 'agendado' | 'concluido' | 'cancelado';
  arrivalTime?: string; // Horário real de chegada na subportaria
  receiptTermDate?: string;
  photo?: string; // Foto de Cadastro (Base64)
  entryPhoto?: string; // Foto capturada na entrada (Base64)
}

export interface AcquisitionItem {
  id: string;
  name: string;
  comprasCode?: string;
  becCode?: string;
  expenseNature?: string;
  unit: string;
  acquiredQuantity: number;
  stockBalance: number;
  unitValue?: number;
  category: 'KIT PPL' | 'PPAIS' | 'ESTOCÁVEIS' | 'PERECÍVEIS' | 'AUTOMAÇÃO' | 'PRODUTOS DE LIMPEZA';
  contractItemName?: string; // NOVO: Vinculação com item do contrato
}

export interface VehicleAsset {
  id: string;
  model: string;
  plate: string;
  assetNumber: string;
}

export interface DriverAsset {
  id: string;
  name: string;
  role: string;
  cnhCategory: string; // A, B, C, D, E or combinations
  isFitToDrive: boolean;
}

export interface VehicleExitOrder {
  id: string;
  date: string;
  vehicle: string;
  plate: string;
  assetNumber: string;
  responsibleServer: string;
  serverRole: string;
  destination: string;
  fctNumber: string;
  companions: { name: string; rg: string }[];
  exitDate?: string;
  exitTime?: string;
  returnDate?: string;
  returnTime?: string;
  observations?: string;
  pdfUrl?: string;
}

export type UserRole = 'admin' | 'supplier' | 'producer' | 'pereciveis_supplier' | 'almoxarifado' | 'itesp' | 'financeiro' | 'subportaria' | 'cardapio' | 'infraestrutura' | 'ordem_saida' | 'readonly';
