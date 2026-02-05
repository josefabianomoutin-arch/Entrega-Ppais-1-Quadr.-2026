
import React, { useState, useEffect, useCallback } from 'react';
// Import types directly to ensure they are available for use in generic positions
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, MenuRow } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction, push, child, update } from 'firebase/database';
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
  const [emailModalData, setEmailModalData] = useState<{ recipient: string; cc: string; subject: string; body: string; mailtoLink: string; } | null>(null);

  // Global Sync Effect - Runs only once on mount to keep listeners active
  useEffect(() => {
    setLoading(true);
    
    const unsubSuppliers = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const raw = normalizeArray<any>(data);
      const suppliersArray: Supplier[] = raw.map(p => ({
          ...p,
          name: (p.name || 'SEM NOME').toUpperCase().trim(),
          cpf: p.cpf || String(Math.random()),
          contractItems: normalizeArray(p.contractItems).map((ci: any) => ({ ...ci, name: (ci.name || '').toUpperCase().trim() })),
          deliveries: normalizeArray<any>(p.deliveries).map((d: any) => ({ 
              ...d, 
              item: (d.item || '').toUpperCase().trim(),
              lots: normalizeArray(d.lots).map((l: any) => ({ ...l, lotNumber: (l.lotNumber || '').toUpperCase().trim() })), 
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
      const menuData = snapshot.val() || {};
      for (const day in menuData) {
        if (Object.prototype.hasOwnProperty.call(menuData, day)) {
            menuData[day] = normalizeArray<MenuRow>(menuData[day]);
        }
      }
      setStandardMenu(menuData);
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
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${payload.supplierCpf}`);
    const normalizedItemName = payload.itemName.toUpperCase().trim();
    const normalizedLotNumber = payload.lotNumber.toUpperCase().trim();
    const lotId = `lot-${Date.now()}-${Math.random()}`;
    
    try {
      const result = await runTransaction(supplierRef, (currentSupplier) => {
        if (!currentSupplier) return null;
        
        const newLot = {
          id: lotId,
          lotNumber: normalizedLotNumber,
          initialQuantity: payload.quantity,
          remainingQuantity: payload.quantity,
          expirationDate: payload.expirationDate
        };

        const deliveries = normalizeArray<any>(currentSupplier.deliveries);
        let delivery = deliveries.find(d => 
          d.invoiceNumber === payload.invoiceNumber && 
          (d.item || '').toUpperCase().trim() === normalizedItemName
        );

        if (delivery) {
          delivery.lots = [...normalizeArray(delivery.lots), newLot];
        } else {
          const newDelivery: Delivery = {
            id: `del-entry-${Date.now()}-${Math.random()}`,
            date: payload.invoiceDate,
            time: '08:00',
            item: normalizedItemName,
            kg: payload.quantity,
            invoiceUploaded: true,
            invoiceNumber: payload.invoiceNumber,
            lots: [newLot]
          };
          deliveries.push(newDelivery);
        }
        
        currentSupplier.deliveries = deliveries;
        return currentSupplier;
      });

      if (result.committed) {
        const newMovementRef = push(warehouseLogRef);
        const newLog: WarehouseMovement = {
          id: newMovementRef.key || `mov-${Date.now()}`,
          type: 'entrada',
          timestamp: new Date().toISOString(),
          lotId: lotId, 
          lotNumber: normalizedLotNumber,
          itemName: normalizedItemName,
          supplierName: result.snapshot.val().name,
          deliveryId: 'various',
          inboundInvoice: payload.invoiceNumber,
          quantity: payload.quantity,
          expirationDate: payload.expirationDate
        };
        await set(newMovementRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Entrada registrada!" };
      }
      setIsSaving(false);
      return { success: false, message: "Erro ao processar transação." };
    } catch (e) {
      setIsSaving(false);
      return { success: false, message: "Erro ao salvar." };
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
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${payload.supplierCpf}`);
    const normalizedItemName = payload.itemName.toUpperCase().trim();
    const normalizedLotNumber = payload.lotNumber.toUpperCase().trim();

    try {
      const result = await runTransaction(supplierRef, (currentSupplier) => {
        if (!currentSupplier) return null;
        
        let quantityToDeduct = payload.quantity;
        let lotFound = false;
        let totalAvailableInMatchingLots = 0;
        const deliveries = normalizeArray<any>(currentSupplier.deliveries);

        // Primeiro passo: verificar disponibilidade total do lote para este item
        for (const delivery of deliveries) {
          if ((delivery.item || '').toUpperCase().trim() !== normalizedItemName || !delivery.lots) continue;
          const lots = normalizeArray<any>(delivery.lots);
          const matchingLots = lots.filter(l => (l.lotNumber || '').toUpperCase().trim() === normalizedLotNumber);
          totalAvailableInMatchingLots += matchingLots.reduce((sum, l) => sum + (l.remainingQuantity || 0), 0);
        }

        if (totalAvailableInMatchingLots < quantityToDeduct) {
            // Retornamos undefined para abortar a transação
            return undefined; 
        }

        // Segundo passo: realizar a dedução
        for (const delivery of deliveries) {
          if ((delivery.item || '').toUpperCase().trim() !== normalizedItemName || !delivery.lots) continue;
          
          const lots = normalizeArray<any>(delivery.lots);
          for (const lot of lots) {
            if ((lot.lotNumber || '').toUpperCase().trim() === normalizedLotNumber && lot.remainingQuantity > 0) {
              const deduct = Math.min(lot.remainingQuantity, quantityToDeduct);
              lot.remainingQuantity -= deduct;
              quantityToDeduct -= deduct;
              lotFound = true;
              if (quantityToDeduct <= 0) break;
            }
          }
          delivery.lots = lots;
          if (quantityToDeduct <= 0) break;
        }

        currentSupplier.deliveries = deliveries;
        return currentSupplier;
      });

      if (result.committed) {
        const newMovementRef = push(warehouseLogRef);
        const newLog: WarehouseMovement = {
          id: newMovementRef.key || `mov-out-${Date.now()}`,
          type: 'saída',
          timestamp: new Date().toISOString(),
          lotId: 'various',
          lotNumber: normalizedLotNumber,
          itemName: normalizedItemName,
          supplierName: result.snapshot.val().name,
          deliveryId: 'various',
          outboundInvoice: payload.outboundInvoice,
          quantity: payload.quantity,
          expirationDate: payload.expirationDate
        };
        await set(newMovementRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Saída registrada!" };
      }
      setIsSaving(false);
      return { success: false, message: "Lote não encontrado ou saldo insuficiente para o item informado." };
    } catch (e) {
      setIsSaving(false);
      return { success: false, message: "Erro ao salvar saída." };
    }
  };

  const handleDeleteWarehouseEntry = async (logEntry: WarehouseMovement) => {
    setIsSaving(true);
    if (logEntry.type === 'entrada') {
      const supplierCpf = suppliers.find(s => s.name === logEntry.supplierName)?.cpf;
      if (supplierCpf) {
          const supplierRef = ref(database, `suppliers/${supplierCpf}`);
          try {
              await runTransaction(supplierRef, (current) => {
                  if (!current) return null;
                  const deliveries = normalizeArray<any>(current.deliveries);
                  for (const del of deliveries) {
                      if (del.lots) {
                          const originalLotsCount = del.lots.length;
                          del.lots = normalizeArray<any>(del.lots).filter(l => 
                              l.id !== logEntry.lotId && 
                              (l.lotNumber !== logEntry.lotNumber || l.initialQuantity !== logEntry.quantity)
                          );
                      }
                  }
                  current.deliveries = deliveries;
                  return current;
              });
          } catch (e) { console.error("Error deleting from supplier:", e); }
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
    await writeToDatabase(ref(database, `suppliers/${supplierCpf}`), { ...supplier, deliveries: updatedDeliveries });
  };

  const handleFulfillAndInvoice = async (supplierCpf: string, placeholderIds: string[], invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    let remainingDeliveries = (supplier.deliveries || []).filter(d => !placeholderIds.includes(d.id));
    const original = (supplier.deliveries || []).find(d => placeholderIds.includes(d.id));
    const date = original?.date || new Date().toISOString().split('T')[0];
    const time = original?.time || '08:00';
    const newDeliveries: Delivery[] = invoiceData.fulfilledItems.map((item, idx) => ({
        id: `del-${Date.now()}-${idx}`, date, time, item: item.name.toUpperCase().trim(), kg: item.kg, value: item.value, invoiceUploaded: true, invoiceNumber: invoiceData.invoiceNumber,
    }));
    await writeToDatabase(ref(database, `suppliers/${supplierCpf}`), { ...supplier, deliveries: [...remainingDeliveries, ...newDeliveries] });
    
    // Preparar dados do e-mail
    const recipient = "dg@ptaiuva.sap.gov.br";
    const cc = "almoxarifado@ptaiuva.sap.gov.br";
    const subject = `ENVIO DE NOTA FISCAL - ${supplier.name} - NF ${invoiceData.invoiceNumber}`;
    
    let body = `Olá,\n\nSegue em anexo a Nota Fiscal nº ${invoiceData.invoiceNumber} referente às entregas realizadas em ${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}.\n\nDetalhes da Entrega:\n`;
    
    invoiceData.fulfilledItems.forEach(item => {
        body += `- ${item.name}: ${item.kg.toFixed(2).replace('.',',')} Kg (${new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(item.value)})\n`;
    });
    
    const total = invoiceData.fulfilledItems.reduce((s, i) => s + i.value, 0);
    body += `\nVALOR TOTAL DA NOTA: ${new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(total)}\n\nAtenciosamente,\n${supplier.name}`;

    const mailtoLink = `mailto:${recipient}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    setEmailModalData({
        recipient,
        cc,
        subject,
        body,
        mailtoLink
    });
  };

  const handleCancelDeliveries = async (supplierCpf: string, ids: string[]) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    const updatedDeliveries = (supplier.deliveries || []).filter(d => !ids.includes(d.id));
    await writeToDatabase(ref(database, `suppliers/${supplierCpf}`), { ...supplier, deliveries: updatedDeliveries });
  };

  const handleReopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;

    setIsSaving(true);
    const target = JSON.parse(JSON.stringify(supplier)) as Supplier;
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

    await writeToDatabase(ref(database, `suppliers/${supplierCpf}`), target);
  };

  const handleDeleteInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(s => s.cpf === supplierCpf);
    if (!supplier) return;
    setIsSaving(true);
    const target = JSON.parse(JSON.stringify(supplier)) as Supplier;
    target.deliveries = target.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
    await writeToDatabase(ref(database, `suppliers/${supplierCpf}`), target);
  };

  const handleRegisterDirectorWithdrawal = async (log: Omit<DirectorPerCapitaLog, 'id'>) => {
    const newLog: DirectorPerCapitaLog = { ...log, id: `dir-${Date.now()}` };
    let tempSuppliers = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    let itemsShortage: string[] = [];
    const ts = new Date().toISOString();

    for (const itemReq of log.items) {
      let needed = itemReq.quantity;
      const normalizedReqName = itemReq.name.toUpperCase().trim();
      const allLots = tempSuppliers.flatMap(s => s.deliveries.filter(d => (d.item || '').toUpperCase().trim() === normalizedReqName && d.lots && d.lots.length > 0).map(d => ({ s, d })))
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
                id: movId, type: 'saída', timestamp: ts, lotId: lot.id, lotNumber: lot.lotNumber, itemName: normalizedReqName, supplierName: entry.s.name, deliveryId: entry.d.id, outboundInvoice: `DIR-${log.recipient.substring(0,3).toUpperCase()}`, quantity: take, expirationDate: lot.expirationDate
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
              <p className="text-gray-600 font-bold uppercase tracking-widest text-sm" translate="no">Sincronizando Banco de Dados...</p>
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
            onRegisterEntry={handleRegisterWarehouseEntry}
            onRegisterWithdrawal={handleRegisterWarehouseWithdrawal}
            onCancelDeliveries={handleCancelDeliveries}
          />
        ) : currentUser ? (
          <Dashboard 
            supplier={currentUser} onLogout={() => setCurrentUser(null)} onScheduleDelivery={handleScheduleDelivery} 
            onFulfillAndInvoice={handleFulfillAndInvoice} onCancelDeliveries={handleCancelDeliveries} emailModalData={emailModalData} onCloseEmailModal={() => setEmailModalData(null)} 
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
