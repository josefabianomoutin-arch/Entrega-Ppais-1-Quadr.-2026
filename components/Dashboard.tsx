import React, { useState, useMemo } from 'react';
import type { Producer, Delivery } from '../types';
import Calendar from './Calendar';
import DeliveryModal from './DeliveryModal';
import ViewDeliveryModal from './ViewDeliveryModal';
import SummaryCard from './SummaryCard';
import InvoiceUploader from './InvoiceUploader';
import EmailConfirmationModal from './EmailConfirmationModal';

interface DashboardProps {
  producer: Producer;
  onLogout: () => void;
  onAddDeliveries: (producerCpf: string, deliveries: Omit<Delivery, 'id' | 'invoiceUploaded'>[]) => void;
  onInvoiceUpload: (producerCpf: string, deliveryIds: string[], invoiceNumber: string) => void;
  onCancelDeliveries: (producerCpf: string, deliveryIds: string[]) => void;
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
  producer, 
  onLogout, 
  onAddDeliveries, 
  onInvoiceUpload, 
  onCancelDeliveries,
  emailModalData,
  onCloseEmailModal
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [deliveriesToShow, setDeliveriesToShow] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // NOTA: Esta data é simulada para fins de demonstração, pois o calendário é para 2026.
  // Em um aplicativo real, isso seria `new Date()` para refletir a data atual.
  const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');
  const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

  const handleDayClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const deliveriesOnDate = producer.deliveries.filter(d => d.date === dateString);

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

  const handleSaveDelivery = (deliveryItems: { time: string; item: string; kg: number; value: number }[], invoiceNumber: string) => {
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      const deliveriesToAdd = deliveryItems.map(item => ({ 
          ...item, 
          date: dateString,
          invoiceNumber,
      }));
      onAddDeliveries(producer.cpf, deliveriesToAdd);
    }
    handleCloseModal();
  };

  const handleCancelDeliveries = (deliveryIds: string[]) => {
    if(window.confirm('Tem certeza que deseja cancelar estes agendamentos? Esta ação não pode ser desfeita.')) {
      onCancelDeliveries(producer.cpf, deliveryIds);
      handleCloseViewModal();
    }
  };

  const pendingInvoices = useMemo(() => {
      return producer.deliveries.filter(d => {
          const deliveryDate = new Date(d.date + 'T00:00:00');
          return !d.invoiceUploaded && deliveryDate < SIMULATED_TODAY;
      });
  }, [producer.deliveries]);

  const overdueInvoices = useMemo(() => {
      return pendingInvoices.filter(d => {
          const deliveryDate = new Date(d.date + 'T00:00:00');
          return (SIMULATED_TODAY.getTime() - deliveryDate.getTime()) > SEVEN_DAYS_IN_MS;
      });
  }, [pendingInvoices]);

  return (
    <div className="min-h-screen text-gray-800">
      <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-green-800">Olá, {producer.name}</h1>
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
        {overdueInvoices.length > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-8 rounded-r-lg shadow" role="alert">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              <div>
                <p className="font-bold">Atenção!</p>
                <p className="text-sm">Você possui {overdueInvoices.length} nota(s) fiscal(is) pendente(s) há mais de 7 dias. <a href="#invoice-uploader-section" className="font-semibold underline hover:text-yellow-900">Verificar agora</a>.</p>
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
                  deliveries={producer.deliveries} 
                  simulatedToday={SIMULATED_TODAY} 
                  allowedWeeks={producer.allowedWeeks}
                />
            </div>
          </div>
          <div className="space-y-8">
            <SummaryCard producer={producer} />
            {pendingInvoices.length > 0 && (
                <div id="invoice-uploader-section">
                    <InvoiceUploader 
                        producerName={producer.name}
                        pendingInvoices={pendingInvoices} 
                        onUpload={(deliveryIds, invoiceNumber) => onInvoiceUpload(producer.cpf, deliveryIds, invoiceNumber)} 
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
          onSave={handleSaveDelivery}
          contractItems={producer.contractItems}
          deliveries={producer.deliveries}
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