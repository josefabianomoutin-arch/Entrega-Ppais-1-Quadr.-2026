import React, { useState, useMemo } from 'react';
import { initialProducers } from './constants';
import type { Producer, Delivery, ContractItem } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>(initialProducers);
  const [currentUser, setCurrentUser] = useState<Producer | null>(null);

  const handleLogin = (name: string, cpf: string): boolean => {
    const user = producers.find(p => p.name.toLowerCase() === name.toLowerCase() && p.cpf === cpf);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };
  
  const handleRegister = (name: string, cpf: string, contractItems: ContractItem[]): boolean => {
    const nameExists = producers.some(p => p.name.toLowerCase() === name.toLowerCase());
    const cpfExists = producers.some(p => p.cpf === cpf);

    if (nameExists || cpfExists) {
      return false; // Indicate failure due to duplicate
    }
    
    const initialValue = contractItems.reduce((acc, item) => acc + item.value, 0);

    const newProducer: Producer = {
      id: `produtor-${Date.now()}`,
      name,
      cpf,
      initialValue,
      contractItems,
      deliveries: [],
    };

    setProducers(prevProducers => [...prevProducers, newProducer]);
    return true; // Indicate success
  };

  const handleLogout = () => {
    setCurrentUser(null);
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

  const markInvoicesAsUploaded = (producerId: string, deliveryIds: string[], invoiceNumber: string) => {
      const updatedProducers = producers.map(p => {
          if (p.id === producerId) {
              const updatedDeliveries = p.deliveries.map(d => 
                  deliveryIds.includes(d.id) 
                      ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
                      : d
              );
              return {
                  ...p,
                  deliveries: updatedDeliveries
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

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} producers={producers} />;
  }

  return (
    <Dashboard 
      producer={currentUser} 
      onLogout={handleLogout} 
      onAddDeliveries={addDeliveries}
      onInvoiceUpload={markInvoicesAsUploaded}
    />
  );
};

export default App;