
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
      if (data) {
        setSuppliers(Object.values(data));
      } else {
        setSuppliers([]);
      }
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

    // CORREÇÃO: Recuperação segura de IDs para registros financeiros
    onValue(financialRecordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recordsWithIds = Object.entries(data).map(([key, value]: [string, any]) => ({
          ...value,
          id: value.id || key // Garante que o ID da chave do Firebase seja usado se não houver ID interno
        }));
        setFinancialRecords(recordsWithIds);
      } else {
        setFinancialRecords([]);
      }
    });
  }, []);

  const handleLogin = (name: string, passwordInput: string) => {
    const cleanName = (name || '').trim().toUpperCase();
    const cleanPassNumeric = (passwordInput || '').trim().replace(/\D/g, ''); 
    const cleanPassFull = (passwordInput || '').trim().toLowerCase();

    const isAuthorizedCpf = [
        '15210361870', 
        '29099022859', 
        '29462706821'
    ].includes(cleanPassNumeric);

    const isAdminUser = ['ADMINISTRADOR', 'ADM'].includes(cleanName);
    if (isAdminUser && isAuthorizedCpf) {
      setUser({ name: cleanName, cpf: cleanPassNumeric, role: 'admin' });
      return true;
    }

    const isDouglasUser = [
        'DOUGLAS', 
        'DOUGLAS FERNANDO SEMENZIN GALDINO',
        'DOUGLAS GALDINO'
    ].includes(cleanName);

    if (isDouglasUser && isAuthorizedCpf) {
      setUser({ name: cleanName, cpf: cleanPassNumeric, role: 'financeiro' });
      return true;
    }

    if (cleanName === 'ALMOXARIFADO' && cleanPassFull === 'almox123') {
      setUser({ name: 'ALMOXARIFADO', cpf: 'almox123', role: 'almoxarifado' });
      return true;
    }
    if (cleanName === 'ITESP' && cleanPassFull === 'itesp2026') {
      setUser({ name: 'ITESP', cpf: 'itesp2026', role: 'itesp' });
      return true;
    }
    if (cleanName === 'FINANCEIRO' && cleanPassFull === 'financeiro123') {
      setUser({ name: 'FINANCEIRO', cpf: 'financeiro123', role: 'financeiro' });
      return true;
    }

    const supplier = suppliers.find(s => s.cpf.replace(/\D/g, '') === cleanPassNumeric);
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
    let error: string | null = null;
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
    return error;
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

  const handleReopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData && currentData.deliveries) {
            const invoiceItems = currentData.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
            if (invoiceItems.length > 0) {
                const date = invoiceItems[0].date;
                const time = invoiceItems[0].time || '08:00';
                currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
                currentData.deliveries.push({
                    id: `del-reopen-${Date.now()}`,
                    date,
                    time,
                    item: 'AGENDAMENTO PENDENTE',
                    invoiceUploaded: false
                });
            }
        }
        return currentData;
    });
  };

  const handleDeleteInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData && currentData.deliveries) {
            currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
        }
        return currentData;
    });
  };

  const handleUpdateInvoiceItems = async (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData && currentData.deliveries) {
            const originalItems = currentData.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
            if (originalItems.length > 0) {
                const date = originalItems[0].date;
                const time = originalItems[0].time || '08:00';
                currentData.deliveries = currentData.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
                items.forEach((item, idx) => {
                    currentData.deliveries.push({
                        id: `inv-upd-${Date.now()}-${idx}`,
                        date: date,
                        time: time,
                        item: item.name,
                        kg: item.kg,
                        value: item.value,
                        invoiceUploaded: true,
                        invoiceNumber: invoiceNumber
                    });
                });
            }
        }
        return currentData;
    });
    return { success: true };
  };

  const handleManualInvoiceEntry = async (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => {
    const supplierRef = child(suppliersRef, supplierCpf);
    await runTransaction(supplierRef, (currentData: Supplier) => {
        if (currentData) {
            if (!currentData.deliveries) currentData.deliveries = [];
            items.forEach((item, idx) => {
                currentData.deliveries.push({
                    id: `inv-man-${Date.now()}-${idx}`,
                    date: date,
                    time: '08:00',
                    item: item.name,
                    kg: item.kg,
                    value: item.value,
                    invoiceUploaded: true,
                    invoiceNumber: invoiceNumber
                });
            });
        }
        return currentData;
    });
    return { success: true };
  };

  const handleUpdatePerCapitaConfig = async (config: PerCapitaConfig) => set(perCapitaConfigRef, config);
  const handleRegisterCleaningLog = async (log: any) => {
    const newRef = push(cleaningLogsRef);
    const logWithId = { ...log, id: newRef.key };
    await set(newRef, logWithId);
    return { success: true, message: 'Registrado' };
  };
  const handleDeleteCleaningLog = async (id: string) => remove(child(cleaningLogsRef, id));
  
  // CORREÇÃO: Função de salvaguarda financeira para garantir edição correta
  const handleRegisterFinancialRecord = async (record: any) => {
    // Se já existe um ID, usamos ele para sobrescrever (editar). Caso contrário, criamos um novo (push).
    const id = record.id || push(financialRecordsRef).key;
    const finalRecord = { ...record, id };
    await set(child(financialRecordsRef, id), finalRecord);
    return { success: true };
  };
  const handleDeleteFinancialRecord = async (id: string) => remove(child(financialRecordsRef, id));

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
        onUpdatePerCapitaConfig={handleUpdatePerCapitaConfig}
        cleaningLogs={cleaningLogs}
        onRegisterCleaningLog={handleRegisterCleaningLog}
        onDeleteCleaningLog={handleDeleteCleaningLog}
        financialRecords={financialRecords}
        onSaveFinancialRecord={handleRegisterFinancialRecord}
        onDeleteFinancialRecord={handleDeleteFinancialRecord}
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
        onRegisterEntry={async (p) => ({ success: true, message: 'Ok' })}
        onRegisterWithdrawal={async (p) => ({ success: true, message: 'Ok' })}
        onReopenInvoice={handleReopenInvoice}
        onDeleteInvoice={handleDeleteInvoice}
        onUpdateInvoiceItems={handleUpdateInvoiceItems}
        onManualInvoiceEntry={handleManualInvoiceEntry}
        onDeleteWarehouseEntry={async () => ({ success: true, message: 'Ok' })}
        onUpdateWarehouseEntry={async () => ({ success: true, message: 'Ok' })}
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
    return <AlmoxarifadoDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={handleLogout} onRegisterEntry={async (p) => ({ success: true, message: 'Ok' })} onRegisterWithdrawal={async (p) => ({ success: true, message: 'Ok' })} />;
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

  return <div>Erro ao carregar dados do usuário.</div>;
};

export default App;
