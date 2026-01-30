
import React, { useState, useEffect, useCallback } from 'react';
// Import types directly to ensure they are available for use in generic positions
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction, push, child } from 'firebase/database';
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

// Use function declaration for generics in .tsx to avoid ambiguity with JSX tags
function normalizeArray<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(i => i !== null) as T[];
  if (typeof data === 'object') {
    return Object.values(data).filter(i => i !== null) as T[];
  }
  return [];
}

const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [directorWithdrawals, setDirectorWithdrawals] = useState<DirectorPerCapitaLog[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
  const [standardMenu, setStandardMenu] = useState<StandardMenu>({});
  const [dailyMenus, setDailyMenus] = useState<DailyMenus>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Supplier | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning' | 'directorPerCapita' | 'menu'>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);

  // Global Sync Effect - Runs only once on mount to keep listeners active
  useEffect(() => {
    setLoading(true);
    
    const unsubSuppliers = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const raw = normalizeArray<any>(data);
      const suppliersArray: Supplier[] = raw.map(p => ({
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
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      setSuppliers(suppliersArray);
      setLoading(false);
    });

    const unsubLog = onValue(warehouseLogRef, (snapshot) => {
      const logs = normalizeArray<WarehouseMovement>(snapshot.val());
      setWarehouseLog(logs);
    });

    const unsubClean = onValue(cleaningLogsRef, (snapshot) => {
      setCleaningLogs(normalizeArray<CleaningLog>(snapshot.val()));
    });

    const unsubDir = onValue(directorWithdrawalsRef, (snapshot) => {
      setDirectorWithdrawals(normalizeArray<DirectorPerCapitaLog>(snapshot.val()));
    });
    
    const unsubConfig = onValue(perCapitaConfigRef, (snapshot) => {
      setPerCapitaConfig(snapshot.val() || {});
    });

    const unsubMenu = onValue(standardMenuRef, (snapshot) => {
      setStandardMenu(snapshot.val() || {});
    });

    const unsubDailyMenus = onValue(dailyMenusRef, (snapshot) => {
      setDailyMenus(snapshot.val() || {});
    });

    return () => {
      unsubSuppliers();
      unsubLog();
      unsubClean();
      unsubDir();
      unsubConfig();
      unsubMenu();
      unsubDailyMenus();
    };
  }, []);

  // Sync current user state when suppliers list updates
  useEffect(() => {
    if (currentUser) {
      const updated = suppliers.find(s => s.cpf === currentUser.cpf);
      if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
        setCurrentUser(updated);
      }
    }
  }, [suppliers, currentUser]);

  const writeToDatabase = useCallback(async (dbRef: any, data: any) => {
      setIsSaving(true);
      try { await set(dbRef, data); } 
      catch (error) { console.error(error); throw error; } 
      finally { setTimeout(() => setIsSaving(false), 500); }
  }, []);

  const handleRegisterWarehouseEntry = async (payload: {
    supplierCpf: string;
    itemName: string;
    invoiceNumber: string;
    invoiceDate: string;
    lotNumber: string;
    quantity: number;
    expirationDate: string;
  }) => {
    const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
    if (!supplier) return { success: false, message: "Fornecedor não encontrado." };

    setIsSaving(true);
    const newSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    const sIdx = newSuppliers.findIndex(s => s.cpf === payload.supplierCpf);
    const targetSupplier = newSuppliers[sIdx];
    
    const lotId = `lot-${Date.now()}`;
    const newLot = {
      id: lotId,
      lotNumber: payload.lotNumber,
      initialQuantity: payload.quantity,
      remainingQuantity: payload.quantity,
      expirationDate: payload.expirationDate
    };

    let delivery = targetSupplier.deliveries.find(d => d.invoiceNumber === payload.invoiceNumber && d.item === payload.itemName);
    
    if (delivery) {
      delivery.lots = [...(delivery.lots || []), newLot];
    } else {
      const newDelivery: Delivery = {
        id: `del-entry-${Date.now()}`,
        date: payload.invoiceDate,
        time: '08:00',
        item: payload.itemName,
        kg: payload.quantity,
        invoiceUploaded: true,
        invoiceNumber: payload.invoiceNumber,
        lots: [newLot]
      };
      targetSupplier.deliveries.push(newDelivery);
    }

    const newMovementRef = push(warehouseLogRef);
    const movementId = newMovementRef.key || `mov-${Date.now()}`;
    const newLog: WarehouseMovement = {
      id: movementId,
      type: 'entrada',
      timestamp: new Date().toISOString(),
      lotId: lotId,
      lotNumber: payload.lotNumber,
      itemName: payload.itemName,
      supplierName: targetSupplier.name,
      deliveryId: delivery?.id || `del-entry-${Date.now()}`,
      inboundInvoice: payload.invoiceNumber,
      quantity: payload.quantity,
      expirationDate: payload.expirationDate
    };

    try {
        await set(suppliersRef, newSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
        await set(newMovementRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Entrada registrada e histórico atualizado!" };
    } catch (e) {
        setIsSaving(false);
        return { success: false, message: "Erro ao salvar no banco de dados." };
    }
  };

  const handleRegisterWarehouseWithdrawal = async (payload: {
    supplierCpf: string;
    itemName: string;
    lotNumber: string;
    quantity: number;
    outboundInvoice: string;
    expirationDate: string;
  }) => {
    const supplier = suppliers.find(s => s.cpf === payload.supplierCpf);
    if (!supplier) return { success: false, message: "Fornecedor não encontrado." };

    setIsSaving(true);
    const newSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    const sIdx = newSuppliers.findIndex(s => s.cpf === payload.supplierCpf);
    const targetSupplier = newSuppliers[sIdx];
    
    let quantityToDeduct = payload.quantity;
    let lotFound = false;

    for (const delivery of targetSupplier.deliveries) {
      if (delivery.item !== payload.itemName || !delivery.lots) continue;
      const lot = delivery.lots.find(l => l.lotNumber === payload.lotNumber);
      if (lot && lot.remainingQuantity > 0) {
        const deduct = Math.min(lot.remainingQuantity, quantityToDeduct);
        lot.remainingQuantity -= deduct;
        quantityToDeduct -= deduct;
        lotFound = true;
        if (quantityToDeduct <= 0) break;
      }
    }

    if (!lotFound) {
        setIsSaving(false);
        return { success: false, message: "Lote não encontrado ou sem saldo." };
    }

    const newMovementRef = push(warehouseLogRef);
    const movementId = newMovementRef.key || `mov-out-${Date.now()}`;
    const newLog: WarehouseMovement = {
      id: movementId,
      type: 'saída',
      timestamp: new Date().toISOString(),
      lotId: 'various',
      lotNumber: payload.lotNumber,
      itemName: payload.itemName,
      supplierName: targetSupplier.name,
      deliveryId: 'various',
      outboundInvoice: payload.outboundInvoice,
      quantity: payload.quantity,
      expirationDate: payload.expirationDate
    };

    try {
        await set(suppliersRef, newSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
        await set(newMovementRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Saída registrada e histórico atualizado!" };
    } catch (e) {
        setIsSaving(false);
        return { success: false, message: "Erro ao salvar saída." };
    }
  };

  const handleDeleteWarehouseEntry = async (logEntry: WarehouseMovement) => {
    setIsSaving(true);
    if (logEntry.type === 'entrada') {
      const newSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
      const supplier = newSuppliers.find(s => s.name === logEntry.supplierName);
      if (supplier) {
        for (const del of supplier.deliveries) {
          if (del.lots) del.lots = del.lots.filter(l => l.id !== logEntry.lotId);
        }
        await set(suppliersRef, newSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
      }
    }
    await set(ref(database, `warehouseLog/${logEntry.id}`), null);
    setIsSaving(false);
    return { success: true, message: "Registro removido com sucesso." };
  };

  const handleScheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    const newDelivery: Delivery = { id: `del-${Date.now()}`, date, time, item: 'AGENDAMENTO PENDENTE', invoiceUploaded: false };
    const updatedDeliveries = [...(supplier.deliveries || []), newDelivery];
    const updatedSupplier = { ...supplier, deliveries: updatedDeliveries };
    const updatedMap = suppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p.cpf === supplierCpf ? updatedSupplier : p }), {});
    await writeToDatabase(suppliersRef, updatedMap);
  };

  const handleFulfillAndInvoice = async (supplierCpf: string, placeholderIds: string[], invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    let updatedDeliveries = (supplier.deliveries || []).filter(d => !placeholderIds.includes(d.id));
    const original = (supplier.deliveries || []).find(d => placeholderIds.includes(d.id));
    const date = original?.date || new Date().toISOString().split('T')[0];
    const time = original?.time || '08:00';
    const newDeliveries: Delivery[] = invoiceData.fulfilledItems.map((item, idx) => ({
        id: `del-${Date.now()}-${idx}`, date, time, item: item.name, kg: item.kg, value: item.value, invoiceUploaded: true, invoiceNumber: invoiceData.invoiceNumber,
    }));
    const updatedSupplier = { ...supplier, deliveries: [...updatedDeliveries, ...newDeliveries] };
    const updatedMap = suppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p.cpf === supplierCpf ? updatedSupplier : p }), {});
    await writeToDatabase(suppliersRef, updatedMap);
  };

  const handleCancelDeliveries = async (supplierCpf: string, ids: string[]) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    const updated = { ...supplier, deliveries: (supplier.deliveries || []).filter(d => !ids.includes(d.id)) };
    const map = suppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p.cpf === supplierCpf ? updated : p }), {});
    await writeToDatabase(suppliersRef, map);
  };

  const handleReopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    setIsSaving(true);
    const newSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    const sIdx = newSuppliers.findIndex(s => s.cpf === supplierCpf);
    const target = newSuppliers[sIdx];

    const dates = [...new Set(target.deliveries.filter(d => d.invoiceNumber === invoiceNumber).map(d => d.date))];
    
    target.deliveries = target.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
    
    dates.forEach(date => {
        const hasOtherOnDate = target.deliveries.some(d => d.date === date);
        if (!hasOtherOnDate) {
            target.deliveries.push({
                id: `del-reopen-${Date.now()}-${Math.random()}`,
                date,
                time: '08:00',
                item: 'AGENDAMENTO PENDENTE',
                invoiceUploaded: false
            });
        }
    });

    await writeToDatabase(suppliersRef, newSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
  };

  const handleDeleteInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    setIsSaving(true);
    const newSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    const sIdx = newSuppliers.findIndex(s => s.cpf === supplierCpf);
    const target = newSuppliers[sIdx];

    target.deliveries = target.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);

    await writeToDatabase(suppliersRef, newSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
  };

  const handleRegisterDirectorWithdrawal = async (log: Omit<DirectorPerCapitaLog, 'id'>) => {
    const newLog: DirectorPerCapitaLog = { ...log, id: `dir-${Date.now()}` };
    let tempSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    let itemsShortage: string[] = [];
    const ts = new Date().toISOString();

    for (const itemReq of log.items) {
      let needed = itemReq.quantity;
      const allLots = tempSuppliers.flatMap(s => s.deliveries.filter(d => d.item === itemReq.name && d.lots && d.lots.length > 0).map(d => ({ s, d })))
                        .sort((a, b) => a.d.date.localeCompare(b.d.date));

      for (const entry of allLots) {
        if (needed <= 0 || !entry.d.lots) break;
        for (const lot of entry.d.lots) {
          if (needed <= 0) break;
          if (lot.remainingQuantity > 0) {
            const take = Math.min(lot.remainingQuantity, needed);
            lot.remainingQuantity -= take;
            needed -= take;
            const newMovementRef = push(warehouseLogRef);
            const movId = newMovementRef.key || `mov-dir-${Date.now()}-${Math.random()}`;
            await set(newMovementRef, {
                id: movId, type: 'saída', timestamp: ts, lotId: lot.id, lotNumber: lot.lotNumber, itemName: itemReq.name, supplierName: entry.s.name, deliveryId: entry.d.id, outboundInvoice: `DIR-${log.recipient.substring(0,3).toUpperCase()}`, quantity: take, expirationDate: lot.expirationDate
            });
          }
        }
      }
      if (needed > 0.001) itemsShortage.push(`${itemReq.name} (faltou ${needed.toFixed(2)})`);
    }

    if (itemsShortage.length > 0 && !window.confirm(`Atenção: Estoque insuficiente: ${itemsShortage.join(', ')}. Continuar?`)) return { success: false, message: 'Cancelado.' };
    await writeToDatabase(directorWithdrawalsRef, [newLog, ...directorWithdrawals]);
    await writeToDatabase(suppliersRef, tempSuppliers.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
    return { success: true, message: 'Registrado com sucesso.' };
  };

  const handleLogin = (name: string, cpf: string): boolean => {
    const lowerName = name.toLowerCase();
    const cleanCpf = cpf.replace(/[^\d]/g, '');
    if (lowerName === 'administrador' && cleanCpf === '15210361870') {
      setIsAdminLoggedIn(true); setCurrentUser(null); setIsAlmoxarifadoLoggedIn(false); setAdminActiveTab('register'); return true;
    }
    if (lowerName === 'almoxarifado' && cpf === 'almoxarifado123') {
        setIsAlmoxarifadoLoggedIn(true); setIsAdminLoggedIn(false); setCurrentUser(null); return true;
    }
    const user = suppliers.find(p => p.name === name.toUpperCase() && p.cpf === cleanCpf);
    if (user) { setCurrentUser(user); setIsAdminLoggedIn(false); setIsAlmoxarifadoLoggedIn(false); return true; }
    return false;
  };
  
  const handleRegister = async (name: string, cpf: string, allowedWeeks: number[]) => {
    setRegistrationStatus(null); setIsSaving(true);
    const finalName = name.trim().toUpperCase();
    const finalCpf = cpf.trim().replace(/[^\d]/g, '');
    const newS: Supplier = { name: finalName, cpf: finalCpf, initialValue: 0, contractItems: [], deliveries: [], allowedWeeks };
    try {
      await runTransaction(suppliersRef, (current) => {
        const obj = current || {}; if (obj[finalCpf]) return; obj[finalCpf] = newS; return obj;
      });
      setRegistrationStatus({ success: true, message: `Cadastrado!` });
    } catch { setRegistrationStatus({ success: false, message: 'Erro.' }); }
    finally { setIsSaving(false); }
  };

  const handleUpdateSupplierData = async (oldCpf: string, name: string, cpf: string, weeks: number[]) => {
    setIsSaving(true); const finalCpf = cpf.replace(/[^\d]/g, '');
    try {
        await runTransaction(suppliersRef, (current) => {
            if(!current || !current[oldCpf]) return;
            const data = { ...current[oldCpf], name: name.toUpperCase(), cpf: finalCpf, allowedWeeks: weeks };
            if(oldCpf !== finalCpf) delete current[oldCpf]; current[finalCpf] = data; return current;
        });
        return null;
    } catch { return 'Erro.'; } finally { setIsSaving(false); }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
              <svg className="animate-spin h-12 w-12 text-green-600 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p className="text-gray-600 font-bold uppercase tracking-widest text-sm">Sincronizando Banco de Dados...</p>
          </div>
      );
  }

  return (
      <>
        <div className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Sincronizando...
            </div>
        </div>

        {isAdminLoggedIn ? (
          <AdminDashboard 
            suppliers={suppliers} warehouseLog={warehouseLog} cleaningLogs={cleaningLogs} directorWithdrawals={directorWithdrawals}
            onRegister={handleRegister} onPersistSuppliers={(s) => writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}))}
            onUpdateSupplier={handleUpdateSupplierData} onLogout={() => { setIsAdminLoggedIn(false); setCurrentUser(null); }}
            onResetData={() => { if(window.confirm('Apagar tudo?')) writeToDatabase(suppliersRef, {}); }}
            onRestoreData={async (s) => { try { await writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {})); return true; } catch { return false; } }}
            activeTab={adminActiveTab} onTabChange={setAdminActiveTab} registrationStatus={registrationStatus}
            onClearRegistrationStatus={() => setRegistrationStatus(null)} 
            onReopenInvoice={handleReopenInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            perCapitaConfig={perCapitaConfig}
            onUpdatePerCapitaConfig={(c) => writeToDatabase(perCapitaConfigRef, c)} onDeleteWarehouseEntry={handleDeleteWarehouseEntry}
            onRegisterCleaningLog={async (l) => { const r = await set(ref(database, `cleaningLogs/${Date.now()}`), { ...l, id: String(Date.now()) }); return {success: true, message: 'OK'}; }}
            onDeleteCleaningLog={async (id) => set(ref(database, `cleaningLogs/${id}`), null)} onRegisterDirectorWithdrawal={handleRegisterDirectorWithdrawal}
            onDeleteDirectorWithdrawal={async (id) => set(ref(database, `directorWithdrawals/${id}`), null)}
            standardMenu={standardMenu}
            dailyMenus={dailyMenus}
            onUpdateStandardMenu={(m) => writeToDatabase(standardMenuRef, m)}
            onUpdateDailyMenu={(m) => writeToDatabase(dailyMenusRef, m)}
          />
        ) : currentUser ? (
          <Dashboard 
            supplier={currentUser} onLogout={() => setCurrentUser(null)} onScheduleDelivery={handleScheduleDelivery} 
            onFulfillAndInvoice={handleFulfillAndInvoice} onCancelDeliveries={handleCancelDeliveries} emailModalData={null} onCloseEmailModal={() => {}} 
          />
        ) : isAlmoxarifadoLoggedIn ? (
          <AlmoxarifadoDashboard 
            suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} 
            onRegisterEntry={handleRegisterWarehouseEntry} onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} 
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;
