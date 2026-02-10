
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

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
 * PADRONIZADOR DE DATA 2026 - VERSÃO SUPREMA
 * Garante que Janeiro seja 01 em qualquer circunstância.
 */
const standardizeDate = (rawDate: any): string => {
    if (!rawDate) return "";
    let s = String(rawDate).trim().toLowerCase();

    // Caso Excel Serial
    if (!isNaN(Number(s)) && Number(s) > 40000) {
        const excelDate = parseFloat(s);
        const date = new Date(Date.UTC(1899, 11, 30)); 
        date.setUTCDate(date.getUTCDate() + Math.floor(excelDate));
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `2026-${m}-${d}`;
    }

    // Detecção Manual de Janeiro
    if (s.includes('jan')) return `2026-01-${s.replace(/[^0-9]/g, '').slice(0,2).padStart(2,'0')}`;

    // Normalização de Separadores
    s = s.split(' ')[0].split('t')[0].replace(/[\.\/]/g, '-');
    const parts = s.split('-').filter(p => p.length > 0);
    
    if (parts.length === 2) {
        // Assume DD-MM -> 2026-MM-DD
        return `2026-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    if (parts.length === 3) {
        let d, m, y = "2026";
        // Se o primeiro é ano (YYYY-MM-DD)
        if (parts[0].length === 4) {
            m = parts[1].padStart(2, '0');
            d = parts[2].padStart(2, '0');
        } else {
            // Se o último é ano (DD-MM-YYYY)
            d = parts[0].padStart(2, '0');
            m = parts[1].padStart(2, '0');
        }
        return `2026-${m}-${d}`;
    }
    return s;
};

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
  const [standardMenu, setStandardMenu] = useState<StandardMenu>({});
  const [dailyMenus, setDailyMenus] = useState<DailyMenus>({});
  const [loading, setLoading] = useState(true);
  const [loggedInCpf, setLoggedInCpf] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isItespLoggedIn, setIsItespLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubSuppliers = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      const raw = normalizeArray<any>(data);
      setSuppliers(raw.map(p => ({
          ...p,
          name: (p.name || 'SEM NOME').toUpperCase().trim(),
          cpf: p.cpf || String(Math.random()),
          contractItems: normalizeArray(p.contractItems).map((ci: any) => ({ ...ci, name: (ci.name || '').toUpperCase().trim(), totalKg: cleanNumericValue(ci.totalKg), valuePerKg: cleanNumericValue(ci.valuePerKg) })),
          deliveries: normalizeArray<any>(p.deliveries).map((d: any) => ({ ...d, date: standardizeDate(d.date), item: (d.item || '').toUpperCase().trim(), kg: cleanNumericValue(d.kg), value: cleanNumericValue(d.value) })),
          allowedWeeks: normalizeArray<number>(p.allowedWeeks),
          initialValue: cleanNumericValue(p.initialValue),
      })));
      setLoading(false);
    });

    const unsubLog = onValue(warehouseLogRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setWarehouseLog([]); return; }
      setWarehouseLog(Object.entries(data).map(([key, val]: [string, any]) => ({
          ...val,
          id: val.id || key,
          date: standardizeDate(val.date || val.invoiceDate || (val.timestamp ? val.timestamp.split('T')[0] : "")),
          quantity: cleanNumericValue(val.quantity),
          itemName: (val.itemName || "").toUpperCase().trim(),
          supplierName: (val.supplierName || "").toUpperCase().trim()
      })));
    });

    onValue(cleaningLogsRef, (snapshot) => setCleaningLogs(normalizeArray(snapshot.val())));
    onValue(directorWithdrawalsRef, (snapshot) => setDirectorWithdrawals(normalizeArray(snapshot.val())));
    onValue(perCapitaConfigRef, (snapshot) => setPerCapitaConfig(snapshot.val() || {}));
    onValue(standardMenuRef, (snapshot) => setStandardMenu(snapshot.val() || {}));
    onValue(dailyMenusRef, (snapshot) => setDailyMenus(snapshot.val() || {}));
    return () => {};
  }, []);

  const handleLogin = (n: string, c: string): boolean => {
    const inputNameNorm = superNormalize(n);
    if (inputNameNorm === 'nomedopainda' && c === 'itesp2026') { setIsItespLoggedIn(true); return true; }
    if (inputNameNorm === 'administrador' && c === '15210361870') { setIsAdminLoggedIn(true); return true; }
    if (inputNameNorm === 'almoxarifado' && c === 'almoxarifado123') { setIsAlmoxarifadoLoggedIn(true); return true; }
    if (inputNameNorm === 'itesp' && c === 'taiuvaitesp2026') { setIsItespLoggedIn(true); return true; }
    const u = suppliers.find(p => superNormalize(p.name) === inputNameNorm && p.cpf === c.replace(/[^\d]/g, ''));
    if (u) { setLoggedInCpf(u.cpf); return true; }
    return false;
  };

  const writeToDatabase = useCallback(async (dbRef: any, data: any) => {
    setIsSaving(true);
    try { await set(dbRef, data); } finally { setTimeout(() => setIsSaving(false), 500); }
  }, []);

  const handleUpdateWarehouseEntry = useCallback(async (updatedEntry: WarehouseMovement) => {
    setIsSaving(true);
    try {
        const entryRef = ref(database, `warehouseLog/${updatedEntry.id}`);
        await update(entryRef, {
            ...updatedEntry,
            itemName: updatedEntry.itemName.toUpperCase().trim(),
            supplierName: updatedEntry.supplierName.toUpperCase().trim(),
            lotNumber: updatedEntry.lotNumber.toUpperCase().trim(),
            date: standardizeDate(updatedEntry.date)
        });
        return { success: true, message: 'Registro atualizado com sucesso.' };
    } catch (error: any) {
        return { success: false, message: error.message };
    } finally {
        setTimeout(() => setIsSaving(false), 500);
    }
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-green-800 italic animate-pulse tracking-tighter">CARREGANDO DADOS...</div>;

  return (
    <>
      <div className={`fixed top-4 right-4 z-[9999] p-2 bg-blue-600 text-white text-[10px] font-bold rounded shadow-lg transition-opacity ${isSaving ? 'opacity-100' : 'opacity-0'}`}>SINC...</div>
      {isAdminLoggedIn ? (
        <AdminDashboard 
            suppliers={suppliers} warehouseLog={warehouseLog} cleaningLogs={cleaningLogs} directorWithdrawals={directorWithdrawals}
            onPersistSuppliers={(s) => writeToDatabase(suppliersRef, s.reduce((acc, p) => ({ ...acc, [p.cpf]: p }), {}))} 
            onLogout={() => setIsAdminLoggedIn(false)} 
            onResetData={() => writeToDatabase(suppliersRef, {})}
            perCapitaConfig={perCapitaConfig}
            onUpdatePerCapitaConfig={(c) => writeToDatabase(perCapitaConfigRef, c)}
            standardMenu={standardMenu}
            dailyMenus={dailyMenus}
            onUpdateDailyMenu={(m) => writeToDatabase(dailyMenusRef, m)}
            onRegister={async () => {}}
            onUpdateSupplier={async () => null}
            onRestoreData={async () => true}
            registrationStatus={null}
            onClearRegistrationStatus={() => {}}
            onReopenInvoice={async () => {}}
            onDeleteInvoice={async () => {}}
            onUpdateInvoiceItems={async () => ({success: true})}
            onManualInvoiceEntry={async () => ({success: true})}
            onDeleteWarehouseEntry={async () => ({success: true, message: ''})}
            onUpdateWarehouseEntry={handleUpdateWarehouseEntry}
            onRegisterCleaningLog={async () => ({success: true, message: ''})}
            onDeleteCleaningLog={async () => {}}
            onRegisterDirectorWithdrawal={async () => ({success: true, message: ''})}
            onDeleteDirectorWithdrawal={async () => {}}
            onUpdateStandardMenu={async () => {}}
            onRegisterEntry={async () => ({success: true, message: ''})}
            onRegisterWithdrawal={async () => ({success: true, message: ''})}
            onCancelDeliveries={() => {}}
        />
      ) : isItespLoggedIn ? (
        <ItespDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsItespLoggedIn(false)} />
      ) : isAlmoxarifadoLoggedIn ? (
        <AlmoxarifadoDashboard suppliers={suppliers} warehouseLog={warehouseLog} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} onRegisterEntry={async () => ({success: true, message: ''})} onRegisterWithdrawal={async () => ({success: true, message: ''})} />
      ) : loggedInCpf ? (
        <Dashboard supplier={suppliers.find(s => s.cpf === loggedInCpf)!} onLogout={() => setLoggedInCpf(null)} onScheduleDelivery={() => {}} onFulfillAndInvoice={() => {}} onCancelDeliveries={() => {}} emailModalData={null} onCloseEmailModal={() => {}} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </>
  );
};

export default App;
