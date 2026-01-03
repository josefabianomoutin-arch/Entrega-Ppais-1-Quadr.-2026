
import React, { useState, useEffect } from 'react';
import type { Producer, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction } from 'firebase/database';
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
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);


  // Efeito para ouvir mudanças no banco de dados em tempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onValue(producersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        
        // Se não houver dados ou não for um objeto, significa que não há produtores.
        if (!data || typeof data !== 'object') {
          setProducers([]);
          return;
        }

        // Converte o objeto de produtores (chaveado por CPF) em um array.
        const producersArray: Producer[] = Object.values(data)
          .filter(
            (p): p is Producer => 
              p && 
              typeof p === 'object' && 
              typeof (p as any).cpf === 'string' && (p as any).cpf.trim() !== '' &&
              typeof (p as any).name === 'string' && (p as any).name.trim() !== ''
          )
          .map(p => ({
            ...p,
            // Garante que as propriedades sejam sempre arrays para evitar erros de runtime.
            // Esta é a correção para a tela branca.
            contractItems: p.contractItems || [],
            deliveries: p.deliveries || [],
            allowedWeeks: p.allowedWeeks || [],
            initialValue: p.initialValue || 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)); // Garante ordem consistente
        
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
      setProducers([]);
    });

    return () => unsubscribe();
  }, []);

  // Helper central para escrever no banco de dados com feedback visual
  // Usado para operações em massa, como salvar contratos.
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
  
  const handleRegister = async (name: string, cpf: string, allowedWeeks: number[]) => {
    setRegistrationStatus(null);
    setIsSaving(true);
    const finalName = name.trim().toUpperCase();
    const finalCpf = cpf.trim().replace(/[^\d]/g, '');
  
    if (!finalName || !finalCpf) {
      setRegistrationStatus({ success: false, message: 'Nome e CPF são obrigatórios.' });
      setIsSaving(false);
      return;
    }
    
    // Validação rápida no lado do cliente para feedback imediato
    if (producers.some(p => p.cpf === finalCpf)) {
      setRegistrationStatus({ success: false, message: 'Este CPF já está cadastrado.' });
      setIsSaving(false);
      return;
    }
    if (producers.some(p => p.name === finalName)) {
      setRegistrationStatus({ success: false, message: 'Este nome de produtor já está em uso.' });
      setIsSaving(false);
      return;
    }
    
    const newProducer: Producer = {
      name: finalName,
      cpf: finalCpf,
      initialValue: 0,
      contractItems: [],
      deliveries: [],
      allowedWeeks,
    };
  
    try {
      // Usa uma transação para garantir uma operação de escrita atômica e segura.
      // Esta é a verificação definitiva no servidor.
      const transactionResult = await runTransaction(producersRef, (currentData) => {
        // currentData será null se o nó 'producers' não existir, ou um objeto.
        const producersObject = currentData || {};

        // Verificação final no servidor: se o CPF já existir, aborta a transação.
        if (producersObject[finalCpf]) {
          return; // Retornar undefined aborta a transação.
        }
        
        // Adiciona o novo produtor ao objeto de produtores.
        producersObject[finalCpf] = newProducer;
        return producersObject; // Retorna os dados atualizados para serem salvos.
      });

      if (transactionResult.committed) {
        // Sucesso! O listener onValue cuidará da atualização da UI.
        setRegistrationStatus({ success: true, message: `Produtor "${finalName}" cadastrado com sucesso!` });
      } else {
        // A transação foi abortada por nós porque o produtor já existe.
        setRegistrationStatus({ success: false, message: 'Cadastro cancelado. O CPF já existe no servidor.' });
      }

    } catch (error: any) {
      console.error("Falha na transação de registro:", error);
      let errorMessage = 'Ocorreu um erro inesperado ao salvar na nuvem. Verifique sua conexão e tente novamente.';
      
      // Verifica códigos de erro específicos do Firebase
      if (error && error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Erro de permissão ao salvar. Verifique as Regras de Segurança do seu banco de dados Firebase. Elas podem estar impedindo a gravação de dados.';
      }

      setRegistrationStatus({ success: false, message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProducerData = async (oldCpf: string, newName: string, newCpf: string): Promise<string | null> => {
    setIsSaving(true);
    const finalName = newName.trim().toUpperCase();
    const finalCpf = newCpf.trim().replace(/[^\d]/g, '');

    if (!finalName || !finalCpf) {
      return 'Nome e CPF são obrigatórios.';
    }

    // Validação prévia para fornecer feedback rápido
    if (producers.some(p => p.cpf === finalCpf && p.cpf !== oldCpf)) {
      setIsSaving(false);
      return 'Este CPF já está cadastrado para outro produtor.';
    }
    if (producers.some(p => p.name === finalName && p.cpf !== oldCpf)) {
      setIsSaving(false);
      return 'Este nome de produtor já está em uso.';
    }

    try {
      const transactionResult = await runTransaction(producersRef, (currentData) => {
        if (!currentData || !currentData[oldCpf]) {
          return; // Aborta se o produtor original não existir mais
        }
        
        // Validação final no servidor para evitar condições de corrida
        if (oldCpf !== finalCpf && currentData[finalCpf]) {
            return; // Aborta se o novo CPF já foi pego
        }

        const producerData = { ...currentData[oldCpf] };
        producerData.name = finalName;
        producerData.cpf = finalCpf;

        // Move os dados se o CPF (a chave) mudou
        if (oldCpf !== finalCpf) {
          delete currentData[oldCpf];
        }
        currentData[finalCpf] = producerData;
        
        return currentData;
      });

      if (transactionResult.committed) {
        return null; // Sucesso
      } else {
        return 'A atualização falhou. Os dados podem ter sido alterados simultaneamente por outro usuário.';
      }
    } catch (error: any) {
      console.error("Falha na transação de atualização:", error);
      return 'Ocorreu um erro inesperado ao salvar na nuvem.';
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearRegistrationStatus = () => {
    setRegistrationStatus(null);
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
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8
 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Salvando na nuvem...
            </div>
        </div>

        {isAdminLoggedIn ? (
          <AdminDashboard 
            producers={producers}
            onRegister={handleRegister} 
            onUpdateProducers={handleUpdateProducers} 
            onUpdateProducer={handleUpdateProducerData}
            onLogout={handleLogout}
            onResetData={handleResetData}
            onRestoreData={handleRestoreData}
            activeTab={adminActiveTab}
            onTabChange={setAdminActiveTab}
            registrationStatus={registrationStatus}
            onClearRegistrationStatus={handleClearRegistrationStatus}
          />
        ) : currentUser ? (
          <Dashboard 
            producer={currentUser} 
            onLogout={handleLogout} 
            onAddDeliveries={addDeliveries}
            onCancelDeliveries={cancelDeliveries}
            onInvoiceUpload={markInvoicesAsUploaded}
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;
