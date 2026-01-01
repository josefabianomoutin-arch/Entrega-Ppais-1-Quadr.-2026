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

  // Efeito para ouvir mudanças no banco de dados em tempo real
  useEffect(() => {
    setLoading(true);
    // onValue estabelece uma conexão persistente. Ele é chamado uma vez com os dados
    // iniciais e, depois, toda vez que os dados mudam na nuvem.
    const unsubscribe = onValue(producersRef, (snapshot) => {
      const data = snapshot.val();
      
      // CORREÇÃO: Garante que os dados sejam sempre um array.
      // O Firebase pode retornar um objeto se os índices da lista não forem sequenciais.
      // Object.values() converte o objeto de volta para um array, tornando o app mais robusto.
      const producersArray = data ? Object.values(data) : [];

      setProducers(producersArray as Producer[]);
      setLoading(false);
    }, (error) => {
      console.error("Falha ao ler dados do Firebase: ", error);
      setLoading(false);
    });

    // Retorna uma função de limpeza para remover o ouvinte quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Função central para escrever no banco de dados
  const updateDatabase = (updatedProducers: Producer[]) => {
    setIsSaving(true);
    set(producersRef, updatedProducers)
      .catch((error) => console.error("Falha ao salvar dados no Firebase", error))
      .finally(() => {
        setTimeout(() => setIsSaving(false), 500);
      });
  };

  const handleLogin = (name: string, cpf: string): boolean => {
    if (name.toLowerCase() === 'administrador' && cpf === '15210361870') {
      setIsAdminLoggedIn(true);
      setCurrentUser(null);
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
  
  const handleRegister = (name: string, cpf: string, allowedWeeks: number[]): Promise<boolean> => {
    const nameExists = producers.some(p => p.name === name);
    const cpfExists = producers.some(p => p.cpf === cpf);

    if (nameExists || cpfExists) return Promise.resolve(false);
    
    const newProducer: Producer = {
      id: `produtor-${Date.now()}`,
      name,
      cpf,
      initialValue: 0,
      contractItems: [],
      deliveries: [],
      allowedWeeks,
    };
    
    updateDatabase([...producers, newProducer]);
    return Promise.resolve(true);
  };

  const handleUpdateProducers = (updatedProducers: Producer[]) => {
    updateDatabase(updatedProducers);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados na nuvem? Esta ação é irreversível e afetará todos os usuários.')) {
      updateDatabase([]);
    }
  };

  const handleRestoreData = (backupProducers: Producer[]): Promise<boolean> => {
     try {
        updateDatabase(backupProducers);
        return Promise.resolve(true);
     } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        return Promise.resolve(false);
     }
  };

  const addDeliveries = (producerId: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));

    const updatedProducers = producers.map(p => 
        p.id === producerId 
            ? { ...p, deliveries: [...(p.deliveries || []), ...newDeliveries] } 
            : p
    );
    updateDatabase(updatedProducers);
  };

  const cancelDeliveries = (producerId: string, deliveryIds: string[]) => {
    const updatedProducers = producers.map(p => {
        if (p.id === producerId) {
            const updatedDeliveries = p.deliveries.filter(d => !deliveryIds.includes(d.id));
            return { ...p, deliveries: updatedDeliveries };
        }
        return p;
    });
    updateDatabase(updatedProducers);
  };

  const markInvoicesAsUploaded = (producerId: string, deliveryIds: string[], invoiceNumber: string) => {
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    const updatedProducers = producers.map(p => {
      if (p.id === producerId) {
        const updatedDeliveries = p.deliveries.map(d => 
          deliveryIds.includes(d.id) 
            ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
            : d
        );
        return { ...p, deliveries: updatedDeliveries };
      }
      return p;
    });
    updateDatabase(updatedProducers);

    const recipientEmail = 'seu-email-aqui@exemplo.com';
    const subject = `Envio de Nota Fiscal - Produtor: ${producer.name} (NF: ${invoiceNumber})`;

    const deliveriesForInvoice = producer.deliveries.filter(d => deliveryIds.includes(d.id));
    const itemsSummary = deliveriesForInvoice
        .map(d => `- ${d.item} (${d.kg.toFixed(2).replace('.',',')} Kg) - Data: ${new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}`)
        .join('\n');

    const body = `Olá,

Esta é uma submissão de nota fiscal através do aplicativo de gestão PPAIS.

**Detalhes:**
Produtor: ${producer.name}
CPF: ${producer.cpf}
Número da NF: ${invoiceNumber}

**Entregas associadas a esta NF:**
${itemsSummary}

----------------------------------------------------
ATENÇÃO: Por favor, anexe o arquivo PDF da nota fiscal a este e-mail antes de enviar.
    `.trim();

    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  // Atualiza o currentUser quando a lista de produtores (vinda do Firebase) mudar
  useEffect(() => {
    if (currentUser) {
      const updatedUser = producers.find(p => p.id === currentUser.id);
      setCurrentUser(updatedUser || null);
    }
  }, [producers, currentUser?.id]);

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