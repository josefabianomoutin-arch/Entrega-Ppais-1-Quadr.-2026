
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

    onValue(financialRecordsRef, (snapshot) => {
      const data = snapshot.val();
      setFinancialRecords(data ? Object.values(data) : []);
    });
  }, []);

  const handleLogin = (name: string, cpf: string) => {
    const upperName = name.toUpperCase();
    if (upperName === 'ADMINISTRADOR' && cpf === '29462706821') {
      setUser({ name: upperName, cpf, role: 'admin' });
      return true;
    }
    if (upperName === 'ALMOXARIFADO' && cpf === 'almox123') {
      setUser({ name: upperName, cpf, role: 'almoxarifado' });
      return true;
    }
    if (upperName === 'ITESP' && cpf === 'itesp2026') {
      setUser({ name: upperName, cpf, role: 'itesp' });
      return true;
    }
    if (upperName === 'FINANCEIRO' && cpf === 'financeiro123') {
      setUser({ name: upperName, cpf, role: 'financeiro' });
      return true;
    }

    const supplier = suppliers.find(s => s.cpf === cpf);
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
      const oldData = (await (await ref(database, `suppliers/${oldCpf}`).get()).val());
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
        // Remove placeholders
        currentData.deliveries = (currentData.deliveries || []).filter(d => !placeholderIds.includes(d.id));
        // Add real items
        invoiceData.fulfilledItems.forEach((item: any, idx: number) => {
          currentData.deliveries.push({
            id: `inv-${Date.now()}-${idx}`,
            date: currentData.deliveries.find(d => placeholderIds.includes(d.id))?.date || new Date().toISOString().split('T')[0],
            time: '08:00',
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

  // Funções simplificadas para as outras abas administrativas
  const handleUpdatePerCapitaConfig = async (config: PerCapitaConfig) => set(perCapitaConfigRef, config);
  const handleRegisterCleaningLog = async (log: any) => {
    const newRef = push(cleaningLogsRef);
    const logWithId = { ...log, id: newRef.key };
    await set(newRef, logWithId);
    return { success: true, message: 'Registrado' };
  };
  const handleDeleteCleaningLog = async (id: string) => remove(child(cleaningLogsRef, id));
  
  const handleRegisterFinancialRecord = async (record: any) => {
    const id = record.id || push(financialRecordsRef).key;
    await set(child(financialRecordsRef, id), { ...record, id });
    return { success: true };
  };
  const handleDeleteFinancialRecord = async (id: string) => remove(child(financialRecordsRef, id));

  const handleUpdateContractForItem = async (itemName: string, assignments: any[]) => {
    // Itera sobre todos os fornecedores para atualizar esse item específico
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
        onReopenInvoice={async () => {}}
        onDeleteInvoice={async () => {}}
        onUpdateInvoiceItems={async () => ({ success: true })}
        onManualInvoiceEntry={async () => ({ success: true })}
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

  if (user.role === 'almoxarifado') {
    return <AlmoxarifadoDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={handleLogout} onRegisterEntry={async (p) => ({ success: true, message: 'Ok' })} onRegisterWithdrawal={async (p) => ({ success: true, message: 'Ok' })} />;
  }

  if (user.role === 'itesp') {
    return <ItespDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={handleLogout} />;
  }

  if (user.role === 'financeiro') {
    return <FinanceDashboard records={financialRecords} onLogout={handleLogout} />;
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
