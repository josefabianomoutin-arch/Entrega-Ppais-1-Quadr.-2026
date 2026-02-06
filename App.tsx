
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

// Helper de normalização absoluta (remove acentos, espaços, símbolos e pontuação)
const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

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

  // Global Sync Effect
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
              lots: normalizeArray(d.lots).map((l: any) => ({ 
                ...l, 
                lotNumber: (l.lotNumber || '').toUpperCase().trim(),
                remainingQuantity: Number(l.remainingQuantity) || 0
              })), 
              withdrawals: normalizeArray(d.withdrawals) 
          })),
          allowedWeeks: normalizeArray<number>(p.allowedWeeks),
          initialValue: p.initialValue || 0,
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      setSuppliers(suppliersArray);
      setLoading(false);
    });

    const unsubLog = onValue(warehouseLogRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setWarehouseLog([]);
        return;
      }
      const logsArray = Object.entries(data).map(([key, val]: [string, any]) => ({
        ...val,
        id: key 
      }));
      setWarehouseLog(logsArray);
    });

    const unsubClean = onValue(cleaningLogsRef, (snapshot) => setCleaningLogs(normalizeArray<CleaningLog>(snapshot.val())));
    const unsubDir = onValue(directorWithdrawalsRef, (snapshot) => setDirectorWithdrawals(normalizeArray<DirectorPerCapitaLog>(snapshot.val())));
    const unsubConfig = onValue(perCapitaConfigRef, (snapshot) => setPerCapitaConfig(snapshot.val() || {}));
    const unsubMenu = onValue(standardMenuRef, (snapshot) => {
      const menuData = snapshot.val() || {};
      for (const day in menuData) {
        if (Object.prototype.hasOwnProperty.call(menuData, day)) menuData[day] = normalizeArray<MenuRow>(menuData[day]);
      }
      setStandardMenu(menuData);
    });
    const unsubDailyMenus = onValue(dailyMenusRef, (snapshot) => setDailyMenus(snapshot.val() || {}));

    return () => {
      unsubSuppliers(); unsubLog(); unsubClean(); unsubDir(); unsubConfig(); unsubMenu(); unsubDailyMenus();
    };
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
        const deliveries = normalizeArray<any>(currentSupplier.deliveries);
        const newLot = { id: lotId, lotNumber: normalizedLotNumber, initialQuantity: Number(payload.quantity), remainingQuantity: Number(payload.quantity), expirationDate: payload.expirationDate };

        let delivery = deliveries.find(d => 
          d.invoiceNumber === payload.invoiceNumber && 
          superNormalize(d.item) === superNormalize(normalizedItemName)
        );

        if (delivery) {
          delivery.lots = [...normalizeArray(delivery.lots), newLot];
        } else {
          deliveries.push({ id: `del-entry-${Date.now()}`, date: payload.invoiceDate, time: '08:00', item: normalizedItemName, kg: Number(payload.quantity), invoiceUploaded: true, invoiceNumber: payload.invoiceNumber, lots: [newLot] });
        }
        currentSupplier.deliveries = deliveries;
        return currentSupplier;
      });

      if (result.committed) {
        const logEntryRef = push(warehouseLogRef);
        const newLog: WarehouseMovement = { id: logEntryRef.key || `mov-${Date.now()}`, type: 'entrada', timestamp: new Date().toISOString(), lotId: lotId, lotNumber: normalizedLotNumber, itemName: normalizedItemName, supplierName: result.snapshot.val().name, deliveryId: 'various', inboundInvoice: payload.invoiceNumber, quantity: payload.quantity, expirationDate: payload.expirationDate };
        await set(logEntryRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Entrada registrada!" };
      }
      return { success: false, message: "Erro ao processar transação." };
    } catch (e) { setIsSaving(false); return { success: false, message: "Erro ao salvar." }; }
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
    const normReqItem = superNormalize(payload.itemName);
    const normReqLot = superNormalize(payload.lotNumber);
    const EPSILON = 0.0001;
    let errorDetail = "";

    try {
      const result = await runTransaction(supplierRef, (currentSupplier) => {
        if (!currentSupplier) return null;
        let qtyToDeduct = Number(payload.quantity);
        const deliveries = normalizeArray<any>(currentSupplier.deliveries);

        let totalAvail = 0;
        deliveries.forEach(d => {
            if (superNormalize(d.item) !== normReqItem) return;
            normalizeArray<any>(d.lots).forEach(l => {
                if (superNormalize(l.lotNumber) === normReqLot) {
                    totalAvail += Number(l.remainingQuantity || 0);
                }
            });
        });

        if (totalAvail < (qtyToDeduct - EPSILON)) {
            errorDetail = `Saldo insuficiente (Encontrado: ${totalAvail.toFixed(2)} kg, Requerido: ${qtyToDeduct.toFixed(2)} kg).`;
            return undefined; 
        }

        for (const d of deliveries) {
            if (superNormalize(d.item) !== normReqItem) continue;
            const lots = normalizeArray<any>(d.lots);
            for (const l of lots) {
                if (superNormalize(l.lotNumber) === normReqLot && Number(l.remainingQuantity) > 0) {
                    const take = Math.min(Number(l.remainingQuantity), qtyToDeduct);
                    l.remainingQuantity = Number((Number(l.remainingQuantity) - take).toFixed(4));
                    qtyToDeduct -= take;
                    if (qtyToDeduct <= EPSILON) { qtyToDeduct = 0; break; }
                }
            }
            d.lots = lots;
            if (qtyToDeduct <= 0) break;
        }

        currentSupplier.deliveries = deliveries;
        return currentSupplier;
      });

      if (result.committed) {
        const logEntryRef = push(warehouseLogRef);
        const newLog: WarehouseMovement = { id: logEntryRef.key || `mov-out-${Date.now()}`, type: 'saída', timestamp: new Date().toISOString(), lotId: 'various', lotNumber: payload.lotNumber.toUpperCase().trim(), itemName: payload.itemName.toUpperCase().trim(), supplierName: result.snapshot.val().name, deliveryId: 'various', outboundInvoice: payload.outboundInvoice, quantity: payload.quantity, expirationDate: payload.expirationDate };
        await set(logEntryRef, newLog);
        setIsSaving(false);
        return { success: true, message: "Saída registrada!" };
      }
      setIsSaving(false);
      return { success: false, message: errorDetail || `Lote '${payload.lotNumber}' não localizado.` };
    } catch (e) { setIsSaving(false); return { success: false, message: "Falha técnica no banco de dados." }; }
  };

  const writeToDatabase = useCallback(async (dbRef: any, data: any) => {
    setIsSaving(true);
    try { await set(dbRef, data); } catch (e) { console.error(e); } finally { setTimeout(() => setIsSaving(false), 500); }
  }, []);

  const handleDeleteWarehouseEntry = async (logEntry: WarehouseMovement) => {
    setIsSaving(true);
    const supplierCpf = suppliers.find(s => superNormalize(s.name) === superNormalize(logEntry.supplierName))?.cpf;
    let estornoSucesso = true;
    
    if (supplierCpf) {
        try {
            await runTransaction(ref(database, `suppliers/${supplierCpf}`), (current) => {
                if (!current) return null;
                const deliveries = normalizeArray<any>(current.deliveries);

                if (logEntry.type === 'entrada') {
                    for (const del of deliveries) {
                        if (del.lots) {
                            del.lots = normalizeArray<any>(del.lots).filter(l => 
                                l.id !== logEntry.lotId && 
                                (superNormalize(l.lotNumber) !== superNormalize(logEntry.lotNumber))
                            );
                        }
                    }
                } else if (logEntry.type === 'saída') {
                    let qtyToRestore = Number(logEntry.quantity || 0);
                    const normReqItem = superNormalize(logEntry.itemName);
                    const normReqLot = superNormalize(logEntry.lotNumber);
                    let found = false;

                    for (const d of deliveries) {
                        if (superNormalize(d.item) !== normReqItem) continue;
                        const lots = normalizeArray<any>(d.lots);
                        for (const l of lots) {
                            if (superNormalize(l.lotNumber) === normReqLot) {
                                l.remainingQuantity = Number((Number(l.remainingQuantity || 0) + qtyToRestore).toFixed(4));
                                qtyToRestore = 0;
                                found = true;
                                break;
                            }
                        }
                        if (qtyToRestore <= 0) break;
                    }
                    if (!found) estornoSucesso = false;
                }

                current.deliveries = deliveries;
                return current;
            });
        } catch (e) { console.error("Erro no estorno:", e); estornoSucesso = false; }
    }

    try {
        await set(ref(database, `warehouseLog/${logEntry.id}`), null);
        setIsSaving(false);
        if (!estornoSucesso && logEntry.type === 'saída') {
            return { success: true, message: "Registro removido do histórico, mas o saldo não pôde ser estornado (lote não encontrado)." };
        }
        return { success: true, message: "Registro removido com sucesso." };
    } catch (e) {
        setIsSaving(false);
        return { success: false, message: "Erro ao comunicar com o banco de dados." };
    }
  };

  const handleUpdateInvoiceItems = async (supplierCpf: string, invoiceNumber: string, newItems: { name: string; kg: number; value: number }[]) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${supplierCpf}`);
    try {
        await runTransaction(supplierRef, (current) => {
            if (!current) return null;
            let deliveries = normalizeArray<any>(current.deliveries);
            const originalDate = deliveries.find(d => d.invoiceNumber === invoiceNumber)?.date || new Date().toISOString().split('T')[0];
            deliveries = deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
            const nDels: Delivery[] = newItems.map((it, idx) => ({ 
                id: `del-edit-${Date.now()}-${idx}`, 
                date: originalDate, 
                time: '08:00', 
                item: it.name.toUpperCase().trim(), 
                kg: Number(it.kg), 
                value: Number(it.value), 
                invoiceUploaded: true, 
                invoiceNumber: invoiceNumber 
            }));
            current.deliveries = [...deliveries, ...nDels];
            return current;
        });
        setIsSaving(false);
        return { success: true };
    } catch (e) {
        setIsSaving(false);
        return { success: false, message: "Erro ao atualizar faturamento no servidor." };
    }
  };

  const handleManualInvoiceEntry = async (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${supplierCpf}`);
    try {
        await runTransaction(supplierRef, (current) => {
            if (!current) return null;
            const deliveries = normalizeArray<any>(current.deliveries);
            const nDels: Delivery[] = items.map((it, idx) => ({ 
                id: `del-manual-${Date.now()}-${idx}`, 
                date: date, 
                time: '08:00', 
                item: it.name.toUpperCase().trim(), 
                kg: Number(it.kg), 
                value: Number(it.value), 
                invoiceUploaded: true, 
                invoiceNumber: invoiceNumber 
            }));
            current.deliveries = [...deliveries, ...nDels];
            return current;
        });
        setIsSaving(false);
        return { success: true };
    } catch (e) {
        setIsSaving(false);
        return { success: false, message: "Erro ao salvar faturamento manual." };
    }
  };

  const handleScheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${supplierCpf}`);
    try {
      await runTransaction(supplierRef, (current) => {
        if (!current) return null;
        const deliveries = normalizeArray<any>(current.deliveries);
        deliveries.push({ id: `del-${Date.now()}`, date, time, item: 'AGENDAMENTO PENDENTE', invoiceUploaded: false });
        current.deliveries = deliveries;
        return current;
      });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleFulfillAndInvoice = async (supplierCpf: string, placeholderIds: string[], inv: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${supplierCpf}`);
    let targetSupplierName = '';

    try {
      const result = await runTransaction(supplierRef, (current) => {
        if (!current) return null;
        targetSupplierName = current.name;
        let deliveries = normalizeArray<any>(current.deliveries);
        const originalPlaceholder = deliveries.find(d => placeholderIds.includes(d.id));
        const date = originalPlaceholder?.date || new Date().toISOString().split('T')[0];
        const remaining = deliveries.filter(d => !placeholderIds.includes(d.id));
        const nDels: Delivery[] = inv.fulfilledItems.map((it, idx) => ({ 
            id: `del-f-${Date.now()}-${idx}`, 
            date, 
            time: '08:00', 
            item: it.name.toUpperCase().trim(), 
            kg: Number(it.kg), 
            value: Number(it.value), 
            invoiceUploaded: true, 
            invoiceNumber: inv.invoiceNumber 
        }));
        current.deliveries = [...remaining, ...nDels];
        return current;
      });

      if (result.committed) {
        const subj = `ENVIO DE NOTA FISCAL - ${targetSupplierName} - NF ${inv.invoiceNumber}`;
        let b = `Olá,\n\nSegue em anexo a Nota Fiscal nº ${inv.invoiceNumber}.\n\nItens:\n`;
        inv.fulfilledItems.forEach(i => b += `- ${i.name}: ${i.kg.toFixed(2)} Kg\n`);
        const mailto = `mailto:dg@ptaiuva.sap.gov.br?cc=almoxarifado@ptaiuva.sap.gov.br&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(b)}`;
        setEmailModalData({ recipient: "dg@ptaiuva.sap.gov.br", cc: "almoxarifado@ptaiuva.sap.gov.br", subject: subj, body: b, mailtoLink: mailto });
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleCancelDeliveries = async (sCpf: string, ids: string[]) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${sCpf}`);
    try {
        await runTransaction(supplierRef, (current) => {
            if (!current) return null;
            let deliveries = normalizeArray<any>(current.deliveries);
            // Filtro rigoroso: mantém apenas quem NÃO está na lista de IDs a remover
            current.deliveries = deliveries.filter(d => !ids.includes(d.id));
            return current;
        });
    } catch (e) { 
        console.error("Falha ao cancelar entregas:", e); 
        alert("Erro ao remover registro. Tente novamente.");
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleReopenInvoice = async (sCpf: string, invNum: string) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${sCpf}`);
    try {
        await runTransaction(supplierRef, (current) => {
            if (!current) return null;
            let deliveries = normalizeArray<any>(current.deliveries);
            const dates = [...new Set(deliveries.filter(d => d.invoiceNumber === invNum).map(d => d.date))];
            const remaining = deliveries.filter(d => d.invoiceNumber !== invNum);
            const reAgendamentos = dates.map(dt => ({ 
                id: `del-re-${Date.now()}-${Math.random()}`, 
                date: dt, 
                time: '08:00', 
                item: 'AGENDAMENTO PENDENTE', 
                invoiceUploaded: false 
            }));
            current.deliveries = [...remaining, ...reAgendamentos];
            return current;
        });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleDeleteInvoice = async (sCpf: string, invNum: string) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${sCpf}`);
    try {
        await runTransaction(supplierRef, (current) => {
            if (!current) return null;
            let deliveries = normalizeArray<any>(current.deliveries);
            current.deliveries = deliveries.filter(d => d.invoiceNumber !== invNum);
            return current;
        });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleRegisterDirectorWithdrawal = async (log: Omit<DirectorPerCapitaLog, 'id'>) => {
    const nLog: DirectorPerCapitaLog = { ...log, id: `dir-${Date.now()}` };
    let tempS = JSON.parse(JSON.stringify(suppliers)) as Supplier[];
    const ts = new Date().toISOString();

    for (const req of log.items) {
      let need = Number(req.quantity);
      const nReqName = superNormalize(req.name);
      const lots = tempS.flatMap(s => s.deliveries.filter(d => superNormalize(d.item) === nReqName && d.lots).map(d => ({ s, d })))
                        .sort((a, b) => a.d.date.localeCompare(b.d.date));

      for (const entry of lots) {
        if (need <= 0) break;
        for (const lot of (entry.d.lots || [])) {
          if (need <= 0) break;
          if (Number(lot.remainingQuantity) > 0) {
            const take = Math.min(Number(lot.remainingQuantity), need);
            lot.remainingQuantity = Number((Number(lot.remainingQuantity) - take).toFixed(4));
            need -= take;
            const logRef = push(warehouseLogRef);
            await set(logRef, { id: logRef.key, type: 'saída', timestamp: ts, lotId: lot.id, lotNumber: lot.lotNumber, itemName: req.name.toUpperCase(), supplierName: entry.s.name, deliveryId: entry.d.id, outboundInvoice: `DIR-${log.recipient.substring(0,3).toUpperCase()}`, quantity: take, expirationDate: lot.expirationDate });
          }
        }
      }
    }
    await writeToDatabase(directorWithdrawalsRef, [nLog, ...directorWithdrawals]);
    await writeToDatabase(suppliersRef, tempS.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}));
    return { success: true, message: 'OK' };
  };

  const handleLogin = (n: string, c: string): boolean => {
    const cl = c.replace(/[^\d]/g, '');
    if (n.toLowerCase() === 'administrador' && cl === '15210361870') { setIsAdminLoggedIn(true); return true; }
    if (n.toLowerCase() === 'almoxarifado' && c === 'almoxarifado123') { setIsAlmoxarifadoLoggedIn(true); return true; }
    const u = suppliers.find(p => p.name === n.toUpperCase() && p.cpf === cl);
    if (u) { setCurrentUser(u); return true; }
    return false;
  };

  const handleRegister = async (n: string, c: string, w: number[]) => {
    const fn = n.trim().toUpperCase(); const fc = c.replace(/[^\d]/g, '');
    await runTransaction(suppliersRef, (curr) => { const obj = curr || {}; if (obj[fc]) return; obj[fc] = { name: fn, cpf: fc, initialValue: 0, contractItems: [], deliveries: [], allowedWeeks: w }; return obj; });
    setRegistrationStatus({ success: true, message: `Cadastrado!` });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="animate-pulse">Sincronizando...</p></div>;

  return (
    <>
      <div className={`fixed bottom-4 right-4 z-50 ${isSaving ? 'opacity-100' : 'opacity-0'}`}><div className="bg-blue-600 text-white px-3 py-2 rounded-full shadow text-xs font-bold animate-pulse">Gravando...</div></div>
      {isAdminLoggedIn ? <AdminDashboard suppliers={suppliers} warehouseLog={warehouseLog} cleaningLogs={cleaningLogs} directorWithdrawals={directorWithdrawals} onRegister={handleRegister} onPersistSuppliers={(s) => writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}))} onUpdateSupplier={async (o, n, c, w) => { await runTransaction(suppliersRef, (curr) => { if(!curr || !curr[o]) return; const d = { ...curr[o], name: n.toUpperCase(), cpf: c, allowedWeeks: w }; if(o !== c) delete curr[o]; curr[c] = d; return curr; }); return null; }} onLogout={() => setIsAdminLoggedIn(false)} onResetData={() => writeToDatabase(suppliersRef, {})} onRestoreData={async (s) => { await writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {})); return true; }} activeTab={adminActiveTab} onTabChange={setAdminActiveTab} registrationStatus={registrationStatus} onClearRegistrationStatus={() => setRegistrationStatus(null)} onReopenInvoice={handleReopenInvoice} onDeleteInvoice={handleDeleteInvoice} onUpdateInvoiceItems={handleUpdateInvoiceItems} onManualInvoiceEntry={handleManualInvoiceEntry} perCapitaConfig={perCapitaConfig} onUpdatePerCapitaConfig={(c) => writeToDatabase(perCapitaConfigRef, c)} onDeleteWarehouseEntry={handleDeleteWarehouseEntry} onRegisterCleaningLog={async (l) => { await set(ref(database, `cleaningLogs/${Date.now()}`), { ...l, id: String(Date.now()) }); return {success: true, message: 'OK'}; }} onDeleteCleaningLog={async (id) => set(ref(database, `cleaningLogs/${id}`), null)} onRegisterDirectorWithdrawal={handleRegisterDirectorWithdrawal} onDeleteDirectorWithdrawal={async (id) => set(ref(database, `directorWithdrawals/${id}`), null)} standardMenu={standardMenu} dailyMenus={dailyMenus} onUpdateStandardMenu={(m) => writeToDatabase(standardMenuRef, m)} onUpdateDailyMenu={(m) => writeToDatabase(dailyMenusRef, m)} onRegisterEntry={handleRegisterWarehouseEntry} onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} onCancelDeliveries={handleCancelDeliveries} />
      : currentUser ? <Dashboard supplier={currentUser} onLogout={() => setCurrentUser(null)} onScheduleDelivery={handleScheduleDelivery} onFulfillAndInvoice={handleFulfillAndInvoice} onCancelDeliveries={handleCancelDeliveries} emailModalData={emailModalData} onCloseEmailModal={() => setEmailModalData(null)} />
      : isAlmoxarifadoLoggedIn ? <AlmoxarifadoDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} onRegisterEntry={handleRegisterWarehouseEntry} onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} />
      : <LoginScreen onLogin={handleLogin} />}
    </>
  );
};

export default App;
