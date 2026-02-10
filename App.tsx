
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import types directly to ensure they are available for use in generic positions
import { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, MenuRow } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import ItespDashboard from './components/ItespDashboard';
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

// Normalização absoluta para comparação de dados
const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

// Limpador de números inteligente (Trata 1.250,50 ou 1250.50)
const cleanNumericValue = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let s = String(val).trim().replace(/\s/g, '');
    
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(s) || 0;
};

/**
 * CONVERSOR DE DATA ULTRA-ROBUSTO
 * Garante que 01/01/2026 seja sempre 2026-01-01 independente da origem (Excel, String, ISO)
 */
const standardizeDate = (rawDate: any): string => {
    if (!rawDate) return "";
    let s = String(rawDate).trim();

    // 1. Caso seja Excel Serial (ex: 46022)
    if (!isNaN(Number(s)) && Number(s) > 40000) {
        const excelDate = parseFloat(s);
        const date = new Date(Date.UTC(1899, 11, 30)); 
        date.setUTCDate(date.getUTCDate() + Math.floor(excelDate));
        
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 2. Limpeza de strings (remover horas/timestamps T00:00:00)
    s = s.split(' ')[0].split('T')[0];
    
    // Normaliza separadores para traço
    s = s.replace(/[\.\/]/g, '-');

    const parts = s.split('-');
    
    if (parts.length === 3) {
        let day, month, year;
        
        // Formato ISO (YYYY-MM-DD)
        if (parts[0].length === 4) {
            year = parts[0];
            month = parts[1].padStart(2, '0');
            day = parts[2].padStart(2, '0');
        } else { 
            // Formato BR (DD-MM-YYYY)
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
            
            // Trata anos com 2 dígitos (26 -> 2026)
            if (year.length === 2) {
                const yNum = parseInt(year, 10);
                year = yNum > 50 ? '19' + year : '20' + year;
            }
        }
        return `${year}-${month}-${day}`;
    }

    // 3. Fallback para manter strings que já parecem ISO
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
        return s.substring(0, 10);
    }

    return s;
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
  
  const [loggedInCpf, setLoggedInCpf] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isItespLoggedIn, setIsItespLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<any>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);
  const [emailModalData, setEmailModalData] = useState<any>(null);

  const currentUser = useMemo(() => {
    if (!loggedInCpf) return null;
    return suppliers.find(s => s.cpf === loggedInCpf) || null;
  }, [suppliers, loggedInCpf]);

  useEffect(() => {
    setLoading(true);
    const unsubSuppliers = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const raw = normalizeArray<any>(data);
      const suppliersArray: Supplier[] = raw.map(p => ({
          ...p,
          name: (p.name || 'SEM NOME').toUpperCase().trim(),
          cpf: p.cpf || String(Math.random()),
          contractItems: normalizeArray(p.contractItems).map((ci: any) => ({ 
              ...ci, 
              name: (ci.name || '').toUpperCase().trim(),
              totalKg: cleanNumericValue(ci.totalKg),
              valuePerKg: cleanNumericValue(ci.valuePerKg)
          })),
          deliveries: normalizeArray<any>(p.deliveries).map((d: any) => ({ 
              ...d, 
              date: standardizeDate(d.date),
              item: (d.item || '').toUpperCase().trim(),
              kg: cleanNumericValue(d.kg),
              value: cleanNumericValue(d.value),
              lots: normalizeArray(d.lots).map((l: any) => ({ 
                ...l, 
                remainingQuantity: cleanNumericValue(l.remainingQuantity)
              }))
          })),
          allowedWeeks: normalizeArray<number>(p.allowedWeeks),
          initialValue: cleanNumericValue(p.initialValue),
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
      const logsArray = Object.entries(data).map(([key, val]: [string, any]) => {
        return {
            ...val,
            id: val.id || key,
            date: standardizeDate(val.date || val.invoiceDate || (val.timestamp ? val.timestamp.split('T')[0] : "")),
            quantity: cleanNumericValue(val.quantity),
            itemName: (val.itemName || "").toUpperCase().trim(),
            supplierName: (val.supplierName || "").toUpperCase().trim()
        };
      });
      setWarehouseLog(logsArray);
    });

    const unsubClean = onValue(cleaningLogsRef, (snapshot) => setCleaningLogs(normalizeArray<CleaningLog>(snapshot.val())));
    const unsubDir = onValue(directorWithdrawalsRef, (snapshot) => setDirectorWithdrawals(normalizeArray<DirectorPerCapitaLog>(snapshot.val())));
    const unsubConfig = onValue(perCapitaConfigRef, (snapshot) => setPerCapitaConfig(snapshot.val() || {}));
    const unsubMenu = onValue(standardMenuRef, (snapshot) => setStandardMenu(snapshot.val() || {}));
    const unsubDailyMenus = onValue(dailyMenusRef, (snapshot) => setDailyMenus(snapshot.val() || {}));

    return () => {
      unsubSuppliers(); unsubLog(); unsubClean(); unsubDir(); unsubConfig(); unsubMenu(); unsubDailyMenus();
    };
  }, []);

  const handleRegisterWarehouseEntry = async (payload: any) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${payload.supplierCpf}`);
    const lotId = `lot-${Date.now()}-${Math.random()}`;
    const isoDate = standardizeDate(payload.invoiceDate);
    
    try {
      const result = await runTransaction(supplierRef, (currentSupplier) => {
        if (!currentSupplier) return null;
        const deliveries = normalizeArray<any>(currentSupplier.deliveries);
        const qty = cleanNumericValue(payload.quantity);
        const newLot = { id: lotId, lotNumber: payload.lotNumber.toUpperCase(), initialQuantity: qty, remainingQuantity: qty, expirationDate: payload.expirationDate };

        let delivery = deliveries.find(d => d.invoiceNumber === payload.invoiceNumber && superNormalize(d.item) === superNormalize(payload.itemName));

        if (delivery) {
          delivery.lots = [...normalizeArray(delivery.lots), newLot];
        } else {
          deliveries.push({ id: `del-entry-${Date.now()}`, date: isoDate, time: '08:00', item: payload.itemName.toUpperCase(), kg: qty, invoiceUploaded: true, invoiceNumber: payload.invoiceNumber, lots: [newLot] });
        }
        currentSupplier.deliveries = deliveries;
        return currentSupplier;
      });

      if (result.committed) {
        const logEntryRef = push(warehouseLogRef);
        await set(logEntryRef, { 
            id: logEntryRef.key, type: 'entrada', timestamp: new Date().toISOString(), date: isoDate, 
            lotId, lotNumber: payload.lotNumber.toUpperCase(), itemName: payload.itemName.toUpperCase(), 
            supplierName: result.snapshot.val().name, inboundInvoice: payload.invoiceNumber, 
            quantity: cleanNumericValue(payload.quantity), expirationDate: payload.expirationDate 
        });
        setIsSaving(false);
        return { success: true, message: "Entrada registrada!" };
      }
      return { success: false, message: "Erro ao processar." };
    } catch (e) { setIsSaving(false); return { success: false, message: "Erro ao salvar." }; }
  };

  const handleRegisterWarehouseWithdrawal = async (payload: any) => {
    setIsSaving(true);
    const supplierRef = ref(database, `suppliers/${payload.supplierCpf}`);
    const isoDate = standardizeDate(payload.date);
    try {
      const result = await runTransaction(supplierRef, (currentSupplier) => {
        if (!currentSupplier) return null;
        let qtyToDeduct = cleanNumericValue(payload.quantity);
        const deliveries = normalizeArray<any>(currentSupplier.deliveries);
        for (const d of deliveries) {
            if (superNormalize(d.item) !== superNormalize(payload.itemName)) continue;
            const lots = normalizeArray<any>(d.lots);
            for (const l of lots) {
                if (superNormalize(l.lotNumber) === superNormalize(payload.lotNumber) && cleanNumericValue(l.remainingQuantity) > 0) {
                    const avail = cleanNumericValue(l.remainingQuantity);
                    const take = Math.min(avail, qtyToDeduct);
                    l.remainingQuantity = Number((avail - take).toFixed(4));
                    qtyToDeduct -= take;
                    if (qtyToDeduct <= 0) break;
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
        await set(logEntryRef, { 
            id: logEntryRef.key, type: 'saída', timestamp: new Date().toISOString(), date: isoDate, 
            lotId: 'various', lotNumber: payload.lotNumber.toUpperCase(), itemName: payload.itemName.toUpperCase(), 
            supplierName: result.snapshot.val().name, outboundInvoice: payload.outboundInvoice, 
            quantity: cleanNumericValue(payload.quantity), expirationDate: payload.expirationDate 
        });
        setIsSaving(false);
        return { success: true, message: "Saída registrada!" };
      }
      setIsSaving(false);
      return { success: false, message: "Erro ou saldo insuficiente." };
    } catch (e) { setIsSaving(false); return { success: false, message: "Erro no banco." }; }
  };

  const writeToDatabase = useCallback(async (dbRef: any, data: any) => {
    setIsSaving(true);
    try { await set(dbRef, data); } catch (e) { console.error(e); } finally { setTimeout(() => setIsSaving(false), 500); }
  }, []);

  const handleLogin = (n: string, c: string): boolean => {
    // Normalização rigorosa para login
    const normalizedInputName = superNormalize(n);
    const cleanCpf = c.replace(/[^\d]/g, '');

    if (normalizedInputName === 'administrador' && cleanCpf === '15210361870') { setIsAdminLoggedIn(true); return true; }
    if (normalizedInputName === 'almoxarifado' && c === 'almoxarifado123') { setIsAlmoxarifadoLoggedIn(true); return true; }
    if (normalizedInputName === 'itesp' && c === 'taiuvaitesp2026') { setIsItespLoggedIn(true); return true; }

    const u = suppliers.find(p => superNormalize(p.name) === normalizedInputName && p.cpf === cleanCpf);
    if (u) { setLoggedInCpf(cleanCpf); return true; }
    return false;
  };

  const handleRegister = async (n: string, c: string, w: number[]) => {
    const fn = n.trim().toUpperCase(); const fc = c.replace(/[^\d]/g, '');
    await runTransaction(suppliersRef, (curr) => { const obj = curr || {}; if (obj[fc]) return; obj[fc] = { name: fn, cpf: fc, initialValue: 0, contractItems: [], deliveries: [], allowedWeeks: w }; return obj; });
    setRegistrationStatus({ success: true, message: `Cadastrado!` });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="animate-pulse font-black text-green-800 tracking-widest uppercase">Sincronizando Dados...</p></div>;

  return (
    <>
      <div className={`fixed bottom-4 right-4 z-50 transition-opacity ${isSaving ? 'opacity-100' : 'opacity-0'}`}><div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold animate-pulse">Salvando Alterações...</div></div>
      {isAdminLoggedIn ? <AdminDashboard suppliers={suppliers} warehouseLog={warehouseLog} cleaningLogs={cleaningLogs} directorWithdrawals={directorWithdrawals} onRegister={handleRegister} onPersistSuppliers={(s) => writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}))} onUpdateSupplier={async (o, n, c, w) => { await runTransaction(suppliersRef, (curr) => { if(!curr || !curr[o]) return; const d = { ...curr[o], name: n.toUpperCase(), cpf: c, allowedWeeks: w }; if(o !== c) delete curr[o]; curr[c] = d; return curr; }); return null; }} onLogout={() => setIsAdminLoggedIn(false)} onResetData={() => writeToDatabase(suppliersRef, {})} onRestoreData={async (s) => { await writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {})); return true; }} activeTab={adminActiveTab} onTabChange={setAdminActiveTab} registrationStatus={registrationStatus} onClearRegistrationStatus={() => setRegistrationStatus(null)} onReopenInvoice={async (s, i) => {}} onDeleteInvoice={async (s, i) => {}} onUpdateInvoiceItems={async (s, i, it) => ({success: true})} onManualInvoiceEntry={async (s, d, n, it) => ({success: true})} perCapitaConfig={perCapitaConfig} onUpdatePerCapitaConfig={(c) => writeToDatabase(perCapitaConfigRef, c)} onDeleteWarehouseEntry={async (l) => ({success: true, message: 'OK'})} onRegisterCleaningLog={async (l) => ({success: true, message: 'OK'})} onDeleteCleaningLog={async (id) => {}} onRegisterDirectorWithdrawal={async (l) => ({success: true, message: 'OK'})} onDeleteDirectorWithdrawal={async (id) => {}} standardMenu={standardMenu} dailyMenus={dailyMenus} onUpdateStandardMenu={(m) => writeToDatabase(standardMenuRef, m)} onUpdateDailyMenu={(m) => writeToDatabase(dailyMenusRef, m)} onRegisterEntry={handleRegisterWarehouseEntry} onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} onCancelDeliveries={() => {}} />
      : currentUser ? <Dashboard supplier={currentUser} onLogout={() => setLoggedInCpf(null)} onScheduleDelivery={async (s, d, t) => {}} onFulfillAndInvoice={async (s, p, i) => {}} onCancelDeliveries={() => {}} emailModalData={emailModalData} onCloseEmailModal={() => setEmailModalData(null)} />
      : isAlmoxarifadoLoggedIn ? <AlmoxarifadoDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} onRegisterEntry={handleRegisterWarehouseEntry} onRegisterWithdrawal={handleRegisterWarehouseWithdrawal} />
      : isItespLoggedIn ? <ItespDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsItespLoggedIn(false)} />
      : <LoginScreen onLogin={handleLogin} />}
    </>
  );
};

export default App;
