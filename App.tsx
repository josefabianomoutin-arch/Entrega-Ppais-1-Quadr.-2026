
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, MenuRow, ContractItem, FinancialRecord, UserRole, ThirdPartyEntryLog, AcquisitionItem, VehicleExitOrder, VehicleAsset, DriverAsset, DailyAllowance, Staff, ValidationRole } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import ItespDashboard from './components/ItespDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import SubportariaDashboard from './components/SubportariaDashboard';
import MenuDashboard from './components/MenuDashboard';
import VehicleOrderDashboard from './components/VehicleOrderDashboard';
import JulioDashboard from './components/JulioDashboard';
import { getDatabase, ref, onValue, set, runTransaction, push, child, update, remove, get } from 'firebase/database';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { app, storage } from './firebaseConfig';

let database: any;
let rootRef: any;
let suppliersRef: any;
let warehouseLogRef: any;
let perCapitaConfigRef: any;
let cleaningLogsRef: any;
let directorWithdrawalsRef: any;
let standardMenuRef: any;
let dailyMenusRef: any;
let financialRecordsRef: any;
let thirdPartyEntriesRef: any;
let acquisitionItemsRef: any;
let vehicleExitOrdersRef: any;
let vehicleAssetsRef: any;
let driverAssetsRef: any;
let dailyAllowancesRef: any;
let staffRef: any;
let validationRolesRef: any;

try {
  database = getDatabase(app);
  rootRef = ref(database);
  suppliersRef = ref(database, 'suppliers');
  warehouseLogRef = ref(database, 'warehouseLog');
  perCapitaConfigRef = ref(database, 'perCapitaConfig');
  cleaningLogsRef = ref(database, 'cleaningLogs');
  directorWithdrawalsRef = ref(database, 'directorWithdrawals');
  standardMenuRef = ref(database, 'standardMenu');
  dailyMenusRef = ref(database, 'dailyMenus');
  financialRecordsRef = ref(database, 'financialRecords');
  thirdPartyEntriesRef = ref(database, 'thirdPartyEntries');
  acquisitionItemsRef = ref(database, 'acquisitionItems');
  vehicleExitOrdersRef = ref(database, 'vehicleExitOrders');
  vehicleAssetsRef = ref(database, 'vehicleAssets');
  driverAssetsRef = ref(database, 'driverAssets');
  dailyAllowancesRef = ref(database, 'dailyAllowances');
  staffRef = ref(database, 'staff');
  validationRolesRef = ref(database, 'validationRoles');
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; cpf: string; role: UserRole } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [directorWithdrawals, setDirectorWithdrawals] = useState<DirectorPerCapitaLog[]>([]);
  const [standardMenu, setStandardMenu] = useState<StandardMenu>({});
  const [dailyMenus, setDailyMenus] = useState<DailyMenus>({});
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [thirdPartyEntries, setThirdPartyEntries] = useState<ThirdPartyEntryLog[]>([]);
  const [acquisitionItems, setAcquisitionItems] = useState<AcquisitionItem[]>([]);
  const [vehicleExitOrders, setVehicleExitOrders] = useState<VehicleExitOrder[]>([]);
  const [vehicleAssets, setVehicleAssets] = useState<VehicleAsset[]>([]);
  const [driverAssets, setDriverAssets] = useState<DriverAsset[]>([]);
  const [dailyAllowances, setDailyAllowances] = useState<DailyAllowance[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [validationRoles, setValidationRoles] = useState<ValidationRole[]>([]);

  useEffect(() => {
    if (!database) return;

    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log("Conectado ao Firebase Realtime Database!");
      } else {
        console.warn("Desconectado do Firebase Realtime Database.");
      }
    });

    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      setSuppliers(data ? Object.values(data) : []);
    });
    onValue(warehouseLogRef, (snapshot) => {
      const data = snapshot.val();
      setWarehouseLog(data ? Object.values(data) : []);
    });
    onValue(perCapitaConfigRef, (snapshot) => {
      setPerCapitaConfig(snapshot.val() || {});
    });
    onValue(cleaningLogsRef, (snapshot) => {
      const data = snapshot.val();
      setCleaningLogs(data ? Object.values(data) : []);
    });
    onValue(directorWithdrawalsRef, (snapshot) => {
      const data = snapshot.val();
      setDirectorWithdrawals(data ? Object.values(data) : []);
    });
    onValue(standardMenuRef, (snapshot) => {
      setStandardMenu(snapshot.val() || {});
    });
    onValue(dailyMenusRef, (snapshot) => {
      setDailyMenus(snapshot.val() || {});
    });
    onValue(financialRecordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recordsWithIds = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: value.id || key
        }));
        setFinancialRecords(recordsWithIds);
      } else {
        setFinancialRecords([]);
      }
    });
    onValue(thirdPartyEntriesRef, (snapshot) => {
      const data = snapshot.val();
      setThirdPartyEntries(data ? Object.values(data) : []);
    });
    onValue(acquisitionItemsRef, (snapshot) => {
      const data = snapshot.val();
      setAcquisitionItems(data ? Object.values(data) : []);
    });
    onValue(vehicleExitOrdersRef, (snapshot) => {
      const data = snapshot.val();
      setVehicleExitOrders(data ? Object.values(data) : []);
    });
    onValue(vehicleAssetsRef, (snapshot) => {
      const data = snapshot.val();
      setVehicleAssets(data ? Object.values(data) : []);
    });
    onValue(driverAssetsRef, (snapshot) => {
      const data = snapshot.val();
      setDriverAssets(data ? Object.values(data) : []);
    });
    onValue(dailyAllowancesRef, (snapshot) => {
      const data = snapshot.val();
      setDailyAllowances(data ? Object.values(data) : []);
    });
    onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      setStaff(data ? Object.values(data) : []);
    });
    onValue(validationRolesRef, (snapshot) => {
      const data = snapshot.val();
      setValidationRoles(data ? Object.values(data) : []);
    });
  }, []);

  const handleLogin = (nameInput: string, passwordInput: string) => {
    const cleanName = (nameInput || '').trim().toUpperCase();
    const rawPass = (passwordInput || '').trim();
    const numericPass = rawPass.replace(/\D/g, '');

    // ACESSO ESPECÍFICO: DANIELE GARCIA POSSIDONIO
    if (cleanName.includes('DANIELE') && numericPass === '33342143894') {
      setUser({ name: 'DANIELE GARCIA POSSIDONIO', cpf: numericPass, role: 'financeiro' });
      return true;
    }

    const adminCpfs = ['15210361870', '29099022859', '29462706821', '36554895876'];
    if (['ADMINISTRADOR', 'ADM', 'GALDINO', 'DOUGLAS', 'ALFREDO'].some(n => cleanName.includes(n))) {
      if (adminCpfs.includes(numericPass)) {
        const isFinanceAdmin = cleanName.includes('DOUGLAS') || cleanName.includes('ALFREDO');
        setUser({ name: cleanName, cpf: numericPass, role: isFinanceAdmin ? 'financeiro' : 'admin' });
        return true;
      }
    }

    if (cleanName === 'ALMOXARIFADO' || cleanName === 'ALMOX') {
      if (rawPass.toLowerCase() === 'almoxarifado123') {
        setUser({ name: 'ALMOXARIFADO', cpf: 'almoxarifado123', role: 'almoxarifado' });
        return true;
      }
    }
    if (cleanName === 'ITESP' && rawPass.toLowerCase() === 'taiuvaitesp2026') {
      setUser({ name: 'ITESP', cpf: 'taiuvaitesp2026', role: 'itesp' });
      return true;
    }
    if (cleanName === 'FINANCEIRO' && rawPass.toLowerCase() === 'financeiro123') {
      setUser({ name: 'FINANCEIRO', cpf: 'financeiro123', role: 'financeiro' });
      return true;
    }
    if (cleanName === 'CARDAPIO' && rawPass.toLowerCase() === 'cardapio123') {
      setUser({ name: 'CARDAPIO', cpf: 'cardapio123', role: 'cardapio' });
      return true;
    }
    if (cleanName === 'SEGURANÇA EXTERNA' && rawPass === 'externa2026') {
      setUser({ name: 'SEGURANÇA EXTERNA', cpf: 'externa2026', role: 'subportaria' });
      return true;
    }
    if (cleanName === 'INFRAESTRUTURA' && rawPass === 'infra2026') {
      setUser({ name: 'INFRAESTRUTURA', cpf: 'infra2026', role: 'infraestrutura' });
      return true;
    }
    if (cleanName === 'ORDEM DE SAIDA' && rawPass === 'saida2026') {
      setUser({ name: 'ORDEM DE SAIDA', cpf: 'saida2026', role: 'ordem_saida' });
      return true;
    }
    if (cleanName === 'JULIO CESAR NOGUEIRA' && numericPass === '431385464') {
      setUser({ name: 'JULIO CESAR NOGUEIRA', cpf: '431385464', role: 'julio' });
      return true;
    }
    const supplier = suppliers.find(s => s.cpf.replace(/\D/g, '') === numericPass);
    if (supplier) {
      setUser({ name: supplier.name, cpf: supplier.cpf, role: 'supplier' });
      return true;
    }

    const ppaisProducer = perCapitaConfig.ppaisProducers?.find(p => p.cpfCnpj.replace(/\D/g, '') === numericPass);
    if (ppaisProducer) {
      setUser({ name: ppaisProducer.name, cpf: ppaisProducer.cpfCnpj, role: 'producer' });
      return true;
    }

    const pereciveisSupplier = perCapitaConfig.pereciveisSuppliers?.find(p => p.cpfCnpj.replace(/\D/g, '') === numericPass);
    if (pereciveisSupplier) {
      setUser({ name: pereciveisSupplier.name, cpf: pereciveisSupplier.cpfCnpj, role: 'pereciveis_supplier' });
      return true;
    }
    
    return false;
  };

  const handleLogout = () => setUser(null);

  const handleRestoreFullBackup = async (fullData: any) => {
    try {
        await set(rootRef, fullData);
        return true;
    } catch (e) {
        console.error("Erro na restauração:", e);
        return false;
    }
  };

  const handleRegisterSupplier = async (name: string, cpf: string, allowedWeeks: number[]) => {
    try {
      console.log('Tentando registrar fornecedor:', { name, cpf, allowedWeeks });
      const newSupplier: Supplier = {
        name,
        cpf,
        initialValue: 0,
        contractItems: [],
        deliveries: [],
        allowedWeeks
      };
      await set(child(suppliersRef, cpf), newSupplier);
      console.log('Fornecedor registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar fornecedor:', error);
      throw error;
    }
  };

  const handleUpdateSupplier = async (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]) => {
    try {
      console.log('Tentando atualizar fornecedor:', { oldCpf, newName, newCpf, newAllowedWeeks });
      const supplierRef = child(suppliersRef, oldCpf);
      
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar fornecedor')), 10000));
      
      await Promise.race([
        runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData) {
            currentData.name = newName;
            currentData.cpf = newCpf;
            currentData.allowedWeeks = newAllowedWeeks;
          }
          return currentData;
        }),
        timeoutPromise
      ]);

      if (oldCpf !== newCpf) {
        const snapshot = await get(child(suppliersRef, oldCpf));
        const oldData = snapshot.val();
        await set(child(suppliersRef, newCpf), oldData);
        await remove(child(suppliersRef, oldCpf));
      }
      console.log('Fornecedor atualizado com sucesso!');
      return null;
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      return 'Erro ao atualizar fornecedor: ' + (error instanceof Error ? error.message : String(error));
    }
  };

  const handleUpdateSupplierObservations = async (cpf: string, observations: string) => {
    try {
      const supplierRef = child(suppliersRef, cpf);
      await update(supplierRef, { observations });
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar observações do fornecedor:', error);
      return { success: false, message: String(error) };
    }
  };

  const handleScheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    try {
      // Check main suppliers
      const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
      if (isMainSupplier) {
        const supplierRef = child(suppliersRef, supplierCpf);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao agendar entrega')), 10000));
        
        await Promise.race([
          runTransaction(supplierRef, (currentData: Supplier) => {
            if (currentData) {
              const deliveries = currentData.deliveries || [];
              deliveries.push({
                id: `del-${Date.now()}`,
                date,
                time,
                item: 'AGENDAMENTO PENDENTE',
                invoiceUploaded: false
              });
              currentData.deliveries = deliveries;
            }
            return currentData;
          }),
          timeoutPromise
        ]);
        return;
      }

      // Check Per Capita suppliers
      const timeoutPromisePC = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao agendar entrega Per Capita')), 10000));
      await Promise.race([
        runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
          if (currentData) {
            const findAndAdd = (list: any[] | undefined) => {
              const s = list?.find(p => p.cpfCnpj === supplierCpf);
              if (s) {
                const deliveries = s.deliveries || [];
                deliveries.push({
                  id: `del-${Date.now()}`,
                  date,
                  time,
                  item: 'AGENDAMENTO PENDENTE',
                  invoiceUploaded: false
                });
                s.deliveries = deliveries;
                return true;
              }
              return false;
            };
            if (!findAndAdd(currentData.ppaisProducers)) {
              findAndAdd(currentData.pereciveisSuppliers);
            }
          }
          return currentData;
        }),
        timeoutPromisePC
      ]);
    } catch (error) {
      console.error('Erro ao agendar entrega:', error);
      // alert is not allowed, but this function doesn't return anything to the UI easily
      // We'll just log it for now.
    }
  };

  const handleCancelDeliveries = useCallback(async (supplierCpf: string, deliveryIds: string[]) => {
    const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
    if (isMainSupplier) {
      const supplierRef = child(suppliersRef, supplierCpf);
      await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData) {
          currentData.deliveries = (currentData.deliveries || []).filter(d => !deliveryIds.includes(d.id));
        }
        return currentData;
      });
      return;
    }

    await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
      if (currentData) {
        const findAndCancel = (list: any[] | undefined) => {
          const s = list?.find(p => p.cpfCnpj === supplierCpf);
          if (s) {
            s.deliveries = (s.deliveries || []).filter((d: any) => !deliveryIds.includes(d.id));
            return true;
          }
          return false;
        };
        if (!findAndCancel(currentData.ppaisProducers)) {
          findAndCancel(currentData.pereciveisSuppliers);
        }
      }
      return currentData;
    });
  }, [suppliers]);

  const handleSaveInvoice = useCallback(async (supplierCpf: string, deliveryIds: string[], invoiceNumber: string, invoiceUrl: string) => {
    try {
      let finalInvoiceUrl = invoiceUrl;
      if (invoiceUrl.startsWith('data:')) {
        try {
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.pdf`;
          const fileRef = storageRef(storage, `invoices/${invoiceId}`);
          await uploadString(fileRef, invoiceUrl, 'data_url');
          finalInvoiceUrl = await getDownloadURL(fileRef);
        } catch (storageError) {
          console.error("Storage failed, falling back to RTDB", storageError);
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const invoiceRef = child(ref(database), `invoices/${invoiceId}`);
          await set(invoiceRef, invoiceUrl);
          finalInvoiceUrl = `rtdb://invoices/${invoiceId}`;
        }
      }

      const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
      if (isMainSupplier) {
        const supplierRef = child(suppliersRef, supplierCpf);
        await runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData) {
            const deliveries = currentData.deliveries || [];
            deliveries.forEach(d => {
              if (deliveryIds.includes(d.id)) {
                d.invoiceUploaded = true;
                d.invoiceNumber = invoiceNumber;
                d.invoiceUrl = finalInvoiceUrl;
              }
            });
            currentData.deliveries = deliveries;
          }
          return currentData;
        });
        return;
      }

      await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
        if (currentData) {
          const findAndUpdate = (list: any[] | undefined) => {
            const s = list?.find(p => p.cpfCnpj === supplierCpf);
            if (s) {
              const deliveries = s.deliveries || [];
              deliveries.forEach((d: any) => {
                if (deliveryIds.includes(d.id)) {
                  d.invoiceUploaded = true;
                  d.invoiceNumber = invoiceNumber;
                  d.invoiceUrl = finalInvoiceUrl;
                }
              });
              s.deliveries = deliveries;
              return true;
            }
            return false;
          };
          if (!findAndUpdate(currentData.ppaisProducers)) {
            findAndUpdate(currentData.pereciveisSuppliers);
          }
        }
        return currentData;
      });
    } catch (error) {
      console.error('Erro ao salvar nota fiscal:', error);
      throw new Error('Falha ao salvar nota fiscal: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [suppliers]);

  const handleMarkArrival = async (supplierCpf: string, deliveryId: string) => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
    if (isMainSupplier) {
      const supplierRef = child(suppliersRef, supplierCpf);
      await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData && currentData.deliveries) {
          currentData.deliveries = currentData.deliveries.map(d => {
            if (d.id === deliveryId) {
              return { ...d, arrivalTime: currentTime };
            }
            return d;
          });
        }
        return currentData;
      });
      return;
    }

    await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
      if (currentData) {
        const findAndMark = (list: any[] | undefined) => {
          const s = list?.find(p => p.cpfCnpj === supplierCpf);
          if (s && s.deliveries) {
            s.deliveries = s.deliveries.map((d: any) => {
              if (d.id === deliveryId) {
                return { ...d, arrivalTime: currentTime };
              }
              return d;
            });
            return true;
          }
          return false;
        };
        if (!findAndMark(currentData.ppaisProducers)) {
          findAndMark(currentData.pereciveisSuppliers);
        }
      }
      return currentData;
    });
  };

  // --- GERENCIAMENTO DE NOTAS FISCAIS (ADMIN) ---

  const handleUpdateInvoiceItems = async (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, newInvoiceNumber?: string, newDate?: string, receiptTermNumber?: string, invoiceDate?: string) => {
    const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
    if (isMainSupplier) {
      const supplierRef = child(suppliersRef, supplierCpf);
      try {
        await runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData && currentData.deliveries) {
            const existingForNf = currentData.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
            if (existingForNf.length === 0) return currentData;

            const baseDate = newDate || existingForNf[0].date;
            const baseTime = existingForNf[0].time;
            const finalInvoiceNumber = newInvoiceNumber || invoiceNumber;
            const finalReceiptTerm = receiptTermNumber !== undefined ? receiptTermNumber : existingForNf[0].receiptTermNumber;
            const finalInvoiceDate = invoiceDate !== undefined ? invoiceDate : existingForNf[0].invoiceDate;
            const existingInvoiceUrl = existingForNf.find(d => d.invoiceUrl)?.invoiceUrl;

            // Remove itens antigos daquela nota
            currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);

            // Insere novos itens editados
            items.forEach((item, idx) => {
              currentData.deliveries.push({
                id: `inv-edit-${Date.now()}-${idx}`,
                date: baseDate,
                time: baseTime,
                item: item.name,
                kg: item.kg,
                value: item.value,
                invoiceUploaded: true,
                invoiceNumber: String(finalInvoiceNumber || '').trim(),
                invoiceUrl: existingInvoiceUrl,
                invoiceDate: finalInvoiceDate,
                barcode: barcode,
                receiptTermNumber: finalReceiptTerm,
                lots: [{
                  id: `lot-edit-${Date.now()}-${idx}`,
                  lotNumber: item.lotNumber || 'EDITADO',
                  initialQuantity: item.kg,
                  remainingQuantity: item.kg,
                  expirationDate: item.expirationDate
                }]
              });
            });
          }
          return currentData;
        });
        return { success: true };
      } catch (e) {
        console.error('Erro detalhado ao gravar no banco de dados (MainSupplier):', e);
        return { success: false, message: 'Erro ao gravar no banco de dados: ' + (e instanceof Error ? e.message : String(e)) };
      }
      return;
    }

    try {
      await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
        if (currentData) {
          const findAndUpdate = (list: any[] | undefined) => {
            const s = list?.find(p => p.cpfCnpj === supplierCpf);
            if (s && s.deliveries) {
              const existingForNf = s.deliveries.filter((d: any) => d.invoiceNumber === invoiceNumber);
              if (existingForNf.length === 0) return false;

              const baseDate = newDate || existingForNf[0].date;
              const baseTime = existingForNf[0].time;
              const finalInvoiceNumber = newInvoiceNumber || invoiceNumber;
              const finalReceiptTerm = receiptTermNumber !== undefined ? receiptTermNumber : existingForNf[0].receiptTermNumber;
              const finalInvoiceDate = invoiceDate !== undefined ? invoiceDate : existingForNf[0].invoiceDate;
              const existingInvoiceUrl = existingForNf.find((d: any) => d.invoiceUrl)?.invoiceUrl;

              s.deliveries = s.deliveries.filter((d: any) => d.invoiceNumber !== invoiceNumber);

              items.forEach((item, idx) => {
                s.deliveries.push({
                  id: `inv-edit-${Date.now()}-${idx}`,
                  date: baseDate,
                  time: baseTime,
                  item: item.name,
                  kg: item.kg,
                  value: item.value,
                  invoiceUploaded: true,
                  invoiceNumber: String(finalInvoiceNumber || '').trim(),
                  invoiceUrl: existingInvoiceUrl,
                  invoiceDate: finalInvoiceDate,
                  barcode: barcode,
                  receiptTermNumber: finalReceiptTerm,
                  lots: [{
                    id: `lot-edit-${Date.now()}-${idx}`,
                    lotNumber: item.lotNumber || 'EDITADO',
                    initialQuantity: item.kg,
                    remainingQuantity: item.kg,
                    expirationDate: item.expirationDate
                  }]
                });
              });
              return true;
            }
            return false;
          };
          if (!findAndUpdate(currentData.ppaisProducers)) {
            findAndUpdate(currentData.pereciveisSuppliers);
          }
        }
        return currentData;
      });
      return { success: true };
    } catch (e) {
      console.error('Erro detalhado ao gravar no banco de dados (PerCapita):', e);
      return { success: false, message: 'Erro ao gravar no banco de dados: ' + (e instanceof Error ? e.message : String(e)) };
    }
  };

  const handleUpdateInvoiceUrl = useCallback(async (supplierCpf: string, invoiceNumber: string, invoiceUrl: string) => {
    let finalInvoiceUrl = invoiceUrl;
    if (invoiceUrl.startsWith('data:')) {
      try {
        const invoiceId = `inv_upd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.pdf`;
        const fileRef = storageRef(storage, `invoices/${invoiceId}`);
        await uploadString(fileRef, invoiceUrl, 'data_url');
        finalInvoiceUrl = await getDownloadURL(fileRef);
      } catch (storageError) {
        console.warn("Storage failed, falling back to RTDB", storageError);
        try {
          const invoiceId = `inv_upd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const invoiceRef = child(ref(database), `invoices/${invoiceId}`);
          await set(invoiceRef, invoiceUrl);
          finalInvoiceUrl = `rtdb://invoices/${invoiceId}`;
        } catch (e) {
          console.error("Error saving invoice PDF to RTDB:", e);
          return { success: false, message: 'Erro ao salvar o arquivo PDF.' };
        }
      }
    }

    const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
    if (isMainSupplier) {
      const supplierRef = child(suppliersRef, supplierCpf);
      try {
        await runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData && currentData.deliveries) {
            currentData.deliveries = currentData.deliveries.map(d => {
                if (d.invoiceNumber === invoiceNumber) {
                    return { ...d, invoiceUrl: finalInvoiceUrl };
                }
                return d;
            });
          }
          return currentData;
        });
        return { success: true };
      } catch (e) {
        return { success: false, message: 'Erro ao gravar no banco de dados.' };
      }
    }

    try {
      await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
        if (currentData) {
          const findAndUpdate = (list: any[] | undefined) => {
            const s = list?.find(p => p.cpfCnpj === supplierCpf);
            if (s && s.deliveries) {
              s.deliveries = s.deliveries.map((d: any) => {
                  if (d.invoiceNumber === invoiceNumber) {
                      return { ...d, invoiceUrl: finalInvoiceUrl };
                  }
                  return d;
              });
              return true;
            }
            return false;
          };
          if (!findAndUpdate(currentData.ppaisProducers)) {
            findAndUpdate(currentData.pereciveisSuppliers);
          }
        }
        return currentData;
      });
      return { success: true };
    } catch (e) {
      return { success: false, message: 'Erro ao gravar no banco de dados.' };
    }
  }, [suppliers, suppliersRef, perCapitaConfigRef]);

  const handleReopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
    if (isMainSupplier) {
      const supplierRef = child(suppliersRef, supplierCpf);
      await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData && currentData.deliveries) {
          const entriesForNf = currentData.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
          if (entriesForNf.length === 0) return currentData;

          const baseDate = entriesForNf[0].date;
          const baseTime = entriesForNf[0].time;

          // Remove itens faturados
          currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);

          // Volta para um agendamento pendente
          currentData.deliveries.push({
            id: `reopen-${Date.now()}`,
            date: baseDate,
            time: baseTime,
            item: 'AGENDAMENTO PENDENTE',
            invoiceUploaded: false
          });
        }
        return currentData;
      });
      return;
    }

    await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
      if (currentData) {
        const findAndReopen = (list: any[] | undefined) => {
          const s = list?.find(p => p.cpfCnpj === supplierCpf);
          if (s && s.deliveries) {
            const entriesForNf = s.deliveries.filter((d: any) => d.invoiceNumber === invoiceNumber);
            if (entriesForNf.length === 0) return false;

            const baseDate = entriesForNf[0].date;
            const baseTime = entriesForNf[0].time;

            s.deliveries = s.deliveries.filter((d: any) => d.invoiceNumber !== invoiceNumber);

            s.deliveries.push({
              id: `reopen-${Date.now()}`,
              date: baseDate,
              time: baseTime,
              item: 'AGENDAMENTO PENDENTE',
              invoiceUploaded: false
            });
            return true;
          }
          return false;
        };
        if (!findAndReopen(currentData.ppaisProducers)) {
          findAndReopen(currentData.pereciveisSuppliers);
        }
      }
      return currentData;
    });
  };

  const handleDeleteInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    try {
      const isMainSupplier = suppliers.some(s => s.cpf === supplierCpf);
      if (isMainSupplier) {
        const supplierRef = child(suppliersRef, supplierCpf);
        console.log('Iniciando transação de exclusão para MainSupplier:', supplierCpf);
        await runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData && currentData.deliveries) {
            currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
          }
          return currentData;
        });
        console.log('Transação de exclusão concluída para MainSupplier');
        return { success: true };
      }

      console.log('Iniciando transação de exclusão para PerCapita');
      await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
        if (currentData) {
          const findAndDelete = (list: any[] | undefined) => {
            const s = list?.find(p => p.cpfCnpj === supplierCpf);
            if (s && s.deliveries) {
              s.deliveries = s.deliveries.filter((d: any) => d.invoiceNumber !== invoiceNumber);
              return true;
            }
            return false;
          };
          if (!findAndDelete(currentData.ppaisProducers)) {
            findAndDelete(currentData.pereciveisSuppliers);
          }
        }
        return currentData;
      });
      console.log('Transação de exclusão concluída para PerCapita');
      return { success: true };
    } catch (error) {
      console.error('Erro detalhado ao excluir nota fiscal:', error);
      return { success: false, message: 'Erro ao excluir nota fiscal: ' + (error instanceof Error ? error.message : String(error)) };
    }
  };

  const handleManualInvoiceEntry = async (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, receiptTermNumber?: string, invoiceDate?: string) => {
    let supplierName = '';
    const mainSupplier = suppliers.find(s => s.cpf === supplierCpf);
    if (mainSupplier) {
      supplierName = mainSupplier.name;
    } else {
      const p = perCapitaConfig.ppaisProducers?.find(s => s.cpfCnpj === supplierCpf) || 
                perCapitaConfig.pereciveisSuppliers?.find(s => s.cpfCnpj === supplierCpf);
      if (p) supplierName = p.name;
    }

    if (!supplierName) return { success: false, message: 'Fornecedor não encontrado.' };

    try {
      // 1. Registrar no log do almoxarifado primeiro
      const logEntries: { ref: any, entry: any, lotId: string }[] = items.map((item, idx) => {
        const newLogRef = push(warehouseLogRef);
        const lotId = `lot-manual-${Date.now()}-${idx}`;
        const entry: any = {
            id: newLogRef.key || `ent-man-${Date.now()}-${idx}`,
            type: 'entrada',
            timestamp: new Date().toISOString(),
            date: invoiceDate || date,
            itemName: item.name,
            supplierName: supplierName,
            lotNumber: item.lotNumber || 'MANUAL',
            quantity: item.kg,
            inboundInvoice: String(invoiceNumber || '').trim(),
            barcode: barcode || '',
            lotId: lotId,
            deliveryId: ''
        };
        if (item.expirationDate !== undefined) entry.expirationDate = item.expirationDate;

        return { ref: newLogRef, entry, lotId };
      });

      // Salva todos os logs
      await Promise.all(logEntries.map(le => set(le.ref, le.entry)));

      // 2. Sincronizar com as entregas do fornecedor
      if (mainSupplier) {
        const supplierRef = child(suppliersRef, supplierCpf);
        await runTransaction(supplierRef, (currentData: Supplier) => {
          if (currentData) {
            const deliveries = currentData.deliveries || [];
            logEntries.forEach((le, idx) => {
              const item = items[idx];
              deliveries.push({
                id: `manual-${Date.now()}-${idx}`,
                date,
                time: '08:00',
                item: item.name,
                kg: item.kg,
                value: item.value,
                invoiceUploaded: true,
                invoiceNumber: String(invoiceNumber || '').trim(),
                invoiceDate: invoiceDate,
                barcode: barcode,
                receiptTermNumber: receiptTermNumber,
                lots: [{
                  id: le.lotId,
                  lotNumber: item.lotNumber || 'MANUAL',
                  initialQuantity: item.kg,
                  remainingQuantity: item.kg,
                  expirationDate: item.expirationDate
                }]
              });
            });
            currentData.deliveries = deliveries;
          }
          return currentData;
        });
      } else {
        await runTransaction(perCapitaConfigRef, (currentData: PerCapitaConfig) => {
          if (currentData) {
            const findAndAdd = (list: any[] | undefined) => {
              const s = list?.find(p => p.cpfCnpj === supplierCpf);
              if (s) {
                const deliveries = s.deliveries || [];
                logEntries.forEach((le, idx) => {
                  const item = items[idx];
                  deliveries.push({
                    id: `manual-${Date.now()}-${idx}`,
                    date,
                    time: '08:00',
                    item: item.name,
                    kg: item.kg,
                    value: item.value,
                    invoiceUploaded: true,
                    invoiceNumber: String(invoiceNumber || '').trim(),
                    invoiceDate: invoiceDate,
                    barcode: barcode,
                    receiptTermNumber: receiptTermNumber,
                    lots: [{
                      id: le.lotId,
                      lotNumber: item.lotNumber || 'MANUAL',
                      initialQuantity: item.kg,
                      remainingQuantity: item.kg,
                      expirationDate: item.expirationDate
                    }]
                  });
                });
                s.deliveries = deliveries;
                return true;
              }
              return false;
            };
            if (!findAndAdd(currentData.ppaisProducers)) {
              findAndAdd(currentData.pereciveisSuppliers);
            }
          }
          return currentData;
        });
      }

      return { success: true };
    } catch (e) {
      console.error("Erro no lançamento manual:", e);
      return { success: false, message: 'Falha no lançamento manual.' };
    }
  };

  // --- FIM GERENCIAMENTO NOTAS ---

  const handleUpdateContractForItem = async (itemName: string, assignments: any[]) => {
    try {
      console.log('Tentando atualizar contratos para o item:', itemName, 'Assignments:', assignments);
      
      // Identificar fornecedores que PRECISAM ser atualizados:
      // 1. Fornecedores que estão nos novos assignments
      // 2. Fornecedores que atualmente possuem o item mas não estão nos novos assignments
      const suppliersToUpdate = suppliers.filter(s => {
        const isAssigned = assignments.some(a => a.supplierCpf === s.cpf);
        const hasItem = (s.contractItems || []).some(ci => ci.name === itemName);
        return isAssigned || hasItem;
      });

      console.log('Total de fornecedores afetados:', suppliersToUpdate.length);
      
      let count = 0;
      // Processar em pequenos lotes ou sequencialmente mas apenas os afetados
      for (const supplier of suppliersToUpdate) {
        count++;
        const assignment = assignments.find(a => a.supplierCpf === supplier.cpf);
        const supplierRef = child(suppliersRef, supplier.cpf);
        
        console.log(`Processando fornecedor ${count}/${suppliersToUpdate.length}: ${supplier.name} (${supplier.cpf})`);
        
        // Tenta a transação com retentativas manuais se necessário, mas o runTransaction já faz isso.
        // Removemos o Promise.race com timeout curto para evitar interromper transações legítimas
        await runTransaction(supplierRef, (data: Supplier) => {
          if (!data) return data; // Se não existir, não faz nada
          
          // Remove o item atual (para atualizar ou deletar)
          const otherItems = (data.contractItems || []).filter(ci => ci.name !== itemName);
          
          if (assignment) {
            // Adiciona o item atualizado
            otherItems.push({
              name: itemName,
              totalKg: assignment.totalKg,
              valuePerKg: assignment.valuePerKg,
              unit: assignment.unit || 'kg-1',
              category: assignment.category || 'OUTROS',
              comprasCode: assignment.comprasCode || '',
              becCode: assignment.becCode || ''
            });
          }
          
          data.contractItems = otherItems;
          // Recalcula o valor inicial do contrato
          data.initialValue = otherItems.reduce((acc, curr) => acc + (Number(curr.totalKg || 0) * Number(curr.valuePerKg || 0)), 0);
          
          return data;
        });
      }
      
      console.log('Contratos atualizados com sucesso!');
      return { success: true, message: 'Contratos atualizados' };
    } catch (error) {
      console.error('Erro ao atualizar contratos:', error);
      return { success: false, message: 'Falha ao atualizar contratos: ' + (error instanceof Error ? error.message : String(error)) };
    }
  };

  const handleUpdateAcquisitionItem = async (item: AcquisitionItem) => {
    const itemRef = child(acquisitionItemsRef, item.id);
    await set(itemRef, item);
  };

  const handleDeleteAcquisitionItem = async (id: string) => {
    const itemRef = child(acquisitionItemsRef, id);
    await remove(itemRef);
  };

  const handleRegisterWarehouseEntry = async (payload: any) => {
    try {
        const newRef = push(warehouseLogRef);
        const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
        const lotId = `lot-${Date.now()}`;
        const entry: any = {
            id: newRef.key || `ent-${Date.now()}`,
            type: 'entrada',
            timestamp: new Date().toISOString(),
            date: payload.invoiceDate || new Date().toISOString().split('T')[0],
            itemName: payload.itemName,
            supplierName: supplier?.name || 'Desconhecido',
            lotNumber: payload.lotNumber,
            quantity: payload.quantity,
            barcode: payload.barcode || '',
            lotId: lotId,
            deliveryId: ''
        };
        if (payload.invoiceNumber !== undefined) entry.inboundInvoice = payload.invoiceNumber;
        if (payload.expirationDate !== undefined) entry.expirationDate = payload.expirationDate;

        await set(newRef, entry);

        // Sincronizar com as entregas do fornecedor para aparecer na Consulta de Notas Fiscais
        if (supplier) {
            const sRef = child(suppliersRef, supplier.cpf);
            await runTransaction(sRef, (currentData: Supplier) => {
                if (currentData) {
                    const deliveries = currentData.deliveries || [];
                    const contract = currentData.contractItems.find(ci => ci.name === payload.itemName);
                    const value = contract ? (payload.quantity * contract.valuePerKg) : 0;
                    
                    deliveries.push({
                        id: `sync-${Date.now()}`,
                        date: payload.invoiceDate || new Date().toISOString().split('T')[0],
                        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        item: payload.itemName,
                        kg: payload.quantity,
                        value: value,
                        invoiceUploaded: true,
                        invoiceNumber: String(payload.invoiceNumber || '').trim(),
                        barcode: payload.barcode || '',
                        lots: [{
                            id: lotId,
                            lotNumber: payload.lotNumber,
                            initialQuantity: payload.quantity,
                            remainingQuantity: payload.quantity,
                            expirationDate: payload.expirationDate
                        }]
                    });
                    currentData.deliveries = deliveries;
                }
                return currentData;
            });
        }

        return { success: true, message: 'Entrada registrada' };
    } catch (e) {
        console.error('Erro ao registrar entrada:', e);
        return { success: false, message: 'Falha na conexão: ' + (e instanceof Error ? e.message : String(e)) };
    }
  };

  const handleRegisterWarehouseWithdrawal = async (payload: any) => {
    try {
        const newRef = push(warehouseLogRef);
        const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
        
        // --- Atualiza o saldo no lote do fornecedor ---
        if (supplier) {
            const sRef = child(suppliersRef, supplier.cpf);
            await runTransaction(sRef, (currentData: Supplier) => {
                if (currentData && currentData.deliveries) {
                    const delivery = currentData.deliveries.find(d => 
                        d.item === payload.itemName && 
                        d.invoiceNumber === payload.inboundInvoice
                    );
                    if (delivery && delivery.lots) {
                        const lot = delivery.lots.find(l => l.lotNumber === payload.lotNumber);
                        if (lot) {
                            lot.remainingQuantity = (lot.remainingQuantity || 0) - payload.quantity;
                        }
                    }
                }
                return currentData;
            });
        }

        const exit: any = {
            id: newRef.key || `sai-${Date.now()}`,
            type: 'saída',
            timestamp: new Date().toISOString(),
            date: payload.date || new Date().toISOString().split('T')[0],
            itemName: payload.itemName,
            supplierName: supplier?.name || 'Desconhecido',
            lotNumber: payload.lotNumber || 'SAIDA_AVULSA',
            quantity: payload.quantity,
            barcode: payload.barcode || '',
            lotId: '',
            deliveryId: ''
        };
        if (payload.inboundInvoice !== undefined) exit.inboundInvoice = payload.inboundInvoice;
        if (payload.outboundInvoice !== undefined) exit.outboundInvoice = payload.outboundInvoice;
        if (payload.expirationDate !== undefined) exit.expirationDate = payload.expirationDate;

        await set(newRef, exit);
        return { success: true, message: 'Saída registrada' };
    } catch (e) {
        console.error('Erro ao registrar saída:', e);
        return { success: false, message: 'Falha na conexão: ' + (e instanceof Error ? e.message : String(e)) };
    }
  };

  const handleResetWarehouseExits = async () => {
    try {
      const snapshot = await get(warehouseLogRef);
      const data = snapshot.val();
      if (data) {
        const updates: any = {};
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          if (value.type === 'saída') {
            updates[key] = null;
          }
        });
        await update(warehouseLogRef, updates);
      }
      return { success: true, message: 'Registros de saída zerados com sucesso.' };
    } catch (e) {
      return { success: false, message: 'Falha ao zerar registros de saída.' };
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return (
      <AdminDashboard 
        user={user}
        suppliers={suppliers} 
        onRegister={handleRegisterSupplier}
        onUpdateSupplier={handleUpdateSupplier}
        onUpdateSupplierObservations={handleUpdateSupplierObservations}
        onLogout={handleLogout}
        warehouseLog={warehouseLog}
        perCapitaConfig={perCapitaConfig}
        onUpdatePerCapitaConfig={(c) => set(perCapitaConfigRef, c)}
        cleaningLogs={cleaningLogs}
        onRegisterCleaningLog={async (l) => {
            const r = push(cleaningLogsRef);
            await set(r, { ...l, id: r.key });
            return { success: true, message: 'Ok' };
        }}
        onDeleteCleaningLog={async (id) => remove(child(cleaningLogsRef, id))}
        financialRecords={financialRecords}
        onSaveFinancialRecord={async (rec) => {
            const id = rec.id || push(financialRecordsRef).key;
            await set(child(financialRecordsRef, id!), { ...rec, id });
            return { success: true };
        }}
        onDeleteFinancialRecord={async (id) => remove(child(financialRecordsRef, id))}
        thirdPartyEntries={thirdPartyEntries}
        onRegisterThirdPartyEntry={async (l) => {
            const r = push(thirdPartyEntriesRef);
            await set(r, { ...l, id: r.key });
            return { success: true, message: 'Ok' };
        }}
        onUpdateThirdPartyEntry={async (log) => {
            await set(child(thirdPartyEntriesRef, log.id), log);
            return { success: true, message: 'Atualizado' };
        }}
        onDeleteThirdPartyEntry={async (id) => remove(child(thirdPartyEntriesRef, id))}
        vehicleExitOrders={vehicleExitOrders}
        onRegisterVehicleExitOrder={async (order) => {
            const r = push(vehicleExitOrdersRef);
            await set(r, { ...order, id: r.key });
            return { success: true, message: 'Ordem de Saída registrada com sucesso!' };
        }}
        onUpdateVehicleExitOrder={async (order) => {
            await set(child(vehicleExitOrdersRef, order.id), order);
            return { success: true, message: 'Ordem de Saída atualizada com sucesso!' };
        }}
        onDeleteVehicleExitOrder={async (id) => remove(child(vehicleExitOrdersRef, id))}
        vehicleAssets={vehicleAssets}
        onRegisterVehicleAsset={async (asset) => {
            const r = push(vehicleAssetsRef);
            await set(r, { ...asset, id: r.key });
            return { success: true, message: 'Veículo registrado' };
        }}
        onUpdateVehicleAsset={async (asset) => {
            await set(child(vehicleAssetsRef, asset.id), asset);
            return { success: true, message: 'Veículo atualizado' };
        }}
        onDeleteVehicleAsset={async (id) => remove(child(vehicleAssetsRef, id))}
        driverAssets={driverAssets}
        onRegisterDriverAsset={async (asset) => {
            const r = push(driverAssetsRef);
            await set(r, { ...asset, id: r.key });
            return { success: true, message: 'Motorista/Acompanhante registrado' };
        }}
        onUpdateDriverAsset={async (asset) => {
            await set(child(driverAssetsRef, asset.id), asset);
            return { success: true, message: 'Motorista/Acompanhante atualizado' };
        }}
        onDeleteDriverAsset={async (id) => remove(child(driverAssetsRef, id))}
        onCancelDeliveries={handleCancelDeliveries}
        onUpdateContractForItem={handleUpdateContractForItem}
        onUpdateAcquisitionItem={handleUpdateAcquisitionItem}
        onDeleteAcquisitionItem={handleDeleteAcquisitionItem}
        acquisitionItems={acquisitionItems}
        directorWithdrawals={directorWithdrawals}
        onRegisterDirectorWithdrawal={async (log) => {
             const newRef = push(directorWithdrawalsRef);
             await set(newRef, { ...log, id: newRef.key });
             return { success: true, message: 'Ok' };
        }}
        onDeleteDirectorWithdrawal={async (id) => remove(child(directorWithdrawalsRef, id))}
        standardMenu={standardMenu}
        dailyMenus={dailyMenus}
        onUpdateStandardMenu={async (m) => set(standardMenuRef, m)}
        onUpdateDailyMenu={async (m) => set(dailyMenusRef, m)}
        onRegisterEntry={handleRegisterWarehouseEntry}
        onRegisterWithdrawal={handleRegisterWarehouseWithdrawal}
        onReopenInvoice={handleReopenInvoice}
        onDeleteInvoice={handleDeleteInvoice}
        onUpdateInvoiceItems={handleUpdateInvoiceItems}
        onUpdateInvoiceUrl={handleUpdateInvoiceUrl}
        onManualInvoiceEntry={handleManualInvoiceEntry}
        onDeleteWarehouseEntry={async (l) => {
            // Se for saída, devolve a quantidade para o saldo do lote
            if (l.type === 'saída') {
                const supplier = suppliers.find(s => s.name === l.supplierName);
                if (supplier) {
                    const sRef = child(suppliersRef, supplier.cpf);
                    await runTransaction(sRef, (currentData: Supplier) => {
                        if (currentData && currentData.deliveries) {
                            const delivery = currentData.deliveries.find(d => 
                                d.item === l.itemName && 
                                d.invoiceNumber === l.inboundInvoice
                            );
                            if (delivery && delivery.lots) {
                                const lot = delivery.lots.find(lotItem => lotItem.lotNumber === l.lotNumber);
                                if (lot) {
                                    lot.remainingQuantity = (lot.remainingQuantity || 0) + l.quantity;
                                }
                            }
                        }
                        return currentData;
                    });
                }
            } else if (l.type === 'entrada') {
                // Se for entrada, remove a entrega correspondente do fornecedor
                const supplier = suppliers.find(s => s.name === l.supplierName);
                if (supplier) {
                    const sRef = child(suppliersRef, supplier.cpf);
                    await runTransaction(sRef, (currentData: Supplier) => {
                        if (currentData && currentData.deliveries) {
                            currentData.deliveries = currentData.deliveries.filter(d => 
                                !(d.item === l.itemName && d.invoiceNumber === l.inboundInvoice && d.barcode === l.barcode)
                            );
                        }
                        return currentData;
                    });
                }
            }
            await remove(child(warehouseLogRef, l.id));
            return { success: true, message: 'Excluído e saldo atualizado' };
        }}
        onUpdateWarehouseEntry={async (l) => {
            await set(child(warehouseLogRef, l.id), l);
            return { success: true, message: 'Atualizado' };
        }}
        onPersistSuppliers={() => {}}
        onRestoreData={async () => true}
        onRestoreFullBackup={handleRestoreFullBackup}
        onResetData={async () => { if(window.confirm('CUIDADO: Isso apagará tudo permanentemente. Continuar?')) await set(rootRef, null); }}
        registrationStatus={null}
        onClearRegistrationStatus={() => {}}
        validationRoles={validationRoles}
      />
    );
  }

  if (user.role === 'financeiro') {
    return <FinanceDashboard 
             records={financialRecords} 
             onLogout={handleLogout} 
             user={user}
             standardMenu={standardMenu}
             dailyMenus={dailyMenus}
             suppliers={suppliers}
             thirdPartyEntries={thirdPartyEntries}
             vehicleExitOrders={vehicleExitOrders}
             vehicleAssets={vehicleAssets}
             driverAssets={driverAssets}
             validationRoles={validationRoles}
           />;
  }

  if (user.role === 'cardapio') {
    return <MenuDashboard standardMenu={standardMenu} dailyMenus={dailyMenus} suppliers={suppliers} onLogout={handleLogout} />;
  }

  if (user.role === 'almoxarifado') {
    return <AlmoxarifadoDashboard 
             suppliers={suppliers} 
             warehouseLog={warehouseLog} 
             onLogout={handleLogout} 
             onRegisterEntry={handleRegisterWarehouseEntry} 
             onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} 
             onResetExits={handleResetWarehouseExits}
             onReopenInvoice={handleReopenInvoice}
             onDeleteInvoice={handleDeleteInvoice}
             onUpdateInvoiceItems={handleUpdateInvoiceItems}
             onManualInvoiceEntry={handleManualInvoiceEntry}
             thirdPartyEntries={thirdPartyEntries}
             onRegisterThirdPartyEntry={async (l) => {
                 const r = push(thirdPartyEntriesRef);
                 await set(r, { ...l, id: r.key });
                 return { success: true, message: 'Ok' };
             }}
             onUpdateThirdPartyEntry={async (log) => {
                 await set(child(thirdPartyEntriesRef, log.id), log);
                 return { success: true, message: 'Atualizado' };
             }}
             onDeleteThirdPartyEntry={async (id) => remove(child(thirdPartyEntriesRef, id))}
             vehicleExitOrders={vehicleExitOrders}
             onRegisterVehicleExitOrder={async (order) => {
                 const r = push(vehicleExitOrdersRef);
                 const id = r.key || `order-${Date.now()}`;
                 await set(r, { ...order, id });
                 return { success: true, message: 'Ok', id };
             }}
             onUpdateVehicleExitOrder={async (order) => {
                 await set(child(vehicleExitOrdersRef, order.id), order);
                 return { success: true, message: 'Atualizado' };
             }}
             onDeleteVehicleExitOrder={async (id) => remove(child(vehicleExitOrdersRef, id))}
             vehicleAssets={vehicleAssets}
             onRegisterVehicleAsset={async (asset) => {
                 const r = push(vehicleAssetsRef);
                 await set(r, { ...asset, id: r.key });
                 return { success: true, message: 'Veículo registrado' };
             }}
             onUpdateVehicleAsset={async (asset) => {
                 await set(child(vehicleAssetsRef, asset.id), asset);
                 return { success: true, message: 'Veículo atualizado' };
             }}
             onDeleteVehicleAsset={async (id) => remove(child(vehicleAssetsRef, id))}
             driverAssets={driverAssets}
             onRegisterDriverAsset={async (asset) => {
                 const r = push(driverAssetsRef);
                 await set(r, { ...asset, id: r.key });
                 return { success: true, message: 'Motorista/Acompanhante registrado' };
             }}
             onUpdateDriverAsset={async (asset) => {
                 await set(child(driverAssetsRef, asset.id), asset);
                 return { success: true, message: 'Motorista/Acompanhante atualizado' };
             }}
             onDeleteDriverAsset={async (id) => remove(child(driverAssetsRef, id))}
             validationRoles={validationRoles}
           />;
  }

  if (user.role === 'julio') {
    return (
      <JulioDashboard
        vehicleExitOrders={vehicleExitOrders}
        driverAssets={driverAssets}
        vehicleAssets={vehicleAssets}
        validationRoles={validationRoles}
        onLogout={handleLogout}
        onRegisterVehicleExitOrder={async (order) => {
          const r = push(vehicleExitOrdersRef);
          await set(r, { ...order, id: r.key });
          return { success: true, message: 'Ordem de saída registrada' };
        }}
        onUpdateVehicleExitOrder={async (order) => {
          await set(child(vehicleExitOrdersRef, order.id), order);
          return { success: true, message: 'Ordem de saída atualizada' };
        }}
        onDeleteVehicleExitOrder={async (id) => remove(child(vehicleExitOrdersRef, id))}
        onRegisterDriverAsset={async (s) => {
          const r = push(driverAssetsRef);
          await set(r, { ...s, id: r.key });
          return { success: true, message: 'Servidor registrado' };
        }}
        onUpdateDriverAsset={async (s) => {
          await set(child(driverAssetsRef, s.id), s);
          return { success: true, message: 'Servidor atualizado' };
        }}
        onDeleteDriverAsset={async (id) => remove(child(driverAssetsRef, id))}
        onRegisterVehicleAsset={async (v) => {
          const r = push(vehicleAssetsRef);
          await set(r, { ...v, id: r.key });
          return { success: true, message: 'Veículo registrado' };
        }}
        onUpdateVehicleAsset={async (v) => {
          await set(child(vehicleAssetsRef, v.id), v);
          return { success: true, message: 'Veículo atualizado' };
        }}
        onDeleteVehicleAsset={async (id) => remove(child(vehicleAssetsRef, id))}
        onRegisterValidationRole={async (vr) => {
          const r = push(validationRolesRef);
          await set(r, { ...vr, id: r.key });
          return { success: true, message: 'Cargo de validação registrado' };
        }}
        onUpdateValidationRole={async (vr) => {
          await set(child(validationRolesRef, vr.id), vr);
          return { success: true, message: 'Cargo de validação atualizado' };
        }}
        onDeleteValidationRole={async (id) => remove(child(validationRolesRef, id))}
      />
    );
  }

  if (user.role === 'itesp') {
    return <ItespDashboard suppliers={suppliers} warehouseLog={warehouseLog} perCapitaConfig={perCapitaConfig} onLogout={handleLogout} />;
  }

  if (user.role === 'subportaria') {
    return (
      <SubportariaDashboard 
        suppliers={suppliers} 
        thirdPartyEntries={thirdPartyEntries}
        onUpdateThirdPartyEntry={async (log) => {
          await set(child(thirdPartyEntriesRef, log.id), log);
          return { success: true, message: 'Atualizado' };
        }}
        onLogout={handleLogout} 
        vehicleExitOrders={vehicleExitOrders}
        vehicleAssets={vehicleAssets}
        driverAssets={driverAssets}
        validationRoles={validationRoles}
        onUpdateVehicleExitOrder={async (order) => {
          await set(child(vehicleExitOrdersRef, order.id), order);
          return { success: true, message: 'Atualizado' };
        }}
        onDeleteThirdPartyEntry={async (id) => remove(child(thirdPartyEntriesRef, id))}
      />
    );
  }

  if (user.role === 'infraestrutura' || user.role === 'ordem_saida') {
    return (
      <VehicleOrderDashboard 
        orders={vehicleExitOrders}
        vehicleAssets={vehicleAssets}
        driverAssets={driverAssets}
        validationRoles={validationRoles}
        onRegister={async (order) => {
          const r = push(vehicleExitOrdersRef);
          const id = r.key || `order-${Date.now()}`;
          await set(r, { ...order, id });
          return { success: true, message: 'Ok', id };
        }}
        onUpdate={async (order) => {
          await set(child(vehicleExitOrdersRef, order.id), order);
          return { success: true, message: 'Atualizado' };
        }}
        onDelete={async (id) => remove(child(vehicleExitOrdersRef, id))}
        onRegisterVehicleAsset={async (v) => {
          const r = push(vehicleAssetsRef);
          await set(r, { ...v, id: r.key });
          return { success: true, message: 'Ok' };
        }}
        onUpdateVehicleAsset={async (v) => {
          await set(child(vehicleAssetsRef, v.id), v);
          return { success: true, message: 'Atualizado' };
        }}
        onDeleteVehicleAsset={async (id) => remove(child(vehicleAssetsRef, id))}
        onRegisterDriverAsset={async (d) => {
          const r = push(driverAssetsRef);
          await set(r, { ...d, id: r.key });
          return { success: true, message: 'Ok' };
        }}
        onUpdateDriverAsset={async (d) => {
          await set(child(driverAssetsRef, d.id), d);
          return { success: true, message: 'Atualizado' };
        }}
        onDeleteDriverAsset={async (id) => remove(child(driverAssetsRef, id))}
        onValidateOrder={async (orderId, validatedBy, validationRole) => {
          const timestamp = new Date().toISOString();
          await update(child(vehicleExitOrdersRef, orderId), {
            validatedBy,
            validationRole,
            validationTimestamp: timestamp
          });
          return { success: true, message: 'Ordem validada' };
        }}
        onLogout={handleLogout}
        role={user.role}
      />
    );
  }

  if (user.role === 'supplier') {
    const currentSupplier = suppliers.find(s => s.cpf === user.cpf);
    if (currentSupplier) {
      return (
        <Dashboard 
          supplier={currentSupplier} 
          onLogout={handleLogout} 
          onScheduleDelivery={handleScheduleDelivery}
          onCancelDeliveries={handleCancelDeliveries}
          onSaveInvoice={handleSaveInvoice}
          emailModalData={null}
          onCloseEmailModal={() => {}}
        />
      );
    }
  }

  if (user.role === 'producer' || user.role === 'pereciveis_supplier') {
    const list = user.role === 'producer' ? perCapitaConfig.ppaisProducers : perCapitaConfig.pereciveisSuppliers;
    const p = list?.find(s => s.cpfCnpj === user.cpf);
    if (p) {
      const mappedSupplier: Supplier = {
        name: p.name,
        cpf: p.cpfCnpj,
        initialValue: 0,
        contractItems: p.contractItems || [],
        deliveries: p.deliveries || [],
        allowedWeeks: []
      };
      return (
        <Dashboard 
          supplier={mappedSupplier} 
          type={user.role === 'producer' ? 'PRODUTOR' : 'FORNECEDOR'}
          monthlySchedule={p.monthlySchedule}
          onLogout={handleLogout} 
          onScheduleDelivery={handleScheduleDelivery}
          onCancelDeliveries={handleCancelDeliveries}
          onSaveInvoice={handleSaveInvoice}
          emailModalData={null}
          onCloseEmailModal={() => {}}
        />
      );
    }
  }

  return <div className="p-10 text-center">Usuário não encontrado ou sem permissões.</div>;
};

export default App;
