import React, { useState, useEffect } from 'react';
import type { Producer, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

// Inicializa o Firebase e obtém uma referência ao banco de dados
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const producersRef = ref(database, 'producers');


const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Producer | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics'>('register');


  // Efeito para ouvir mudanças no banco de dados em tempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onValue(producersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        let producersArray: Producer[] = [];
        // Adiciona uma verificação robusta para garantir que os dados sejam válidos
        if (data && typeof data === 'object') {
          producersArray = Object.values(data)
            .filter(
              (p): p is Producer => p && typeof p === 'object' && 'cpf' in p && 'name' in p
            )
            .sort((a, b) => a.name.localeCompare(b.name)); // Garante ordem consistente
        }
        setProducers(producersArray);
      } catch (error) {
        console.error("Erro ao processar dados do Firebase:", error);
        setProducers([]); // Reseta para um estado seguro em caso de erro
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Falha ao ler dados do Firebase: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Helper central para escrever no banco de dados com feedback visual
  const writeToDatabase = async (producersArray: Producer[]) => {
    setIsSaving(true);
    try {
      const producersObject = producersArray.reduce((acc, producer) => {
        if (producer && producer.cpf) {
          acc[producer.cpf] = producer;
        }
        return acc;
      }, {} as { [key: string]: Producer });

      await set(producersRef, producersObject);
    } catch (error) {
      console.error("Falha ao salvar dados no Firebase", error);
      throw error;
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handleLogin = (name: string, cpf: string): boolean => {
    if (name.toLowerCase() === 'administrador' && cpf === '15210361870') {
      setIsAdminLoggedIn(true);
      setCurrentUser(null);
      setAdminActiveTab('register'); // Direciona para a aba de cadastro
      return true;
    }
    const upperCaseName = name.toUpperCase();
    const sanitizedCpf = cpf.replace(/[^\d]/g, '');
    const user = producers.find(p => p.name === upperCaseName && p.cpf === sanitizedCpf);

    if (user) {
      setCurrentUser(user);
      setIsAdminLoggedIn(false);
      return true;
    }
    return false;
  };
  
  const handleRegister = async (name: string, cpf: string, allowedWeeks: number[]): Promise<boolean> => {
    const finalName = name.trim().toUpperCase();
    const finalCpf = cpf.trim().replace(/[^\d]/g, '');
  
    if (!finalName || !finalCpf) {
      console.error("Nome ou CPF em branco não é permitido.");
      return false;
    }
  
    // Verifica a existência contra o estado atual para evitar escritas desnecessárias no DB
    if (producers.some(p => p.name === finalName || p.cpf === finalCpf)) {
      return false;
    }
    
    const newProducer: Producer = {
      name: finalName,
      cpf: finalCpf,
      initialValue: 0,
      contractItems: [],
      deliveries: [],
      allowedWeeks,
    };
    
    // Cria a lista atualizada que será enviada ao Firebase
    const updatedProducers = [...producers, newProducer];
  
    try {
      // Escreve no DB. O listener onValue será o único responsável por atualizar a UI.
      await writeToDatabase(updatedProducers);
      return true;
    } catch (error) {
      console.error("Falha ao registrar produtor:", error);
      return false;
    }
  };

  const handleUpdateProducers = (updatedProducers: Producer[]) => {
    writeToDatabase(updatedProducers);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados na nuvem? Esta ação é irreversível e afetará todos os usuários.')) {
      writeToDatabase([]);
    }
  };

  const handleRestoreData = async (backupProducers: Producer[]): Promise<boolean> => {
     try {
        await writeToDatabase(backupProducers);
        return true;
     } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        return false;
     }
  };

  const addDeliveries = async (producerCpf: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));

    const updatedProducers = producers.map(p => 
        p.cpf === producerCpf 
            ? { ...p, deliveries: [...(p.deliveries || []), ...newDeliveries] } 
            : p
    );
    
    try {
      await writeToDatabase(updatedProducers);
    } catch(error) {
      console.error("Falha ao adicionar entregas:", error);
    }
  };

  const cancelDeliveries = async (producerCpf: string, deliveryIds: string[]) => {
    const updatedProducers = producers.map(p => {
        if (p.cpf === producerCpf) {
            const updatedDeliveries = (p.deliveries || []).filter(d => !deliveryIds.includes(d.id));
            return { ...p, deliveries: updatedDeliveries };
        }
        return p;
    });

    try {
      await writeToDatabase(updatedProducers);
    } catch(error) {
      console.error("Falha ao cancelar entregas:", error);
    }
  };

  const markInvoicesAsUploaded = async (producerCpf: string, deliveryIds: string[], invoiceNumber: string) => {
    const producerForEmail = producers.find(p => p.cpf === producerCpf);
    if (!producerForEmail) return;

    const updatedProducers = producers.map(p => {
      if (p.cpf === producerCpf) {
        const updatedDeliveries = (p.deliveries || []).map(d => 
          deliveryIds.includes(d.id) 
            ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
            : d
        );
        return { ...p, deliveries: updatedDeliveries };
      }
      return p;
    });

    try {
      await writeToDatabase(updatedProducers);
    } catch (error) {
      console.error("Falha ao marcar fatura:", error);
      return;
    }
    
    const recipientEmail = 'seu-email-aqui@exemplo.com';
    const subject = `Envio de Nota Fiscal - Produtor: ${producerForEmail.name} (NF: ${invoiceNumber})`;
    const deliveriesForInvoice = (producerForEmail.deliveries || []).filter(d => deliveryIds.includes(d.id));
    const itemsSummary = deliveriesForInvoice
        .map(d => `- ${d.item} (${d.kg.toFixed(2).replace('.',',')} Kg) - Data: ${new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}`)
        .join('\n');
    const body = `Olá,\n\nEsta é uma submissão de nota fiscal através do aplicativo de gestão PPAIS.\n\n**Detalhes:**\nProdutor: ${producerForEmail.name}\nCPF: ${producerForEmail.cpf}\nNúmero da NF: ${invoiceNumber}\n\n**Entregas associadas a esta NF:**\n${itemsSummary}\n\n----------------------------------------------------\nATENÇÃO: Por favor, anexe o arquivo PDF da nota fiscal a este e-mail antes de enviar.`.trim();
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  useEffect(() => {
    if (currentUser) {
      const updatedUser = producers.find(p => p.cpf === currentUser.cpf);
      setCurrentUser(updatedUser || null);
    }
  }, [producers, currentUser?.cpf]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100/50">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-700">Conectando ao banco de dados...</p>
          <p className="text-gray-500">Aguarde, por favor.</p>
        </div>
      </div>
    );
  }

  return (
      <>
        <div className={`fixed bottom-4 right-4 z-50 transition-opacity duration-300 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Salvando na nuvem...
            </div>
        </div>

        {isAdminLoggedIn ? (
          <AdminDashboard 
              onRegister={handleRegister} 
              onUpdateProducers={handleUpdateProducers}
              onLogout={handleLogout} 
              producers={producers} 
              onResetData={handleResetData}
              onRestoreData={handleRestoreData}
              activeTab={adminActiveTab}
              onTabChange={setAdminActiveTab}
          />
        ) : !currentUser ? (
          <LoginScreen onLogin={handleLogin} />
        ) : (
          <Dashboard 
            producer={currentUser} 
            onLogout={handleLogout} 
            onAddDeliveries={addDeliveries}
            onInvoiceUpload={markInvoicesAsUploaded}
            onCancelDeliveries={cancelDeliveries}
          />
        )}
      </>
  );
};

export default App;