import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';
import Calendar from './Calendar';
import DeliveryModal from './DeliveryModal';
import ViewDeliveryModal from './ViewDeliveryModal';
import SummaryCard from './SummaryCard';
import InvoiceUploader from './InvoiceUploader';
import EmailConfirmationModal from './EmailConfirmationModal';
import FulfillmentModal from './FulfillmentModal';

interface DashboardProps {
  supplier: Supplier;
  onLogout: () => void;
  onScheduleDelivery: (supplierCpf: string, date: string, time: string) => void;
  onFulfillAndInvoice: (
    supplierCpf: string, 
    placeholderDeliveryIds: string[], 
    invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }
  ) => void;
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
  emailModalData: {
    recipient: string;
    cc: string;
    subject: string;
    body: string;
    mailtoLink: string;
  } | null;
  onCloseEmailModal: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  supplier, 
  onLogout, 
  onScheduleDelivery, 
  onFulfillAndInvoice, 
  onCancelDeliveries,
  emailModalData,
  onCloseEmailModal
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [invoiceToFulfill, setInvoiceToFulfill] = useState<{ date: string; deliveries: Delivery[] } | null>(null);
  const [deliveriesToShow, setDeliveriesToShow] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');

  const handleDayClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const deliveriesOnDate = supplier.deliveries.filter(d => d.date === dateString);

    setSelectedDate(date);

    if (deliveriesOnDate.length > 0) {
      setDeliveriesToShow(deliveriesOnDate);
      setIsViewModalOpen(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setDeliveriesToShow([]);
    setSelectedDate(null);
  }

  const handleAddNewFromView = () => {
    setIsViewModalOpen(false);
    setDeliveriesToShow([]);
    setIsModalOpen(true);
  }

  const handleScheduleSave = (time: string) => {
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      onScheduleDelivery(supplier.cpf, dateString, time);
    }
    handleCloseModal();
  };

  const handleCancelDeliveries = (deliveryIds: string[]) => {
    if(window.confirm('Tem certeza que deseja cancelar este agendamento? Após cancelar, você poderá escolher uma nova data disponível no calendário.')) {
      onCancelDeliveries(supplier.cpf, deliveryIds);
      handleCloseViewModal();
    }
  };

  const handleOpenFulfillmentModal = (invoiceInfo: { date: string; deliveries: Delivery[] }) => {
    setInvoiceToFulfill(invoiceInfo);
    setIsFulfillmentModalOpen(true);
  };
  
  const handleCloseFulfillmentModal = () => {
    setInvoiceToFulfill(null);
    setIsFulfillmentModalOpen(false);
  };
  
  const handleSaveFulfillment = (invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }) => {
    if (invoiceToFulfill) {
      const placeholderIds = invoiceToFulfill.deliveries.map(d => d.id);
      onFulfillAndInvoice(supplier.cpf, placeholderIds, invoiceData);
    }
    handleCloseFulfillmentModal();
  };
  
  const pendingDailyInvoices = useMemo(() => {
    const pending = supplier.deliveries.filter(d => {
        const deliveryDate = new Date(d.date + 'T00:00:00');
        return d.item === 'AGENDAMENTO PENDENTE' && deliveryDate < SIMULATED_TODAY;
    });

    const groupedByDate = pending.reduce((acc, delivery) => {
        if (!acc[delivery.date]) {
            acc[delivery.date] = [];
        }
        acc[delivery.date].push(delivery);
        return acc;
    }, {} as Record<string, Delivery[]>);

    return Object.entries(groupedByDate).map(([date, deliveries]) => ({
        date,
        deliveries,
    }));
  }, [supplier.deliveries]);

  const monthlyQuotas = useMemo(() => {
    if (!selectedDate || !supplier.contractItems) return [];
    
    const currentMonth = selectedDate.getMonth();

    const getDisplayInfoForItem = (item: ContractItem) => {
        const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
        const unitWeight = parseFloat(unitWeightStr) || 1;
        const quantity = item.totalKg || 0;

        let displayQuantity = quantity;
        let displayUnit = 'un';

        switch (unitType) {
            case 'kg':
            case 'un':
            case 'saco':
            case 'balde':
            case 'pacote':
            case 'pote':
                displayQuantity = quantity * unitWeight;
                displayUnit = 'Kg';
                break;
            case 'litro':
            case 'l':
            case 'caixa':
            case 'embalagem':
                displayQuantity = quantity * unitWeight;
                displayUnit = 'L';
                break;
            case 'dz':
                displayQuantity = quantity;
                displayUnit = 'Dz';
                break;
            default:
                displayQuantity = quantity;
                displayUnit = 'Un';
        }
        return { totalContracted: displayQuantity, unit: displayUnit };
    };

    return supplier.contractItems.map(item => {
        const { totalContracted, unit } = getDisplayInfoForItem(item);
        const monthlyQuota = totalContracted / 4;

        const deliveredThisMonth = supplier.deliveries
            .filter(d => 
                d.item === item.name && 
                new Date(d.date + 'T00:00:00').getMonth() === currentMonth
            )
            .reduce((sum, d) => sum + (d.kg || 0), 0);

        const remainingThisMonth = monthlyQuota - deliveredThisMonth;

        return {
            name: item.name,
            monthlyQuota,
            deliveredThisMonth,
            remainingThisMonth,
            unit,
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

  }, [selectedDate, supplier.contractItems, supplier.deliveries]);


  return (
    <div className="min-h-screen text-gray-800">
      <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-green-800">Olá, {supplier.name}</h1>
          <p className="text-sm text-gray-500">Bem-vindo ao seu painel de entregas</p>
        </div>
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Sair
        </button>
      </header>

      <main className="p-4 md:p-8">
        {pendingDailyInvoices.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-8 rounded-r-lg shadow" role="alert">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              <div>
                <p className="font-bold">Faturamento Pendente</p>
                <p className="text-sm">Você possui {pendingDailyInvoices.length} dia(s) de entrega para preencher os dados e faturar. <a href="#invoice-uploader-section" className="font-semibold underline hover:text-yellow-900">Verificar agora</a>.</p>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700">Agenda de Entregas - 2026</h2>
                <p className="text-center text-gray-500 mb-6">Clique em um dia para agendar ou visualizar uma entrega.</p>
                <Calendar 
                  onDayClick={handleDayClick} 
                  deliveries={supplier.deliveries} 
                  simulatedToday={SIMULATED_TODAY} 
                  allowedWeeks={supplier.allowedWeeks}
                />
            </div>
          </div>
          <div className="space-y-8">
            <SummaryCard supplier={supplier} />
            {pendingDailyInvoices.length > 0 && (
                <div id="invoice-uploader-section">
                    <InvoiceUploader 
                        pendingInvoices={pendingDailyInvoices} 
                        onFulfill={handleOpenFulfillmentModal} 
                    />
                </div>
            )}
          </div>
        </div>
      </main>

      {isModalOpen && selectedDate && (
        <DeliveryModal
          date={selectedDate}
          onClose={handleCloseModal}
          onSave={handleScheduleSave}
          monthlyQuotas={monthlyQuotas}
        />
      )}

      {isViewModalOpen && selectedDate && (
        <ViewDeliveryModal
          date={selectedDate}
          deliveries={deliveriesToShow}
          onClose={handleCloseViewModal}
          onAddNew={handleAddNewFromView}
          onCancel={handleCancelDeliveries}
          simulatedToday={SIMULATED_TODAY}
        />
      )}
      
      {isFulfillmentModalOpen && invoiceToFulfill && (
        <FulfillmentModal
          invoiceInfo={invoiceToFulfill}
          contractItems={supplier.contractItems}
          onClose={handleCloseFulfillmentModal}
          onSave={handleSaveFulfillment}
        />
      )}

      {emailModalData && (
        <EmailConfirmationModal
          data={emailModalData}
          onClose={onCloseEmailModal}
        />
      )}
    </div>
  );
};

export default Dashboard;
