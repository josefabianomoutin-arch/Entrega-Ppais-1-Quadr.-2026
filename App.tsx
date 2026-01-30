
import React, { useState, useEffect } from 'react';
import type { Supplier, Delivery, WarehouseMovement, PerCapitaConfig, CleaningLog } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction, get } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const suppliersRef = ref(database, 'suppliers');
const warehouseLogRef = ref(database, 'warehouseLog');
const perCapitaConfigRef = ref(database, 'perCapitaConfig');
const cleaningLogsRef = ref(database, 'cleaningLogs');

const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Supplier | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning'>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);
  const [emailModalData, setEmailModalData] = useState<{
    recipient: string;
    cc: string;
    subject: string;
    body: string;
    mailtoLink: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribeSuppliers = onValue(suppliersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data || typeof data !== 'object') {
          setSuppliers([]);
          return;
        }
        const suppliersArray: Supplier[] = Object.values(data)
          .filter((p): p is Supplier => p && typeof p === 'object')
          .map(p => ({
            ...p,
            contractItems: p.contractItems || [],
            deliveries: (p.deliveries || []).map(d => ({ ...d, lots: d.lots || [], withdrawals: d.withdrawals || [] })),
            allowedWeeks: p.allowedWeeks || [],
            initialValue: p.initialValue || 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers(suppliersArray);
      } catch (error) { console.error(error); setSuppliers([]); } finally { setLoading(false); }
    });

    const unsubscribeWarehouseLog = onValue(warehouseLogRef, (snapshot) => {
      const data = snapshot.val();
      setWarehouseLog(data && Array.isArray(data) ? data : []);
    });

    const unsubscribeCleaningLogs = onValue(cleaningLogsRef, (snapshot) => {
      const data = snapshot.val();
      setCleaningLogs(data && Array.isArray(data) ? data : []);
    });
    
    const unsubscribePerCapitaConfig = onValue(perCapitaConfigRef, (snapshot) => {
      const data = snapshot.val();
      setPerCapitaConfig(data || {});
    });

    return () => {
      unsubscribeSuppliers();
      unsubscribeWarehouseLog();
      unsubscribeCleaningLogs();
      unsubscribePerCapitaConfig();
    };
  }, []);

  const writeToDatabase = async (dbRef: any, data: any) => {
      setIsSaving(true);
      try { await set(dbRef, data); } 
      catch (error) { console.error(error); throw error; } 
      finally { setTimeout(() => setIsSaving(false), 500); }
  };

  const handleRegisterCleaningLog = async (log: Omit<CleaningLog, 'id'>) => {
    const newLog: CleaningLog = { ...log, id: `log-${Date.now()}` };
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
    if (lowerCaseName === 'administrador' && cpf === '15210361870') {
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
    const user = suppliers.find(p => p.name === name.toUpperCase() && p.cpf === cpf.replace(/[^\d]/g, ''));
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
            onRegisterCleaningLog={handleRegisterCleaningLog}
            onDeleteCleaningLog={handleDeleteCleaningLog}
          />
        ) : currentUser ? (
          <Dashboard supplier={currentUser} onLogout={() => setCurrentUser(null)} onScheduleDelivery={async () => {}} onFulfillAndInvoice={async () => {}} onCancelDeliveries={async () => {}} emailModalData={null} onCloseEmailModal={() => {}} />
        ) : isAlmoxarifadoLoggedIn ? (
          <AlmoxarifadoDashboard suppliers={suppliers} onLogout={() => setIsAlmoxarifadoLoggedIn(false)} onRegisterEntry={async (p) => ({success:true, message:''})} onRegisterWithdrawal={async (p) => ({success:true, message:''})} />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;
