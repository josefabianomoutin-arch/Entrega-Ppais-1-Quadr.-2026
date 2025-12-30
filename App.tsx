import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, doc, setDoc, updateDoc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';

import type { Producer, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Producer | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Efeito para carregar e ouvir dados do Firestore em tempo real
  useEffect(() => {
    setLoading(true);
    const producersCollectionRef = collection(db, 'producers');
    
    // onSnapshot cria um listener em tempo real
    const unsubscribe = onSnapshot(producersCollectionRef, (querySnapshot) => {
      const producersData: Producer[] = [];
      querySnapshot.forEach((doc) => {
        // Combina o ID do documento com os dados do documento
        producersData.push({ ...doc.data(), id: doc.id } as Producer);
      });
      setProducers(producersData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar dados do Firestore: ", error);
      setLoading(false);
    });

    // Função de limpeza para remover o listener quando o componente for desmontado
    return () => unsubscribe();
  }, []);

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
  
  const handleRegister = async (name: string, cpf: string, allowedWeeks: number[]): Promise<boolean> => {
    const nameExists = producers.some(p => p.name === name);
    const cpfExists = producers.some(p => p.cpf === cpf);

    if (nameExists || cpfExists) return false;
    
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
    
    try {
      // Cria um novo documento no Firestore com o ID gerado
      await setDoc(doc(db, "producers", newProducerId), newProducer);
      return true;
    } catch (error) {
      console.error("Erro ao registrar novo produtor: ", error);
      return false;
    }
  };

  const handleUpdateProducers = async (updatedProducers: Producer[]) => {
    // Usa um batch write para atualizar múltiplos documentos de uma vez
    const batch = writeBatch(db);
    updatedProducers.forEach(producer => {
      const producerRef = doc(db, "producers", producer.id);
      batch.set(producerRef, producer); // set substitui o documento inteiro
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("Erro ao atualizar produtores: ", error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = async () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados? Esta ação é irreversível.')) {
      try {
        const producersCollectionRef = collection(db, 'producers');
        const querySnapshot = await getDocs(producersCollectionRef);
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        handleLogout();
      } catch (error) {
        console.error('Erro ao limpar dados do Firestore:', error);
      }
    }
  };

  const addDeliveries = async (producerId: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const producerRef = doc(db, "producers", producerId);
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));

    const updatedDeliveries = [...producer.deliveries, ...newDeliveries];

    try {
      await updateDoc(producerRef, { deliveries: updatedDeliveries });
    } catch (error) {
      console.error("Erro ao adicionar entregas: ", error);
    }
  };

  const cancelDeliveries = async (producerId: string, deliveryIds: string[]) => {
    const producerRef = doc(db, "producers", producerId);
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    const updatedDeliveries = producer.deliveries.filter(d => !deliveryIds.includes(d.id));

    try {
      await updateDoc(producerRef, { deliveries: updatedDeliveries });
    } catch (error) {
      console.error("Erro ao cancelar entregas: ", error);
    }
  };

  const markInvoicesAsUploaded = async (producerId: string, deliveryIds: string[], invoiceNumber: string) => {
      const producerToUpdate = producers.find(p => p.id === producerId);
      if (!producerToUpdate) return;

      const updatedDeliveries = producerToUpdate.deliveries.map(d => 
          deliveryIds.includes(d.id) 
              ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber } 
              : d
      );

      const updatedProducer = { ...producerToUpdate, deliveries: updatedDeliveries };
      
      const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');
      const totalDeliveredValue = updatedProducer.deliveries.reduce((sum, delivery) => sum + delivery.value, 0);
      const isContractComplete = totalDeliveredValue >= updatedProducer.initialValue;
      const hasNoPendingInvoices = updatedProducer.deliveries
          .filter(d => new Date(d.date + 'T00:00:00') < SIMULATED_TODAY)
          .every(d => d.invoiceUploaded);
      
      try {
        if (isContractComplete && hasNoPendingInvoices) {
            await deleteDoc(doc(db, "producers", producerId));
            setCurrentUser(null); 
        } else {
            const producerRef = doc(db, "producers", producerId);
            await updateDoc(producerRef, { deliveries: updatedDeliveries });
        }
      } catch (error) {
          console.error("Erro ao marcar notas fiscais como enviadas:", error);
      }
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
          <p className="text-xl font-semibold text-gray-700">Carregando dados...</p>
          <p className="text-gray-500">Conectando ao banco de dados.</p>
        </div>
      </div>
    );
  }

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