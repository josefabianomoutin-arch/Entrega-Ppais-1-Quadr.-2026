
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';
import Calendar from './Calendar';
import DeliveryModal from './DeliveryModal';
import ViewDeliveryModal from './ViewDeliveryModal';
import SummaryCard from './SummaryCard';
import InvoiceUploader from './InvoiceUploader';
import EmailConfirmationModal from './EmailConfirmationModal';
import FulfillmentModal from './FulfillmentModal';

const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');

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

  const handleCloseModal = () => { setIsModalOpen(false); setSelectedDate(null); };
  const handleCloseViewModal = () => { setIsViewModalOpen(false); setDeliveriesToShow([]); setSelectedDate(null); };
  const handleAddNewFromView = () => { setIsViewModalOpen(false); setDeliveriesToShow([]); setIsModalOpen(true); };

  const handleScheduleSave = (time: string) => {
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      onScheduleDelivery(supplier.cpf, dateString, time);
    }
    handleCloseModal();
  };

  const handleOpenFulfillmentModal = (invoiceInfo: { date: string; deliveries: Delivery[] }) => {
    setInvoiceToFulfill(invoiceInfo);
    setIsFulfillmentModalOpen(true);
    setIsViewModalOpen(false);
  };
  
  const handleCloseFulfillmentModal = () => { setInvoiceToFulfill(null); setIsFulfillmentModalOpen(false); };
  
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
        if (!acc[delivery.date]) acc[delivery.date] = [];
        acc[delivery.date].push(delivery);
        return acc;
    }, {} as Record<string, Delivery[]>);
    return Object.entries(groupedByDate).map(([date, deliveries]) => ({ date, deliveries })).sort((a,b) => a.date.localeCompare(b.date));
  }, [supplier.deliveries]);

  const monthlyQuotas = useMemo(() => {
    if (!selectedDate || !supplier.contractItems) return [];
    const currentMonth = selectedDate.getMonth();
    return supplier.contractItems.map(item => {
        const deliveredThisMonth = supplier.deliveries
            .filter(d => d.item === item.name && new Date(d.date + 'T00:00:00').getMonth() === currentMonth)
            .reduce((sum, d) => sum + (d.kg || 0), 0);
        const isWithinContract = currentMonth <= 3;
        const monthlyQuota = isWithinContract ? item.totalKg / 4 : 0;
        return { name: item.name, monthlyQuota, deliveredThisMonth, remainingThisMonth: monthlyQuota - deliveredThisMonth, unit: 'Kg' };
    });
  }, [selectedDate, supplier.contractItems, supplier.deliveries]);

  return (
    <div className="min-h-screen text-gray-800 bg-gray-50 pb-20">
      <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black text-green-800 uppercase tracking-tighter italic">Olá, {supplier.name.split(' ')[0]}!</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Painel do Produtor 2026</p>
        </div>
        <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-4 rounded-xl transition-all border border-red-100 text-[10px] uppercase tracking-widest active:scale-95">Sair</button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Banner de Semanas Liberadas */}
        <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border-b-8 border-indigo-800 animate-fade-in">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                    <h2 className="text-lg font-black uppercase tracking-tight leading-none">Semanas Liberadas</h2>
                    <p className="text-xs font-bold text-indigo-200 mt-1 uppercase tracking-widest">Suas janelas de entrega para 2026</p>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {supplier.allowedWeeks && supplier.allowedWeeks.length > 0 ? (
                    supplier.allowedWeeks.sort((a,b) => a-b).map(w => (
                        <span key={w} className="bg-white text-indigo-800 font-black px-4 py-2 rounded-xl text-sm shadow-md">Semana {w}</span>
                    ))
                ) : (
                    <span className="bg-green-400 text-green-950 font-black px-6 py-2 rounded-xl text-sm shadow-md uppercase">Calendário Livre</span>
                )}
            </div>
        </div>

        {/* Legenda do Calendário Otimizada */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-50 rounded-full border border-green-200"></div> Semana Liberada</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white rounded-full border border-gray-200 shadow-sm"></div> Dia Agendável</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-100 rounded-full border-2 border-green-400"></div> Agendado</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-600 rounded-full"></div> Faturado</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div> Pendente NF</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-200 rounded-sm border border-gray-400"></div> Feriado / Bloqueado</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
              <Calendar 
                onDayClick={handleDayClick} 
                deliveries={supplier.deliveries} 
                simulatedToday={SIMULATED_TODAY} 
                allowedWeeks={supplier.allowedWeeks}
              />
          </div>
          <div className="space-y-6">
            <SummaryCard supplier={supplier} />
            {pendingDailyInvoices.length > 0 && (
                <InvoiceUploader 
                    pendingInvoices={pendingDailyInvoices} 
                    onFulfill={handleOpenFulfillmentModal}
                    onCancel={(ids) => onCancelDeliveries(supplier.cpf, ids)}
                />
            )}
          </div>
        </div>
      </main>

      {isModalOpen && selectedDate && (
        <DeliveryModal date={selectedDate} onClose={handleCloseModal} onSave={handleScheduleSave} monthlyQuotas={monthlyQuotas} />
      )}

      {isViewModalOpen && selectedDate && (
        <ViewDeliveryModal date={selectedDate} deliveries={deliveriesToShow} onClose={handleCloseViewModal} onAddNew={handleAddNewFromView} onCancel={(ids) => { if(window.confirm('Excluir?')) { onCancelDeliveries(supplier.cpf, ids); handleCloseViewModal(); } }} onFulfill={handleOpenFulfillmentModal} simulatedToday={SIMULATED_TODAY} />
      )}
      
      {isFulfillmentModalOpen && invoiceToFulfill && (
        <FulfillmentModal invoiceInfo={invoiceToFulfill} contractItems={supplier.contractItems} onClose={handleCloseFulfillmentModal} onSave={handleSaveFulfillment} />
      )}

      {emailModalData && <EmailConfirmationModal data={emailModalData} onClose={onCloseEmailModal} />}
    </div>
  );
};

export default Dashboard;
