import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, setDoc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebaseConfig';

import type { Producer, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';

const App: React.FC = () => {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Producer | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Carrega os dados do Firebase na inicialização
  useEffect(() => {
    const fetchProducers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'producers'));
        const producersData = querySnapshot.docs.map(doc => doc.data() as Producer);
        setProducers(producersData);
      } catch (error) {
        console.error("Falha ao carregar dados do Firebase:", error);
        alert("Erro de conexão com o banco de dados. Verifique a configuração do Firebase e sua conexão com a internet.");
        setProducers([]);
      }
      setLoading(false);
    };
    fetchProducers();
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
      await setDoc(doc(db, 'producers', newProducerId), newProducer);
      setProducers(prevProducers => [...prevProducers, newProducer]);
      return true;
    } catch (error) {
      console.error("Erro ao registrar produtor:", error);
      return false;
    }
  };

  const handleUpdateProducers = async (updatedProducers: Producer[]) => {
    try {
      const batch = writeBatch(db);
      updatedProducers.forEach(producer => {
        const producerRef = doc(db, 'producers', producer.id);
        batch.set(producerRef, producer); // Usar `set` para garantir que novos produtores sejam criados se não existirem
      });
      await batch.commit();
      setProducers(updatedProducers);
    } catch(error) {
      console.error("Erro ao atualizar produtores:", error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const handleResetData = async () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados na nuvem? Esta ação é irreversível.')) {
      try {
        const querySnapshot = await getDocs(collection(db, 'producers'));
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        setProducers([]);
        handleLogout();
      } catch (error) {
        console.error("Erro ao resetar dados:", error);
      }
    }
  };

  const handleRestoreData = async (backupProducers: Producer[]): Promise<boolean> => {
     try {
        // Limpa a coleção atual antes de restaurar
        const querySnapshot = await getDocs(collection(db, 'producers'));
        const deleteBatch = writeBatch(db);
        querySnapshot.docs.forEach(d => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
        
        // Adiciona os novos dados
        const restoreBatch = writeBatch(db);
        backupProducers.forEach(producer => {
            const docRef = doc(db, "producers", producer.id);
            restoreBatch.set(docRef, producer);
        });
        await restoreBatch.commit();
        
        setProducers(backupProducers);
        return true;
     } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        return false;
     }
  };

  const addDeliveries = async (producerId: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => {
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    const newDeliveries: Delivery[] = deliveries.map(delivery => ({
        ...delivery,
        id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        invoiceUploaded: false,
    }));
    
    const updatedDeliveries = [...producer.deliveries, ...newDeliveries];
    
    try {
        const producerRef = doc(db, 'producers', producerId);
        await updateDoc(producerRef, { deliveries: updatedDeliveries });
        setProducers(prev => prev.map(p => p.id === producerId ? {...p, deliveries: updatedDeliveries} : p));
    } catch(error) {
        console.error("Erro ao adicionar entrega:", error);
    }
  };

  const cancelDeliveries = async (producerId: string, deliveryIds: string[]) => {
    const producer = producers.find(p => p.id === producerId);
    if (!producer) return;

    const updatedDeliveries = producer.deliveries.filter(d => !deliveryIds.includes(d.id));
    
    try {
        const producerRef = doc(db, 'producers', producerId);
        await updateDoc(producerRef, { deliveries: updatedDeliveries });
        setProducers(prev => prev.map(p => p.id === producerId ? {...p, deliveries: updatedDeliveries} : p));
    } catch (error) {
        console.error("Erro ao cancelar entrega:", error);
    }
  };

  const markInvoicesAsUploaded = async (producerId: string, deliveryIds: string[], invoiceNumber: string, file: File) => {
      const producer = producers.find(p => p.id === producerId);
      if (!producer) return;

      const filePath = `invoices/${producerId}/${invoiceNumber}_${Date.now()}.pdf`;
      const storageRef = ref(storage, filePath);
      
      try {
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        const updatedDeliveries = producer.deliveries.map(d => 
            deliveryIds.includes(d.id) 
                ? { ...d, invoiceUploaded: true, invoiceNumber: invoiceNumber, invoiceDownloadURL: downloadURL } 
                : d
        );

        const producerRef = doc(db, 'producers', producerId);
        await updateDoc(producerRef, { deliveries: updatedDeliveries });

        setProducers(prev => prev.map(p => p.id === producerId ? {...p, deliveries: updatedDeliveries} : p));
      } catch (error) {
        console.error("Erro ao fazer upload da nota fiscal:", error);
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
          <p className="text-xl font-semibold text-gray-700">Conectando ao banco de dados...</p>
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
        onRestoreData={handleRestoreData}
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