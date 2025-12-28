import React, { useState, useEffect } from 'react';
import { initialProducers } from './constants';
import type { Producer, Delivery, ContractItem } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';

const getInitialProducers = (): Producer[] => {
  try {
    const savedData = window.localStorage.getItem('producersData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Garante que os dados carregados sejam um array para evitar erros em toda a aplicação.
      if (Array.isArray(parsedData)) {
        return parsedData;
      }
    }
    // Retorna o estado inicial (vazio) se não houver dados ou se os dados estiverem corrompidos.
    return initialProducers;
  } catch (error) {
    console.error("Falha ao carregar ou analisar produtores do localStorage, começando do zero.", error);
    // Retorna o estado inicial em caso de qualquer erro.
    return initialProducers;
  }
};

const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>(getInitialProducers);

  const [currentUser, setCurrentUser] = useState<Producer | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('producersData', JSON.stringify(producers));
    } catch (error)
{
      console.error('Erro ao salvar dados no localStorage:', error);
    }
  }, [producers]);

  const handleLogin = (name: string, cpf: string): boolean => {
    // Admin login check (name is case-insensitive, password is exact)
    if (name.toLowerCase() === 'administrador' && cpf === '15210361870') {
      setIsAdminLoggedIn(true);
      setCurrentUser(null);
      return true;
    }

    // Producer login check (name is uppercase, cpf is sanitized)
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
  
  const handleRegister = (name: string, cpf: string, allowedWeeks: number[]): boolean => {
    const nameExists = producers.some(p => p.name === name);
    const cpfExists = producers.some(p => p.cpf === cpf);

    if (nameExists || cpfExists) {
      return false; // Indicate failure due to duplicate
    }
    
    const newProducer: Producer = {
      id: `produtor-${Date.now()}`,
      name, // Stored in uppercase
      cpf,  // Stored as numbers only
      initialValue: 0, // Starts at 0, will be calculated when contract is added
      contractItems: [], // Starts empty
      deliveries: [],
      allowedWeeks,
    };

    setProducers(prevProducers => [...prevProducers, newProducer]);
    return true; // Indicate success
  };

  const handleUpdateProducers = (updatedProducers: Producer[]) => {
    setProducers(updatedProducers);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados de produtores, contratos e entregas? Esta ação é irreversível.')) {
      // Clear state
      setProducers(initialProducers);
      // Clear localStorage
      try {
        window.localStorage.removeItem('producersData');
      } catch (error) {
        console.error('Erro ao limpar dados do localStorage:', error);
      }
      // Logout admin
      handleLogout();
    }
  };

  const addDeliveries = (producerId: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));

    const updatedProducers = producers.map(p => {
        if (p.id === producerId) {
            return {
                ...p,
                deliveries: [...p.deliveries, ...newDeliveries]
            };
        }
        return p;
    });

    setProducers(updatedProducers);
    const updatedUser = updatedProducers.find(p => p.id === producerId);
    if (updatedUser) {
        setCurrentUser(updatedUser);
    }
  };

  const cancelDeliveries = (producerId: string, deliveryIds: string[]) => {
    const updatedProducers = producers.map(p => {
        if (p.id === producerId) {
            return {
                ...p,
                deliveries: p.deliveries.filter(d => !deliveryIds.includes(d.id))
            };
        }
        return p;
    });

    setProducers(updatedProducers);
    const updatedUser = updatedProducers.find(p => p.id === producerId);
    if (updatedUser) {
        setCurrentUser(updatedUser);
    }
  };

  const markInvoicesAsUploaded = (producerId: string, deliveryIds: string[], invoiceNumber: string) => {
      const producerToUpdate = producers.find(p => p.id === producerId);
      if (!producerToUpdate) return;

      // Cria um objeto de produtor atualizado em memória para realizar as verificações
      const updatedProducer = {
          ...producerToUpdate,
          deliveries: producerToUpdate.deliveries.map(d => 
              deliveryIds.includes(d.id) 
                  ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
                  : d
          )
      };

      // Define a data de simulação para a verificação
      const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');

      // Condição 1: Verifica se o valor do contrato foi totalmente entregue
      const totalDeliveredValue = updatedProducer.deliveries.reduce((sum, delivery) => sum + delivery.value, 0);
      const isContractComplete = totalDeliveredValue >= updatedProducer.initialValue;

      // Condição 2: Verifica se não há mais notas fiscais pendentes para entregas passadas
      const hasNoPendingInvoices = updatedProducer.deliveries
          .filter(d => new Date(d.date + 'T00:00:00') < SIMULATED_TODAY)
          .every(d => d.invoiceUploaded);
      
      // Se ambas as condições forem atendidas, remove o produtor
      if (isContractComplete && hasNoPendingInvoices) {
          setProducers(prevProducers => prevProducers.filter(p => p.id !== producerId));
          // Desloga o usuário, pois seus dados foram limpos
          setCurrentUser(null); 
      } else {
          // Se as condições não forem atendidas, apenas atualiza os dados do produtor
          const updatedProducers = producers.map(p => 
              p.id === producerId ? updatedProducer : p
          );
          setProducers(updatedProducers);
          setCurrentUser(updatedProducer);
      }
  };

  if (isAdminLoggedIn) {
    return <AdminDashboard 
        onRegister={handleRegister} 
        onUpdateProducers={handleUpdateProducers}
        onLogout={handleLogout} 
        producers={producers} 
        onResetData={handleResetData}
    />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Dashboard 
      producer={currentUser} 
      onLogout={handleLogout} 
      onAddDeliveries={addDeliveries}
      onInvoiceUpload={markInvoicesAsUploaded}
      onCancelDeliveries={cancelDeliveries}
    />
  );
};

export default App;