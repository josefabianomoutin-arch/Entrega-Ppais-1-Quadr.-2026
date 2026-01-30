
import React, { useState, useEffect } from 'react';
// Import types directly to ensure they are available for use in generic positions
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const suppliersRef = ref(database, 'suppliers');
const warehouseLogRef = ref(database, 'warehouseLog');
const perCapitaConfigRef = ref(database, 'perCapitaConfig');
const cleaningLogsRef = ref(database, 'cleaningLogs');
const directorWithdrawalsRef = ref(database, 'directorWithdrawals');

// Use function declaration for generics in .tsx to avoid ambiguity with JSX tags
function normalizeArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(i => i !== null) as T[];
  if (typeof data === 'object') return Object.values(data).filter(i => i !== null) as T[];
  return [];
}

const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [directorWithdrawals, setDirectorWithdrawals] = useState<DirectorPerCapitaLog[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Supplier | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning' | 'directorPerCapita'>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribeSuppliers = onValue(suppliersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setSuppliers([]);
          return;
        }

        const rawSuppliers = normalizeArray<any>(data);
        
        const suppliersArray: Supplier[] = rawSuppliers
          .map(p => ({
            ...p,
            name: p.name || 'SEM NOME',
            cpf: p.cpf || String(Math.random()),
            contractItems: normalizeArray(p.contractItems),
            deliveries: normalizeArray<any>(p.deliveries).map((d: any) => ({ 
                ...d, 
                lots: normalizeArray(d.lots), 
                withdrawals: normalizeArray(d.withdrawals) 
            })),
            allowedWeeks: normalizeArray<number>(p.allowedWeeks),
            initialValue: p.initialValue || 0,
          }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        setSuppliers(suppliersArray);

        // Atualiza o usuário logado se ele estiver na lista
        if (currentUser) {
            const updatedUser = suppliersArray.find(s => s.cpf === currentUser.cpf);
            if (updatedUser) setCurrentUser(updatedUser);
        }

      } catch (error) { 
        console.error("Erro ao processar fornecedores:", error); 
        setSuppliers([]); 
      } finally { 
        setLoading(false); 
      }
    });

    const unsubscribeWarehouseLog = onValue(warehouseLogRef, (snapshot) => {
      setWarehouseLog(normalizeArray(snapshot.val()));
    });

    const unsubscribeCleaningLogs = onValue(cleaningLogsRef, (snapshot) => {
      setCleaningLogs(normalizeArray(snapshot.val()));
    });

    const unsubscribeDirectorWithdrawals = onValue(directorWithdrawalsRef, (snapshot) => {
      setDirectorWithdrawals(normalizeArray(snapshot.val()));
    });
    
    const unsubscribePerCapitaConfig = onValue(perCapitaConfigRef, (snapshot) => {
      setPerCapitaConfig(snapshot.val() || {});
    });

    return () => {
      unsubscribeSuppliers();
      unsubscribeWarehouseLog();
      unsubscribeCleaningLogs();
      unsubscribeDirectorWithdrawals();
      unsubscribePerCapitaConfig();
    };
  }, [currentUser?.cpf]);

  const writeToDatabase = async (dbRef: any, data: any) => {
      setIsSaving(true);
      try { await set(dbRef, data); } 
      catch (error) { console.error(error); throw error; } 
      finally { setTimeout(() => setIsSaving(false), 500); }
  };

  const handleScheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    const newDelivery: Delivery = {
      id: `del-${Date.now()}`,
      date,
      time,
      item: 'AGENDAMENTO PENDENTE',
      invoiceUploaded: false,
    };

    const updatedDeliveries = [...(supplier.deliveries || []), newDelivery];
    const updatedSupplier = { ...supplier, deliveries: updatedDeliveries };
    
    const updatedSuppliersMap = suppliers.reduce((acc, p) => {
        acc[p.cpf] = p.cpf === supplierCpf ? updatedSupplier : p;
        return acc;
    }, {} as Record<string, Supplier>);

    await writeToDatabase(suppliersRef, updatedSuppliersMap);
  };

  const handleFulfillAndInvoice = async (
    supplierCpf: string, 
    placeholderDeliveryIds: string[], 
    invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }
  ) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    // Filtra as entregas existentes removendo os placeholders que estão sendo faturados
    let updatedDeliveries = (supplier.deliveries || []).filter(d => !placeholderDeliveryIds.includes(d.id));
    
    // Pega a data e hora do primeiro placeholder para manter a referência no histórico
    const originalDelivery = (supplier.deliveries || []).find(d => placeholderDeliveryIds.includes(d.id));
    const date = originalDelivery?.date || new Date().toISOString().split('T')[0];
    const time = originalDelivery?.time || '08:00';

    // Cria as novas entradas de entrega baseadas nos itens faturados
    const newDeliveries: Delivery[] = invoiceData.fulfilledItems.map((item, idx) => ({
        id: `del-${Date.now()}-${idx}`,
        date,
        time,
        item: item.name,
        kg: item.kg,
        value: item.value,
        invoiceUploaded: true,
        invoiceNumber: invoiceData.invoiceNumber,
    }));

    updatedDeliveries = [...updatedDeliveries, ...newDeliveries];
    const updatedSupplier = { ...supplier, deliveries: updatedDeliveries };

    const updatedSuppliersMap = suppliers.reduce((acc, p) => {
        acc[p.cpf] = p.cpf === supplierCpf ? updatedSupplier : p;
        return acc;
    }, {} as Record<string, Supplier>);

    await writeToDatabase(suppliersRef, updatedSuppliersMap);
  };

  const handleCancelDeliveries = async (supplierCpf: string, deliveryIds: string[]) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    const updatedDeliveries = (supplier.deliveries || []).filter(d => !deliveryIds.includes(d.id));
    const updatedSupplier = { ...supplier, deliveries: updatedDeliveries };

    const updatedSuppliersMap = suppliers.reduce((acc, p) => {
        acc[p.cpf] = p.cpf === supplierCpf ? updatedSupplier : p;
        return acc;
    }, {} as Record<string, Supplier>);

    await writeToDatabase(suppliersRef, updatedSuppliersMap);
  };

  const handleRegisterDirectorWithdrawal = async (log: Omit<DirectorPerCapitaLog, 'id'>) => {
    const newLog: DirectorPerCapitaLog = { ...log, id: `dir-${Date.now()}` };
    
    // Lógica para deduzir do estoque total (PEPS)
    let tempSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    let itemsShortage: string[] = [];

    for (const itemReq of log.items) {
      let needed = itemReq.quantity;
      
      // Ordenar lotes por data de entrega (mais antigos primeiro) para PEPS
      const allLotsForItem = tempSuppliers.flatMap(s => 
        s.deliveries
          .filter(d => d.item === itemReq.name && d.lots && d.lots.length > 0)
          .map(d => ({ supplier: s, delivery: d }))
      ).sort((a, b) => a.delivery.date.localeCompare(b.delivery.date));

      for (const entry of allLotsForItem) {
        if (needed <= 0) break;
        if (!entry.delivery.lots) continue;

        for (const lot of entry.delivery.lots) {
          if (needed <= 0) break;
          if (lot.remainingQuantity > 0) {
            const take = Math.min(lot.remainingQuantity, needed);
            lot.remainingQuantity -= take;
            needed -= take;
          }
        }
      }

      if (needed > 0.001) {
        itemsShortage.push(`${itemReq.name} (faltou ${needed.toFixed(2)})`);
      }
    }

    if (itemsShortage.length > 0) {
      if (!window.confirm(`Atenção: Os seguintes itens não possuem estoque suficiente: ${itemsShortage.join(', ')}. Deseja continuar mesmo assim (o saldo ficará zerado nos lotes existentes)?`)) {
        return { success: false, message: 'Operação cancelada por falta de estoque.' };
      }
    }

    // Salva o log e atualiza os fornecedores (baixando o estoque)
    await writeToDatabase(directorWithdrawalsRef, [newLog, ...directorWithdrawals]);
    await writeToDatabase(suppliersRef, tempSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
    
    return { success: true, message: 'Envio para diretoria registrado e estoque baixado com sucesso.' };
  };

  const handleDeleteDirectorWithdrawal = async (id: string) => {
    const updatedLogs = directorWithdrawals.filter(l => l.id !== id);
    await writeToDatabase(directorWithdrawalsRef, updatedLogs);
  };

  const handleRegisterCleaningLog = async (log: Omit<CleaningLog, 'id'>) => {
    const newLog: CleaningLog = { ...log, id: `clean-${Date.now()}` };
    const updatedLogs = [newLog, ...cleaningLogs];
    await writeToDatabase(cleaningLogsRef, updatedLogs);
    return { success: true, message: 'Registro de higienização salvo com sucesso.' };
  };

  const handleDeleteCleaningLog = async (id: string) => {
    const updatedLogs = cleaningLogs.filter(l => l.id !== id);
    await writeToDatabase(cleaningLogsRef, updatedLogs);
  };

  const handleLogin = (name: string, cpf: string): boolean => {
    const lowerCaseName = name.toLowerCase();
    const cleanCpf = cpf.replace(/[^\d]/g, '');
    
    if (lowerCaseName === 'administrador' && cleanCpf === '15210361870') {
      setIsAdminLoggedIn(true);
      setCurrentUser(null);
      setIsAlmoxarifadoLoggedIn(false);
      setAdminActiveTab('register');
      return true;
    }
    if (lowerCaseName === 'almoxarifado' && cpf === 'almoxarifado123') {
        setIsAlmoxarifadoLoggedIn(true);
        setIsAdminLoggedIn(false);
        setCurrentUser(null);
        return true;
    }
    const user = suppliers.find(p => p.name === name.toUpperCase() && p.cpf === cleanCpf);
    if (user) {
      setCurrentUser(user);
      setIsAdminLoggedIn(false);
      setIsAlmoxarifadoLoggedIn(false);
      return true;
    }
    return false;
  };
  
  const handleRegister = async (name: string, cpf: string, allowedWeeks: number[]) => {
    setRegistrationStatus(null);
    setIsSaving(true);
    const finalName = name.trim().toUpperCase();
    const finalCpf = cpf.trim().replace(/[^\d]/g, '');
    const newSupplier: Supplier = { name: finalName, cpf: finalCpf, initialValue: 0, contractItems: [], deliveries: [], allowedWeeks };
  
    try {
      await runTransaction(suppliersRef, (currentData) => {
        const obj = currentData || {};
        if (obj[finalCpf]) return;
        obj[finalCpf] = newSupplier;
        return obj;
      });
      setRegistrationStatus({ success: true, message: `Fornecedor "${finalName}" cadastrado!` });
    } catch (error) { setRegistrationStatus({ success: false, message: 'Erro ao cadastrar.' }); }
    finally { setIsSaving(false); }
  };

  const handleUpdateSupplierData = async (oldCpf: string, name: string, cpf: string, weeks: number[]) => {
    setIsSaving(true);
    const finalCpf = cpf.replace(/[^\d]/g, '');
    try {
        await runTransaction(suppliersRef, (current) => {
            if(!current || !current[oldCpf]) return;
            const data = { ...current[oldCpf], name: name.toUpperCase(), cpf: finalCpf, allowedWeeks: weeks };
            if(oldCpf !== finalCpf) delete current[oldCpf];
            current[finalCpf] = data;
            return current;
        });
        return null;
    } catch (e) { return 'Erro ao atualizar.'; }
    finally { setIsSaving(false); }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
              <svg className="animate-spin h-12 w-12 text-green-600 mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-bold animate-pulse uppercase tracking-widest text-sm">Sincronizando Banco de Dados...</p>
          </div>
      );
  }

  return (
      <>
        <div className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Salvando na nuvem...
            </div>
        </div>

        {isAdminLoggedIn ? (
          <AdminDashboard 
            suppliers={suppliers}
            warehouseLog={warehouseLog}
            cleaningLogs={cleaningLogs}
            directorWithdrawals={directorWithdrawals}
            onRegister={handleRegister} 
            onPersistSuppliers={(s) => writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}))}
            onUpdateSupplier={handleUpdateSupplierData}
            onLogout={() => { setIsAdminLoggedIn(false); setCurrentUser(null); }}
            onResetData={() => { if(window.confirm('Apagar tudo?')) writeToDatabase(suppliersRef, {}); }}
            onRestoreData={async (s) => { try { await writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {})); return true; } catch { return false; } }}
            activeTab={adminActiveTab}
            onTabChange={setAdminActiveTab}
            registrationStatus={registrationStatus}
            onClearRegistrationStatus={() => setRegistrationStatus(null)}
            onReopenInvoice={async (cpf, num) => {}}
            perCapitaConfig={perCapitaConfig}
            onUpdatePerCapitaConfig={(c) => writeToDatabase(perCapitaConfigRef, c)}
            onDeleteWarehouseEntry={async (l) => ({ success: true, message: '' })}
            onRegisterCleaningLog={async (l) => { const r = await handleRegisterCleaningLog(l); return r; }}
            onDeleteCleaningLog={handleDeleteCleaningLog}
            onRegisterDirectorWithdrawal={handleRegisterDirectorWithdrawal}
            onDeleteDirectorWithdrawal={handleDeleteDirectorWithdrawal}
          />
        ) : currentUser ? (
          <Dashboard 
            supplier={currentUser} 
            onLogout={() => setCurrentUser(null)} 
            onScheduleDelivery={handleScheduleDelivery} 
            onFulfillAndInvoice={handleFulfillAndInvoice} 
            onCancelDeliveries={handleCancelDeliveries} 
            emailModalData={null} 
            onCloseEmailModal={() => {}} 
          />
        ) : isAlmoxarifadoLoggedIn ? (
          <AlmoxarifadoDashboard suppliers={suppliers} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} onRegisterEntry={async (p) => ({success:true, message:''})} onRegisterWithdrawal={async (p) => ({success:true, message:''})} />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;
