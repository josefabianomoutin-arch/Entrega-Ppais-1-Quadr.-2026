

import React, { useState, useEffect } from 'react';
import type { Supplier, Delivery, WarehouseMovement, PerCapitaConfig } from './types';
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
const perCapitaConfigRef = ref(database, 'perCapitaConfig');


const App: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouseLog, setWarehouseLog] = useState<WarehouseMovement[]>([]);
  const [perCapitaConfig, setPerCapitaConfig] = useState<PerCapitaConfig>({});
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
    
    const unsubscribePerCapitaConfig = onValue(perCapitaConfigRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPerCapitaConfig(data);
      } else {
        setPerCapitaConfig({});
      }
    });

    return () => {
      unsubscribeSuppliers();
      unsubscribeWarehouseLog();
      unsubscribePerCapitaConfig();
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

  // Efeito para excluir agendamento específico da COOPCRESP (operação única)
  useEffect(() => {
    if (!loading && isAdminLoggedIn && suppliers.length > 0) {
      const operationFlag = 'deletedSchedule_COOPCRESP_20260130_v1';
      if (localStorage.getItem(operationFlag)) {
        return;
      }

      const supplierToUpdate = suppliers.find(p => p.name.toUpperCase() === 'COOPCRESP');

      if (supplierToUpdate) {
        const dateToDelete = '2026-01-30';
        const hasDeliveryOnDate = supplierToUpdate.deliveries.some(d => d.date === dateToDelete);

        if (hasDeliveryOnDate) {
            console.log(`Iniciando exclusão de agendamento de ${dateToDelete} para ${supplierToUpdate.name}...`);
            
            const updatedDeliveries = supplierToUpdate.deliveries.filter(d => d.date !== dateToDelete);
            const supplierDeliveriesRef = ref(database, `suppliers/${supplierToUpdate.cpf}/deliveries`);
            
            set(supplierDeliveriesRef, updatedDeliveries)
            .then(() => {
                const successMessage = `O agendamento do dia 30/01/2026 para a empresa COOPCRESP foi removido com sucesso.`;
                console.log(successMessage);
                alert(successMessage);
                localStorage.setItem(operationFlag, 'true');
            })
            .catch((error) => {
                const errorMessage = `Falha ao excluir o agendamento da COOPCRESP. Verifique o console para mais detalhes.`;
                console.error(errorMessage, error);
                alert(errorMessage);
            });
        } else {
             // Se não houver entrega na data, apenas marca a operação como concluída para não rodar novamente.
            localStorage.setItem(operationFlag, 'true');
        }

      } else {
        // Se o fornecedor não for encontrado, marca a operação como concluída.
        localStorage.setItem(operationFlag, 'true');
      }
    }
  }, [loading, isAdminLoggedIn, suppliers]);

  // Efeito para excluir agendamento específico da PREVIATO (operação única)
  useEffect(() => {
    if (!loading && isAdminLoggedIn && suppliers.length > 0) {
      const operationFlag = 'deletedSchedule_PREVIATO_20260129_v1';
      if (localStorage.getItem(operationFlag)) {
        return;
      }

      const supplierNameToFind = 'PREVIATO COMÉRCIO ATACADISTA GERAL LTDA';
      const supplierToUpdate = suppliers.find(p => p.name.toUpperCase() === supplierNameToFind);

      if (supplierToUpdate) {
        const dateToDelete = '2026-01-29';
        const hasDeliveryOnDate = supplierToUpdate.deliveries.some(d => d.date === dateToDelete);

        if (hasDeliveryOnDate) {
            console.log(`Iniciando exclusão de agendamento de ${dateToDelete} para ${supplierToUpdate.name}...`);
            
            const updatedDeliveries = supplierToUpdate.deliveries.filter(d => d.date !== dateToDelete);
            const supplierDeliveriesRef = ref(database, `suppliers/${supplierToUpdate.cpf}/deliveries`);
            
            set(supplierDeliveriesRef, updatedDeliveries)
            .then(() => {
                const successMessage = `O agendamento do dia 29/01/2026 para a empresa ${supplierNameToFind} foi removido com sucesso.`;
                console.log(successMessage);
                alert(successMessage);
                localStorage.setItem(operationFlag, 'true');
            })
            .catch((error) => {
                const errorMessage = `Falha ao excluir o agendamento da ${supplierNameToFind}. Verifique o console para mais detalhes.`;
                console.error(errorMessage, error);
                alert(errorMessage);
            });
        } else {
             // Se não houver entrega na data, apenas marca a operação como concluída para não rodar novamente.
            localStorage.setItem(operationFlag, 'true');
        }

      } else {
        // Se o fornecedor não for encontrado, marca a operação como concluída.
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

  // Persiste o estado atual no banco de dados (modificado para ser assíncrono)
  const handlePersistSuppliers = async (suppliersToPersist: Supplier[]) => {
      const suppliersObject = suppliersToPersist.reduce((acc, supplier) => {
        if (supplier && supplier.cpf) {
          acc[supplier.cpf] = supplier;
        }
        return acc;
      }, {} as { [key: string]: Supplier });
      await writeToDatabase(suppliersRef, suppliersObject);
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
  
  const handleUpdatePerCapitaConfig = async (config: PerCapitaConfig) => {
    await writeToDatabase(perCapitaConfigRef, config);
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

  const handleRegisterEntry = async (payload: {
    supplierCpf: string;
    itemName: string;
    invoiceNumber: string;
    invoiceDate: string;
    lotNumber: string;
    quantity: number;
    expirationDate: string;
  }): Promise<{ success: boolean; message: string }> => {
      const { supplierCpf, itemName, invoiceNumber, invoiceDate, lotNumber, quantity, expirationDate } = payload;
      
      const newSuppliers = JSON.parse(JSON.stringify(suppliers));
      const supplier = newSuppliers.find((s: Supplier) => s.cpf === supplierCpf);
      if (!supplier) return { success: false, message: "Fornecedor não encontrado." };
  
      let delivery = supplier.deliveries.find((d: Delivery) => d.invoiceNumber === invoiceNumber && d.item === itemName);
      
      const newLot = {
        id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lotNumber,
        barcode: lotNumber,
        initialQuantity: quantity,
        remainingQuantity: quantity,
        expirationDate: expirationDate,
      };
  
      if (delivery) {
        delivery.lots = [...(delivery.lots || []), newLot];
      } else {
        delivery = {
          id: `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: invoiceDate,
          time: '00:00',
          item: itemName,
          kg: 0,
          value: 0,
          invoiceUploaded: true,
          invoiceNumber: invoiceNumber,
          lots: [newLot],
          withdrawals: [],
          remainingQuantity: quantity,
        };
        supplier.deliveries.push(delivery);
      }
      
      delivery.kg = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.initialQuantity, 0);
      delivery.remainingQuantity = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.remainingQuantity, 0);
      
      const newMovement: Omit<WarehouseMovement, 'id' | 'timestamp'> = {
        type: 'entrada',
        lotId: newLot.id,
        lotNumber: newLot.lotNumber,
        itemName: delivery.item || 'N/A',
        supplierName: supplier.name,
        deliveryId: delivery.id,
        inboundInvoice: delivery.invoiceNumber,
        quantity: newLot.initialQuantity,
        expirationDate: newLot.expirationDate,
      };
      
      try {
        await handlePersistSuppliers(newSuppliers);
        await runTransaction(warehouseLogRef, (currentLog: WarehouseMovement[] | null) => {
          const movementWithId = { ...newMovement, id: `whm-${Date.now()}`, timestamp: new Date().toISOString() };
          return [...(currentLog || []), movementWithId];
        });
        return { success: true, message: 'Entrada registrada com sucesso.' };
      } catch (error) {
        console.error("Falha ao registrar entrada:", error);
        return { success: false, message: 'Erro ao salvar os dados.' };
      }
  };

  // Modificado: Agora atualiza efetivamente o saldo do lote
  const handleRegisterWithdrawal = async (payload: {
    supplierCpf: string;
    itemName: string;
    lotNumber: string;
    quantity: number;
    outboundInvoice: string;
    expirationDate: string;
  }): Promise<{ success: boolean; message: string }> => {
    const { supplierCpf, itemName, lotNumber, quantity, outboundInvoice, expirationDate } = payload;
    
    const newSuppliers = JSON.parse(JSON.stringify(suppliers));
    const supplier = newSuppliers.find((s: Supplier) => s.cpf === supplierCpf);
    
    let foundLot: any = null;
    let foundDelivery: Delivery | null = null;

    if (supplier) {
        for (const delivery of supplier.deliveries) {
            if (delivery.item === itemName) {
                const lot = (delivery.lots || []).find(l => l.lotNumber === lotNumber && l.expirationDate === expirationDate);
                if (lot) {
                    foundLot = lot;
                    foundDelivery = delivery;
                    break;
                }
            }
        }
    }

    if (!foundLot || !foundDelivery || !supplier) {
        return { success: false, message: 'Lote não encontrado com os dados fornecidos (Item, Fornecedor, Lote e Vencimento).' };
    }

    if (quantity > foundLot.remainingQuantity) {
         return { success: false, message: `A quantidade de saída (${quantity.toFixed(2)} Kg) não pode exceder o estoque do lote (${foundLot.remainingQuantity.toFixed(2)} Kg).` };
    }

    // ATUALIZA O SALDO REAL
    foundLot.remainingQuantity -= quantity;
    foundDelivery.remainingQuantity = (foundDelivery.lots || []).reduce((sum: number, l: any) => sum + l.remainingQuantity, 0);

    const newMovement: Omit<WarehouseMovement, 'id'|'timestamp'> = {
        type: 'saída',
        lotId: foundLot.id,
        lotNumber: foundLot.lotNumber,
        itemName: foundDelivery.item || 'N/A',
        supplierName: supplier.name,
        deliveryId: foundDelivery.id,
        outboundInvoice,
        quantity,
        expirationDate: foundLot.expirationDate,
    };

    try {
        await handlePersistSuppliers(newSuppliers);
        await runTransaction(warehouseLogRef, (currentLog: WarehouseMovement[] | null) => {
            const movementWithId = {
                ...newMovement,
                id: `whm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
            };
            return [...(currentLog || []), movementWithId];
        });
        return { success: true, message: 'Saída registrada e estoque atualizado com sucesso.' };
    } catch (error) {
        console.error("Falha ao registrar saída:", error);
        return { success: false, message: 'Erro ao salvar o registro no histórico ou atualizar estoque.' };
    }
  };

  const handleDeleteWarehouseEntry = async (logToDelete: WarehouseMovement): Promise<{ success: boolean; message: string }> => {
    if (logToDelete.type !== 'entrada') {
        return { success: false, message: 'Apenas entradas de estoque podem ser excluídas.' };
    }

    const newSuppliers = JSON.parse(JSON.stringify(suppliers));
    let entryFoundAndDeleted = false;

    for (const supplier of newSuppliers) {
        for (const delivery of supplier.deliveries) {
            if (delivery.id === logToDelete.deliveryId) {
                const lotIndex = (delivery.lots || []).findIndex((l: any) => l.id === logToDelete.lotId);

                if (lotIndex > -1) {
                    delivery.lots.splice(lotIndex, 1);
                    entryFoundAndDeleted = true;
                    // Recalculate delivery totals
                    delivery.kg = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.initialQuantity, 0);
                    delivery.remainingQuantity = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.remainingQuantity, 0);
                    break; 
                }
            }
        }
        if (entryFoundAndDeleted) break;
    }

    if (!entryFoundAndDeleted) {
        return { success: false, message: 'Não foi possível encontrar o lote correspondente para exclusão.' };
    }

    const newWarehouseLog = warehouseLog.filter(log => log.id !== logToDelete.id);

    try {
        await handlePersistSuppliers(newSuppliers);
        await writeToDatabase(warehouseLogRef, newWarehouseLog);
        return { success: true, message: 'Entrada de estoque excluída com sucesso. O saldo foi retornado ao contrato.' };
    } catch (error) {
        console.error("Falha ao excluir entrada de estoque:", error);
        return { success: false, message: 'Ocorreu um erro ao salvar as alterações.' };
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
            perCapitaConfig={perCapitaConfig}
            onUpdatePerCapitaConfig={handleUpdatePerCapitaConfig}
            onDeleteWarehouseEntry={handleDeleteWarehouseEntry}
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
                onRegisterEntry={handleRegisterEntry}
                onRegisterWithdrawal={handleRegisterWithdrawal}
            />
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </>
  );
};

export default App;