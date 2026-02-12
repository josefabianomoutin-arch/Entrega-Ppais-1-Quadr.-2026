
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, MenuRow, ContractItem, FinancialRecord } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import ItespDashboard from './components/ItespDashboard';
import FinanceDashboard from './components/FinanceDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction, push, child, update, remove } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const suppliersRef = ref(database, 'suppliers');
const warehouseLogRef = ref(database, 'warehouseLog');
const perCapitaConfigRef = ref(database, 'perCapitaConfig');
const cleaningLogsRef = ref(database, 'cleaningLogs');
const directorWithdrawalsRef = ref(database, 'directorWithdrawals');
const standardMenuRef = ref(database, 'standardMenu');
const dailyMenusRef = ref(database, 'dailyMenus');
const financialRecordsRef = ref(database, 'financialRecords');

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; cpf: string; role: 'admin' | 'supplier' | 'almoxarifado' | 'itesp' | 'financeiro' } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [directorWithdrawals, setDirectorWithdrawals] = useState<DirectorPerCapitaLog[]>([]);
  const [standardMenu, setStandardMenu] = useState<StandardMenu>({});
  const [dailyMenus, setDailyMenus] = useState<DailyMenus>({});
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);

  useEffect(() => {
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
  }, []);

  const handleLogin = (nameInput: string, passwordInput: string) => {
    const cleanName = (nameInput || '').trim().toUpperCase();
    const rawPass = (passwordInput || '').trim();
    const numericPass = rawPass.replace(/\D/g, '');

    // 1. Logins Administrativos (Master)
    const adminCpfs = ['15210361870', '29099022859', '29462706821'];
    if (['ADMINISTRADOR', 'ADM', 'GALDINO', 'DOUGLAS'].some(n => cleanName.includes(n))) {
      if (adminCpfs.includes(numericPass)) {
        setUser({ name: cleanName, cpf: numericPass, role: cleanName.includes('DOUGLAS') ? 'financeiro' : 'admin' });
        return true;
      }
    }

    // 2. Setores com Senhas Fixas (Correção Almoxarifado aqui)
    if (cleanName === 'ALMOXARIFADO' || cleanName === 'ALMOX') {
      if (rawPass.toLowerCase() === 'almox123') {
        setUser({ name: 'ALMOXARIFADO', cpf: 'almox123', role: 'almoxarifado' });
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

    // 3. Fornecedores (Busca por CPF no Banco)
    const supplier = suppliers.find(s => s.cpf.replace(/\D/g, '') === numericPass);
    if (supplier) {
      setUser({ name: supplier.name, cpf: supplier.cpf, role: 'supplier' });
      return true;
    }
    
    return false;
  };

  const handleLogout = () => setUser(null);

  const handleRegisterSupplier = async (name: string, cpf: string, allowedWeeks: number[]) => {
    const newSupplier: Supplier = {
      name,
      cpf,
      initialValue: 0,
      contractItems: [],
      deliveries: [],
      allowedWeeks
    };
    await set(child(suppliersRef, cpf), newSupplier);
  };

  const handleUpdateSupplier = async (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]) => {
    const supplierRef = child(suppliersRef, oldCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
      if (currentData) {
        currentData.name = newName;
        currentData.cpf = newCpf;
        currentData.allowedWeeks = newAllowedWeeks;
      }
      return currentData;
    });
    if (oldCpf !== newCpf) {
      const snapshot = await ref(database, `suppliers/${oldCpf}`).get();
      const oldData = snapshot.val();
      await set(child(suppliersRef, newCpf), oldData);
      await remove(child(suppliersRef, oldCpf));
    }
    return null;
  };

  const handleScheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
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
    });
  };

  const handleCancelDeliveries = useCallback(async (supplierCpf: string, deliveryIds: string[]) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
      if (currentData) {
        currentData.deliveries = (currentData.deliveries || []).filter(d => !deliveryIds.includes(d.id));
      }
      return currentData;
    });
  }, []);

  const handleFulfillAndInvoice = async (supplierCpf: string, placeholderIds: string[], invoiceData: any) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
      if (currentData) {
        const sourceDelivery = (currentData.deliveries || []).find(d => placeholderIds.includes(d.id));
        const date = sourceDelivery?.date || new Date().toISOString().split('T')[0];
        const time = sourceDelivery?.time || '08:00';
        currentData.deliveries = (currentData.deliveries || []).filter(d => !placeholderIds.includes(d.id));
        invoiceData.fulfilledItems.forEach((item: any, idx: number) => {
          currentData.deliveries.push({
            id: `inv-${Date.now()}-${idx}`,
            date: date,
            time: time,
            item: item.name,
            kg: item.kg,
            value: item.value,
            invoiceUploaded: true,
            invoiceNumber: invoiceData.invoiceNumber
          });
        });
      }
      return currentData;
    });
  };

  const handleUpdateContractForItem = async (itemName: string, assignments: any[]) => {
    for (const supplier of suppliers) {
      const assignment = assignments.find(a => a.supplierCpf === supplier.cpf);
      const supplierRef = child(suppliersRef, supplier.cpf);
      await runTransaction(supplierRef, (data: Supplier) => {
        if (data) {
          data.contractItems = (data.contractItems || []).filter(ci => ci.name !== itemName);
          if (assignment) {
            data.contractItems.push({
              name: itemName,
              totalKg: assignment.totalKg,
              valuePerKg: assignment.valuePerKg,
              unit: assignment.unit
            });
          }
          data.initialValue = data.contractItems.reduce((acc, curr) => acc + (curr.totalKg * curr.valuePerKg), 0);
        }
        return data;
      });
    }
    return { success: true, message: 'Contratos atualizados' };
  };

  const handleRegisterWarehouseEntry = async (payload: any) => {
    try {
        const newRef = push(warehouseLogRef);
        const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
        const entry: WarehouseMovement = {
            id: newRef.key || `ent-${Date.now()}`,
            type: 'entrada',
            timestamp: new Date().toISOString(),
            date: payload.invoiceDate || new Date().toISOString().split('T')[0],
            itemName: payload.itemName,
            supplierName: supplier?.name || 'Desconhecido',
            lotNumber: payload.lotNumber,
            quantity: payload.quantity,
            inboundInvoice: payload.invoiceNumber,
            expirationDate: payload.expirationDate,
            barcode: payload.barcode || '', // Adicionado código de barras
            lotId: `lot-${Date.now()}`,
            deliveryId: ''
        };
        await set(newRef, entry);
        return { success: true, message: 'Entrada registrada' };
    } catch (e) {
        return { success: false, message: 'Falha na conexão' };
    }
  };

  const handleRegisterWarehouseWithdrawal = async (payload: any) => {
    try {
        const newRef = push(warehouseLogRef);
        const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
        const exit: WarehouseMovement = {
            id: newRef.key || `sai-${Date.now()}`,
            type: 'saída',
            timestamp: new Date().toISOString(),
            date: payload.date || new Date().toISOString().split('T')[0],
            itemName: payload.itemName,
            supplierName: supplier?.name || 'Desconhecido',
            lotNumber: payload.lotNumber || 'SAIDA_AVULSA',
            quantity: payload.quantity,
            outboundInvoice: payload.outboundInvoice,
            expirationDate: payload.expirationDate,
            barcode: payload.barcode || '', // Adicionado código de barras
            lotId: '',
            deliveryId: ''
        };
        await set(newRef, exit);
        return { success: true, message: 'Saída registrada' };
    } catch (e) {
        return { success: false, message: 'Falha na conexão' };
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return (
      <AdminDashboard 
        suppliers={suppliers} 
        onRegister={handleRegisterSupplier}
        onUpdateSupplier={handleUpdateSupplier}
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
        onCancelDeliveries={handleCancelDeliveries}
        onUpdateContractForItem={handleUpdateContractForItem}
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
        onReopenInvoice={async (cpf, nf) => {
            // Lógica simplificada de reabertura para o exemplo
        }}
        onDeleteInvoice={async (cpf, nf) => {
            // Lógica simplificada de exclusão
        }}
        onUpdateInvoiceItems={async () => ({ success: true })}
        onManualInvoiceEntry={async () => ({ success: true })}
        onDeleteWarehouseEntry={async (l) => {
            await remove(child(warehouseLogRef, l.id));
            return { success: true, message: 'Excluído' };
        }}
        onUpdateWarehouseEntry={async (l) => {
            await set(child(warehouseLogRef, l.id), l);
            return { success: true, message: 'Atualizado' };
        }}
        onPersistSuppliers={() => {}}
        onRestoreData={async () => true}
        onResetData={() => {}}
        registrationStatus={null}
        onClearRegistrationStatus={() => {}}
      />
    );
  }

  if (user.role === 'financeiro') {
    return <FinanceDashboard records={financialRecords} onLogout={handleLogout} />;
  }

  if (user.role === 'almoxarifado') {
    return <AlmoxarifadoDashboard 
             suppliers={suppliers} 
             warehouseLog={warehouseLog} 
             onLogout={handleLogout} 
             onRegisterEntry={handleRegisterWarehouseEntry} 
             onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} 
           />;
  }

  if (user.role === 'itesp') {
    return <ItespDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={handleLogout} />;
  }

  const currentSupplier = suppliers.find(s => s.cpf === user.cpf);
  if (currentSupplier) {
    return (
      <Dashboard 
        supplier={currentSupplier} 
        onLogout={handleLogout} 
        onScheduleDelivery={handleScheduleDelivery}
        onFulfillAndInvoice={handleFulfillAndInvoice}
        onCancelDeliveries={handleCancelDeliveries}
        emailModalData={null}
        onCloseEmailModal={() => {}}
      />
    );
  }

  return <div className="p-10 text-center">Usuário não encontrado ou sem permissões.</div>;
};

export default App;
