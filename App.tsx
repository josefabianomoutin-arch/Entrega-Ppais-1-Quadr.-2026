import React, { useState, useEffect } from 'react';
import type { Supplier, Delivery, WarehouseMovement } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlmoxarifadoDashboard from './components/AlmoxarifadoDashboard';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, runTransaction, get } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

// Inicializa o Firebase e obtém uma referência ao banco de dados
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const suppliersRef = ref(database, 'suppliers');
const warehouseLogRef = ref(database, 'warehouseLog');


const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Supplier | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAlmoxarifadoLoggedIn, setIsAlmoxarifadoLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse'>('register');
  const [registrationStatus, setRegistrationStatus] = useState<{success: boolean; message: string} | null>(null);
  const [emailModalData, setEmailModalData] = useState<{
    recipient: string;
    cc: string;
    subject: string;
    body: string;
    mailtoLink: string;
  } | null>(null);

  // Efeito para migrar dados de 'producers' para 'suppliers' (operação única)
  useEffect(() => {
    const runMigration = async () => {
        const migrationFlag = 'migrated_producers_to_suppliers_v2';
        if (localStorage.getItem(migrationFlag)) {
            return; // A migração já foi executada, não faz nada.
        }

        console.log("Verificando a necessidade de migração de dados de '/producers' para '/suppliers'...");
        const producersRef = ref(database, 'producers');
        
        try {
            const producersSnapshot = await get(producersRef);
            if (producersSnapshot.exists()) {
                const producersData = producersSnapshot.val();
                console.log("Dados antigos de 'produtores' encontrados. Iniciando migração...");

                // Move os dados para o novo local '/suppliers'
                await set(suppliersRef, producersData);
                console.log("Dados migrados com sucesso para '/suppliers'.");

                // Remove os dados do local antigo para evitar futuras migrações
                await set(producersRef, null);
                console.log("Nó antigo '/producers' removido.");

                alert("Seus dados de cadastro antigos foram encontrados e atualizados para a nova versão do sistema com sucesso! O aplicativo será recarregado para exibir os dados.");
                localStorage.setItem(migrationFlag, 'true');
                window.location.reload(); // Recarrega para garantir que o onValue listener pegue os dados migrados
            } else {
                console.log("Nenhum dado antigo ('/producers') encontrado. Nenhuma migração é necessária.");
                localStorage.setItem(migrationFlag, 'true'); // Marca como verificado para não rodar de novo
            }
        } catch (error) {
            console.error("Ocorreu um erro crítico durante a migração de dados:", error);
            alert("Ocorreu um erro ao tentar atualizar sua base de dados. Por favor, verifique o console para mais detalhes e contate o suporte se o problema persistir.");
        }
    };

    runMigration();
  }, []);

  // Efeito para ouvir mudanças no banco de dados em tempo real
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
          .filter(
            (p): p is Supplier => 
              p && 
              typeof p === 'object' && 
              typeof (p as any).cpf === 'string' && (p as any).cpf.trim() !== '' &&
              typeof (p as any).name === 'string' && (p as any).name.trim() !== ''
          )
          .map(p => ({
            ...p,
            contractItems: p.contractItems || [],
            deliveries: (p.deliveries || []).map(d => ({
              ...d,
              remainingQuantity: typeof d.remainingQuantity === 'number' ? d.remainingQuantity : (d.kg || 0),
              lots: d.lots || [],
              withdrawals: d.withdrawals || [],
            })),
            allowedWeeks: p.allowedWeeks || [],
            initialValue: p.initialValue || 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setSuppliers(suppliersArray);
      } catch (error) {
        console.error("Erro ao processar dados de fornecedores do Firebase:", error);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Falha ao ler dados de fornecedores do Firebase: ", error);
      setLoading(false);
      setSuppliers([]);
    });

    const unsubscribeWarehouseLog = onValue(warehouseLogRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        setWarehouseLog(data);
      } else {
        setWarehouseLog([]);
      }
    });

    return () => {
      unsubscribeSuppliers();
      unsubscribeWarehouseLog();
    };
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
        localStorage.setItem(operationFlag, 'true');
      }
    }
  }, [loading, isAdminLoggedIn, suppliers]);

  // Efeito para excluir agendamentos de fornecedores com "ITEM FRACASSADO" (v2 - Robusto)
  useEffect(() => {
    if (!loading && isAdminLoggedIn && suppliers.length > 0) {
      const operationFlag = 'deletedSchedules_ItemFracassado_v2';
      if (localStorage.getItem(operationFlag)) {
        return;
      }

      const suppliersToClear = suppliers.filter(p =>
        (p.contractItems || []).some(item => item.name === 'ITEM FRACASSADO')
      );

      if (suppliersToClear.length > 0) {
        console.log(`[OP_v2] Encontrados ${suppliersToClear.length} fornecedores para limpar agendamentos.`);
        
        const updatePromises = suppliersToClear.map(supplier => {
          const deliveriesRef = ref(database, `suppliers/${supplier.cpf}/deliveries`);
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
        console.log('[OP_v2] Nenhum fornecedor com "ITEM FRACASSADO" encontrado para limpeza de agendamentos.');
        localStorage.setItem(operationFlag, 'true');
      }
    }
  }, [loading, isAdminLoggedIn, suppliers]);

  // Helper central para escrever no banco de dados com feedback visual
  const writeToDatabase = async (dbRef: any, data: any) => {
      setIsSaving(true);
      try {
          await set(dbRef, data);
      } catch (error) {
          console.error("Falha ao salvar dados no Firebase", error);
          throw error;
      } finally {
          setTimeout(() => setIsSaving(false), 500);
      }
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
    const upperCaseName = name.toUpperCase();
    const sanitizedCpf = cpf.replace(/[^\d]/g, '');
    const user = suppliers.find(p => p.name === upperCaseName && p.cpf === sanitizedCpf);

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
      const transactionResult = await runTransaction(suppliersRef, (currentData) => {
        const suppliersObject = currentData || {};
        if (suppliersObject[finalCpf]) {
          return;
        }
        suppliersObject[finalCpf] = newSupplier;
        return suppliersObject;
      });

      if (transactionResult.committed) {
        setRegistrationStatus({ success: true, message: `Fornecedor "${finalName}" cadastrado com sucesso!` });
      } else {
        setRegistrationStatus({ success: false, message: 'Cadastro cancelado. O CPF/CNPJ já existe no servidor.' });
      }

    } catch (error: any) {
      console.error("Falha na transação de registro:", error);
      let errorMessage = 'Ocorreu um erro inesperado ao salvar na nuvem. Verifique sua conexão e tente novamente.';
      if (error && error.code === 'PERMISSION_DENIED') {
        errorMessage = 'Erro de permissão ao salvar. Verifique as Regras de Segurança do seu banco de dados Firebase.';
      }
      setRegistrationStatus({ success: false, message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSupplierData = async (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]): Promise<string | null> => {
    setIsSaving(true);
    const finalName = newName.trim().toUpperCase();
    const finalCpf = newCpf.trim().replace(/[^\d]/g, '');

    if (!finalName || !finalCpf) {
      return 'Nome e CPF/CNPJ são obrigatórios.';
    }

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
          return;
        }
        if (oldCpf !== finalCpf && currentData[finalCpf]) {
            return;
        }

        const supplierData = { ...currentData[oldCpf] };
        supplierData.name = finalName;
        supplierData.cpf = finalCpf;
        supplierData.allowedWeeks = newAllowedWeeks;

        if (oldCpf !== finalCpf) {
          delete currentData[oldCpf];
        }
        currentData[finalCpf] = supplierData;
        
        return currentData;
      });

      if (transactionResult.committed) {
        return null;
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

  // Persiste o estado atual no banco de dados
  const handlePersistSuppliers = (suppliersToPersist: Supplier[]) => {
      const suppliersObject = suppliersToPersist.reduce((acc, supplier) => {
        if (supplier && supplier.cpf) {
          acc[supplier.cpf] = supplier;
        }
        return acc;
      }, {} as { [key: string]: Supplier });
      writeToDatabase(suppliersRef, suppliersObject);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
    setIsAlmoxarifadoLoggedIn(false);
  };

  const handleResetData = () => {
    if (window.confirm('Você tem certeza que deseja apagar TODOS os dados do banco de dados na nuvem? Esta ação é irreversível e afetará todos os usuários.')) {
      writeToDatabase(suppliersRef, {});
      writeToDatabase(warehouseLogRef, []);
    }
  };

  const handleRestoreData = async (backupSuppliers: Supplier[]): Promise<boolean> => {
     try {
        const suppliersObject = backupSuppliers.reduce((acc, supplier) => {
          acc[supplier.cpf] = supplier;
          return acc;
        }, {} as { [key: string]: Supplier });
        await writeToDatabase(suppliersRef, suppliersObject);
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
            return [...(currentDeliveries || []), newDelivery];
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
          remainingQuantity: item.kg,
          lots: [],
          withdrawals: []
      }));
      
      let allDeliveriesForInvoice: Delivery[] = [];
  
      const suppliersObject = suppliers.reduce((acc, p) => {
        if (p.cpf === supplierCpf) {
          const filteredDeliveries = p.deliveries.filter(d => !placeholderDeliveryIds.includes(d.id));
          const finalDeliveries = [...filteredDeliveries, ...newDeliveries];
          allDeliveriesForInvoice = finalDeliveries.filter(d => d.invoiceNumber === invoiceData.invoiceNumber);
          acc[p.cpf] = { ...p, deliveries: finalDeliveries };
        } else {
          acc[p.cpf] = p;
        }
        return acc;
      }, {} as { [key: string]: Supplier });
  
      try {
        await writeToDatabase(suppliersRef, suppliersObject);
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
    const suppliersObject = suppliers.reduce((acc, p) => {
        if (p.cpf === supplierCpf) {
            const updatedDeliveries = (p.deliveries || []).filter(d => !deliveryIds.includes(d.id));
            acc[p.cpf] = { ...p, deliveries: updatedDeliveries };
        } else {
            acc[p.cpf] = p;
        }
        return acc;
    }, {} as { [key: string]: Supplier });

    try {
      await writeToDatabase(suppliersRef, suppliersObject);
    } catch(error) {
      console.error("Falha ao cancelar entregas:", error);
    }
  };

  const reopenInvoice = async (supplierCpf: string, invoiceNumber: string) => {
    const supplier = suppliers.find(p => p.cpf === supplierCpf);
    if (!supplier) return;
  
    const deliveriesToReopen = supplier.deliveries.filter(d => d.invoiceNumber === invoiceNumber);
    if (deliveriesToReopen.length === 0) return;
  
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
  
    const suppliersObject = suppliers.reduce((acc, p) => {
        if (p.cpf === supplierCpf) {
            const remainingDeliveries = p.deliveries.filter(d => d.invoiceNumber !== invoiceNumber);
            const updatedDeliveries = [...remainingDeliveries, newPlaceholder];
            acc[p.cpf] = { ...p, deliveries: updatedDeliveries };
        } else {
            acc[p.cpf] = p;
        }
        return acc;
    }, {} as { [key: string]: Supplier });
  
    try {
      await writeToDatabase(suppliersRef, suppliersObject);
    } catch(error) {
      console.error("Falha ao reabrir nota fiscal:", error);
    }
  };

  const handleRegisterWarehouseMovement = async (movement: Omit<WarehouseMovement, 'id' | 'timestamp'>) => {
      try {
          const newMovement: WarehouseMovement = {
              ...movement,
              id: `whm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              timestamp: new Date().toISOString(),
          };
          await runTransaction(warehouseLogRef, (currentLog: WarehouseMovement[] | null) => {
              return [...(currentLog || []), newMovement];
          });
          return true;
      } catch (error) {
          console.error("Falha ao registrar movimentação de almoxarifado:", error);
          return false;
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
            warehouseLog={warehouseLog}
            onRegister={handleRegister} 
            onPersistSuppliers={handlePersistSuppliers}
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
        ) : isAlmoxarifadoLoggedIn ? (
            <AlmoxarifadoDashboard
                suppliers={suppliers}
                onLogout={handleLogout}
                onRegisterMovement={handleRegisterWarehouseMovement}
            />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;