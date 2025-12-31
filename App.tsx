import React, { useState, useEffect, useCallback } from 'react';
import type { Producer, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';

// Configuração do Banco de Dados Centralizado (Simulado com jsonstorage.net)
// Este ID único garante que apenas o seu aplicativo acesse seus dados.
const DATABASE_ID = '3a9f03a6-8f0a-4b3d-9d2c-5b8a1e4c7b6f';
const API_URL = `https://api.jsonstorage.net/v1/json/${DATABASE_ID}`;

const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Producer | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Função para buscar dados da nuvem
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        if(response.status === 404) {
          console.log("Banco de dados não encontrado, começando com dados vazios.");
          setProducers([]);
        } else {
          throw new Error(`Erro de rede: ${response.statusText}`);
        }
      } else {
        const data = await response.json();
        // A API pode retornar um objeto vazio se o bin estiver vazio
        setProducers(Array.isArray(data) ? data : []); 
      }
    } catch (error) {
      console.error("Falha ao carregar dados da nuvem", error);
      // Em caso de erro de rede, começa com a lista vazia para não travar o app
      setProducers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Efeito para carregar dados da nuvem na inicialização
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Efeito para salvar dados na nuvem sempre que 'producers' mudar
  useEffect(() => {
    // Não salva durante o carregamento inicial
    if (loading) {
      return;
    }

    const saveData = async () => {
      setIsSaving(true);
      try {
        await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(producers),
        });
      } catch (error) {
        console.error("Falha ao salvar dados na nuvem", error);
      } finally {
        // Adiciona um pequeno delay para a UI refletir o estado "Salvando..."
        setTimeout(() => setIsSaving(false), 500);
      }
    };
    
    // Debounce: Aguarda um pouco antes de salvar para evitar múltiplas chamadas
    const handler = setTimeout(() => {
        saveData();
    }, 1000);

    return () => {
        clearTimeout(handler);
    };

  }, [producers, loading]);


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
    
    const newProducerId = `produtor-${Date.now()}`;
    const newProducer: Producer = {
      id: newProducerId,
      name,
      cpf,
      initialValue: 0,
      contractItems: [],
      deliveries: [],
      allowedWeeks,
    };
    
    setProducers(prevProducers => [...prevProducers, newProducer]);
    return Promise.resolve(true);
  };

  const handleUpdateProducers = (updatedProducers: Producer[]) => {
    setProducers(updatedProducers);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = async () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados na nuvem? Esta ação é irreversível e afetará todos os usuários.')) {
      setProducers([]); // A alteração aqui vai disparar o useEffect para salvar o array vazio na nuvem
    }
  };

  const handleRestoreData = async (backupProducers: Producer[]): Promise<boolean> => {
     try {
        // Ao setar os produtores, o useEffect cuidará de enviar os novos dados para a nuvem
        setProducers(backupProducers); 
        return true;
     } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        return false;
     }
  };

  const addDeliveries = (producerId: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));

    setProducers(prevProducers => 
        prevProducers.map(p => 
            p.id === producerId 
                ? { ...p, deliveries: [...p.deliveries, ...newDeliveries] } 
                : p
        )
    );
  };

  const cancelDeliveries = (producerId: string, deliveryIds: string[]) => {
    setProducers(prevProducers => 
        prevProducers.map(p => {
            if (p.id === producerId) {
                const updatedDeliveries = p.deliveries.filter(d => !deliveryIds.includes(d.id));
                return { ...p, deliveries: updatedDeliveries };
            }
            return p;
        })
    );
  };

  const markInvoicesAsUploaded = (producerId: string, deliveryIds: string[], invoiceNumber: string) => {
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    // 1. Atualiza o estado interno para marcar a fatura como "enviada"
    setProducers(prevProducers => 
      prevProducers.map(p => {
        if (p.id === producerId) {
          const updatedDeliveries = p.deliveries.map(d => 
            deliveryIds.includes(d.id) 
              ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
              : d
          );
          return { ...p, deliveries: updatedDeliveries };
        }
        return p;
      })
    );

    // 2. Prepara o conteúdo do e-mail
    // IMPORTANTE: Altere o endereço de e-mail abaixo para o seu!
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

    // 3. Constrói e dispara o link mailto para abrir o cliente de e-mail do usuário
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailtoLink, '_blank');
  };


  // Atualiza o currentUser quando a lista de produtores mudar
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
          <p className="text-xl font-semibold text-gray-700">Carregando dados da nuvem...</p>
          <p className="text-gray-500">Aguarde, por favor.</p>
        </div>
      </div>
    );
  }

  return (
      <>
        {/* Indicador de salvamento */}
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
