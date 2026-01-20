import React, { useState, useEffect } from 'react';
import type { Supplier, Delivery } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

// Inicializa o Firebase e obtém uma referência ao banco de dados
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const suppliersRef = ref(database, 'suppliers');


const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Supplier | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule'>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);
  const [emailModalData, setEmailModalData] = useState<{
    recipient: string;
    cc: string;
    subject: string;
    body: string;
    mailtoLink: string;
  } | null>(null);


  // Efeito para ouvir mudanças no banco de dados em tempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onValue(suppliersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        
        // Se não houver dados ou não for um objeto, significa que não há fornecedores.
        if (!data || typeof data !== 'object') {
          setSuppliers([]);
          return;
        }

        // Converte o objeto de fornecedores (chaveado por CPF/CNPJ) em um array.
        const suppliersArray: Supplier[] = Object.values(data)
          .filter(
            (p): p is Supplier => 
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
        
        setSuppliers(suppliersArray);
      } catch (error) {
        console.error("Erro ao processar dados do Firebase:", error);
        setSuppliers([]); // Reseta para um estado seguro em caso de erro
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Falha ao ler dados do Firebase: ", error);
      setLoading(false);
      setSuppliers([]);
    });

    return () => unsubscribe();
  }, []);

  // Efeito para excluir agendamentos de um fornecedor específico (operação única)
  useEffect(() => {
    if (!loading && isAdminLoggedIn && suppliers.length > 0) {
      const operationFlag = 'deletedSchedules_LucimaraMarquesPereira_v1';
      if (localStorage.getItem(operationFlag)) {
        return;
      }

      const supplierToUpdate = suppliers.find(p => p.name === 'LUCIMARA MARQUES PEREIRA');

      if (supplierToUpdate) {
        console.log(`Iniciando exclusão de agendamentos para ${supplierToUpdate.name}...`);
        
        const supplierDeliveriesRef = ref(database, `suppliers/${supplierToUpdate.cpf}/deliveries`);
        
        set(supplierDeliveriesRef, [])
          .then(() => {
            console.log(`Agendamentos de ${supplierToUpdate.name} excluídos com sucesso.`);
            alert(`Todos os agendamentos da fornecedora LUCIMARA MARQUES PEREIRA foram removidos permanentemente, conforme solicitado.`);
            localStorage.setItem(operationFlag, 'true');
          })
          .catch((error) => {
            console.error(`Falha ao excluir agendamentos de ${supplierToUpdate.name}:`, error);
            alert(`Ocorreu um erro ao tentar remover os agendamentos. Por favor, verifique o console para mais detalhes.`);
          });
      } else {
        // Se o fornecedor não for encontrado, marca a operação como concluída para não rodar novamente.
        localStorage.setItem(operationFlag, 'true');
      }
    }
  }, [loading, isAdminLoggedIn, suppliers]);

  // Efeito para excluir agendamentos de fornecedores com "ITEM FRACASSADO" (v2 - Robusto)
  useEffect(() => {
    if (!loading && isAdminLoggedIn && suppliers.length > 0) {
      const operationFlag = 'deletedSchedules_ItemFracassado_v2'; // Flag atualizada para garantir a re-execução
      if (localStorage.getItem(operationFlag)) {
        return;
      }

      const suppliersToClear = suppliers.filter(p =>
        (p.contractItems || []).some(item => item.name === 'ITEM FRACASSADO')
      );

      if (suppliersToClear.length > 0) {
        console.log(`[OP_v2] Encontrados ${suppliersToClear.length} fornecedores para limpar agendamentos.`);

        // Usa um método mais direto e seguro, apagando apenas o nó de 'deliveries' de cada fornecedor.
        const updatePromises = suppliersToClear.map(supplier => {
          const deliveriesRef = ref(database, `suppliers/${supplier.cpf}/deliveries`);
          // set(..., null) apaga o nó no Firebase Realtime Database
          return set(deliveriesRef, null);
        });

        Promise.all(updatePromises)
          .then(() => {
            const supplierNames = suppliersToClear.map(p => p.name);
            const successMessage = `[CORREÇÃO APLICADA] Agendamentos removidos com sucesso para os seguintes fornecedores com "ITEM FRACASSADO":\n\n- ${supplierNames.join('\n- ')}`;
            console.log(successMessage);
            alert(successMessage);
            localStorage.setItem(operationFlag, 'true');
          })
          .catch((error) => {
            const errorMessage = "Ocorreu um erro ao tentar remover os agendamentos dos itens fracassados. Por favor, verifique o console para mais detalhes.";
            console.error(errorMessage, error);
            alert(errorMessage);
          });
      } else {
        // Se nenhum fornecedor for encontrado, ainda marca a operação como concluída.
        console.log('[OP_v2] Nenhum fornecedor com "ITEM FRACASSADO" encontrado para limpeza de agendamentos.');
        localStorage.setItem(operationFlag, 'true');
      }
    }
  }, [loading, isAdminLoggedIn, suppliers]);

  // Helper central para escrever no banco de dados com feedback visual
  // Usado para operações em massa, como salvar contratos.
  const writeToDatabase = async (suppliersArray: Supplier[]) => {
    setIsSaving(true);
    try {
      const suppliersObject = suppliersArray.reduce((acc, supplier) => {
        if (supplier && supplier.cpf) {
          acc[supplier.cpf] = supplier;
        }
        return acc;
      }, {} as { [key: string]: Supplier });

      await set(suppliersRef, suppliersObject);
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
    const user = suppliers.find(p => p.name === upperCaseName && p.cpf === sanitizedCpf);

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
      setRegistrationStatus({ success: false, message: 'Nome e CPF/CNPJ são obrigatórios.' });
      setIsSaving(false);
      return;
    }
    if (finalCpf.length !== 11 && finalCpf.length !== 14) {
      setRegistrationStatus({ success: false, message: 'O CPF deve ter 11 dígitos e o CNPJ 14.' });
      setIsSaving(false);
      return;
    }
    
    // Validação rápida no lado do cliente para feedback imediato
    if (suppliers.some(p => p.cpf === finalCpf)) {
      setRegistrationStatus({ success: false, message: 'Este CPF/CNPJ já está cadastrado.' });
      setIsSaving(false);
      return;
    }
    if (suppliers.some(p => p.name === finalName)) {
      setRegistrationStatus({ success: false, message: 'Este nome de fornecedor já está em uso.' });
      setIsSaving(false);
      return;
    }
    
    const newSupplier: Supplier = {
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
      const transactionResult = await runTransaction(suppliersRef, (currentData) => {
        // currentData será null se o nó 'suppliers' não existir, ou um objeto.
        const suppliersObject = currentData || {};

        // Verificação final no servidor: se o CPF/CNPJ já existir, aborta a transação.
        if (suppliersObject[finalCpf]) {
          return; // Retornar undefined aborta a transação.
        }
        
        // Adiciona o novo fornecedor ao objeto de fornecedores.
        suppliersObject[finalCpf] = newSupplier;
        return suppliersObject; // Retorna os dados atualizados para serem salvos.
      });

      if (transactionResult.committed) {
        // Sucesso! O listener onValue cuidará da atualização da UI.
        setRegistrationStatus({ success: true, message: `Fornecedor "${finalName}" cadastrado com sucesso!` });
      } else {
        // A transação foi abortada por nós porque o fornecedor já existe.
        setRegistrationStatus({ success: false, message: 'Cadastro cancelado. O CPF/CNPJ já existe no servidor.' });
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

  const handleUpdateSupplierData = async (oldCpf: string, newName: string, newCpf: string): Promise<string | null> => {
    setIsSaving(true);
    const finalName = newName.trim().toUpperCase();
    const finalCpf = newCpf.trim().replace(/[^\d]/g, '');

    if (!finalName || !finalCpf) {
      return 'Nome e CPF/CNPJ são obrigatórios.';
    }

    // Validação prévia para fornecer feedback rápido
    if (suppliers.some(p => p.cpf === finalCpf && p.cpf !== oldCpf)) {
      setIsSaving(false);
      return 'Este CPF/CNPJ já está cadastrado para outro fornecedor.';
    }
    if (suppliers.some(p => p.name === finalName && p.cpf !== oldCpf)) {
      setIsSaving(false);
      return 'Este nome de fornecedor já está em uso.';
    }

    try {
      const transactionResult = await runTransaction(suppliersRef, (currentData) => {
        if (!currentData || !currentData[oldCpf]) {
          return; // Aborta se o fornecedor original não existir mais
        }
        
        // Validação final no servidor para evitar condições de corrida
        if (oldCpf !== finalCpf && currentData[finalCpf]) {
            return; // Aborta se o novo CPF/CNPJ já foi pego
        }

        const supplierData = { ...currentData[oldCpf] };
        supplierData.name = finalName;
        supplierData.cpf = finalCpf;

        // Move os dados se o CPF/CNPJ (a chave) mudou
        if (oldCpf !== finalCpf) {
          delete currentData[oldCpf];
        }
        currentData[finalCpf] = supplierData;
        
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

  const handleUpdateSuppliers = (updatedSuppliers: Supplier[]) => {
    writeToDatabase(updatedSuppliers);
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

  const handleRestoreData = async (backupSuppliers: Supplier[]): Promise<boolean> => {
     try {
        await writeToDatabase(backupSuppliers);
        return true;
     } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        return false;
     }
  };

  const scheduleDelivery = async (supplierCpf: string, date: string, time: string) => {
    const supplierDeliveriesRef = ref(database, `suppliers/${supplierCpf}/deliveries`);

    try {
        await runTransaction(supplierDeliveriesRef, (currentDeliveries: Delivery[] | null) => {
            const newDelivery: Delivery = {
                id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                date,
                time,
                item: 'AGENDAMENTO PENDENTE',
                kg: 0,
                value: 0,
                invoiceUploaded: false,
            };
            
            if (!currentDeliveries) {
                return [newDelivery];
            }
            
            currentDeliveries.push(newDelivery);
            return currentDeliveries;
        });
    } catch(error) {
        console.error("Falha na transação de agendamento de entrega:", error);
    }
  };
  
  const fulfillAndInvoiceDelivery = async (
    supplierCpf: string,
    placeholderDeliveryIds: string[],
    invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }
  ) => {
      const supplier = suppliers.find(p => p.cpf === supplierCpf);
      if (!supplier) return;
  
      const placeholder = supplier.deliveries.find(d => placeholderDeliveryIds.includes(d.id));
      if (!placeholder) return;
  
      const newDeliveries: Delivery[] = invoiceData.fulfilledItems.map(item => ({
          id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          date: placeholder.date,
          time: placeholder.time,
          item: item.name,
          kg: item.kg,
          value: item.value,
          invoiceUploaded: true,
          invoiceNumber: invoiceData.invoiceNumber,
      }));
      
      let allDeliveriesForInvoice: Delivery[] = [];
  
      const updatedSuppliers = suppliers.map(p => {
        if (p.cpf === supplierCpf) {
          const filteredDeliveries = p.deliveries.filter(d => !placeholderDeliveryIds.includes(d.id));
          const finalDeliveries = [...filteredDeliveries, ...newDeliveries];
          allDeliveriesForInvoice = finalDeliveries.filter(d => d.invoiceNumber === invoiceData.invoiceNumber);
          return { ...p, deliveries: finalDeliveries };
        }
        return p;
      });
  
      try {
        await writeToDatabase(updatedSuppliers);
      } catch (error) {
        console.error("Falha ao faturar entrega:", error);
        return;
      }
      
      const recipientEmail = 'jfmoutin@sap.sp.gov.br';
      const ccRecipientEmail = 'rsscaramal@sap.sp.gov.br';
      const subject = `Envio de Nota Fiscal - Fornecedor: ${supplier.name} (NF: ${invoiceData.invoiceNumber})`;
      const itemsSummary = allDeliveriesForInvoice
          .map(d => `- ${d.item} (${(d.kg || 0).toFixed(2).replace('.',',')} Kg) - Data: ${new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}`)
          .join('\n');
      const body = `Olá,\n\nEsta é uma submissão de nota fiscal através do aplicativo de gestão PPAIS.\n\n**Detalhes:**\nFornecedor: ${supplier.name}\nCPF/CNPJ: ${supplier.cpf}\nNúmero da NF: ${invoiceData.invoiceNumber}\n\n**Entregas associadas a esta NF:**\n${itemsSummary}\n\n----------------------------------------------------\nATENÇÃO: Por favor, anexe o arquivo PDF da nota fiscal a este e-mail antes de enviar.\n\n(Os registros desta operação foram salvos no banco de dados do sistema).`.trim();
      const mailtoLink = `mailto:${recipientEmail}?cc=${ccRecipientEmail}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      setEmailModalData({
          recipient: recipientEmail,
          cc: ccRecipientEmail,
          subject: subject,
          body: body,
          mailtoLink: mailtoLink,
      });
  };

  const cancelDeliveries = async (supplierCpf: string, deliveryIds: string[]) => {
    const updatedSuppliers = suppliers.map(p => {
        if (p.cpf === supplierCpf) {
            const updatedDeliveries = (p.deliveries || []).filter(d => !deliveryIds.includes(d.id));
            return { ...p, deliveries: updatedDeliveries };
        }
        return p;
    });

    try {
      await writeToDatabase(updatedSuppliers);
    } catch(error) {
      console.error("Falha ao cancelar entregas:", error);
    }
  };

  const reopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(p => p.cpf === supplierCpf);
    if (!supplier) return;
  
    const deliveriesToReopen = supplier.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
    if (deliveriesToReopen.length === 0) return;
  
    // Encontra a data e hora mais antigas para usar no novo agendamento pendente
    const earliestDelivery = deliveriesToReopen.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  
    const newPlaceholder: Delivery = {
      id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      date: earliestDelivery.date,
      time: earliestDelivery.time,
      item: 'AGENDAMENTO PENDENTE',
      kg: 0,
      value: 0,
      invoiceUploaded: false,
    };
  
    const updatedSuppliers = suppliers.map(p => {
      if (p.cpf === supplierCpf) {
        // Remove todas as entregas antigas associadas a essa NF
        const remainingDeliveries = p.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
        // Adiciona o novo agendamento pendente
        const updatedDeliveries = [...remainingDeliveries, newPlaceholder];
        return { ...p, deliveries: updatedDeliveries };
      }
      return p;
    });
  
    try {
      await writeToDatabase(updatedSuppliers);
    } catch(error) {
      console.error("Falha ao reabrir nota fiscal:", error);
    }
  };

  const handleCloseEmailModal = () => {
    setEmailModalData(null);
  };

  useEffect(() => {
    if (currentUser) {
      const updatedUser = suppliers.find(p => p.cpf === currentUser.cpf);
      setCurrentUser(updatedUser || null);
    }
  }, [suppliers, currentUser?.cpf]);


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
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8
 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Salvando na nuvem...
            </div>
        </div>

        {isAdminLoggedIn ? (
          <AdminDashboard 
            suppliers={suppliers}
            onRegister={handleRegister} 
            onUpdateSuppliers={handleUpdateSuppliers} 
            onUpdateSupplier={handleUpdateSupplierData}
            onLogout={handleLogout}
            onResetData={handleResetData}
            onRestoreData={handleRestoreData}
            activeTab={adminActiveTab}
            onTabChange={setAdminActiveTab}
            registrationStatus={registrationStatus}
            onClearRegistrationStatus={handleClearRegistrationStatus}
            onReopenInvoice={reopenInvoice}
          />
        ) : currentUser ? (
          <Dashboard 
            supplier={currentUser} 
            onLogout={handleLogout} 
            onScheduleDelivery={scheduleDelivery}
            onCancelDeliveries={cancelDeliveries}
            onFulfillAndInvoice={fulfillAndInvoiceDelivery}
            emailModalData={emailModalData}
            onCloseEmailModal={handleCloseEmailModal}
          />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;
