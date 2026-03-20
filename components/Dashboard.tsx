
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';
import Calendar from './Calendar';
import DeliveryModal from './DeliveryModal';
import ViewDeliveryModal from './ViewDeliveryModal';
import SummaryCard from './SummaryCard';
import InvoiceUploader from './InvoiceUploader';
import EmailConfirmationModal from './EmailConfirmationModal';
import SendInvoiceModal from './SendInvoiceModal';
import ConfirmModal from './ConfirmModal';
import { speechService } from '../src/services/speechService';
import { HelpCircle, Volume2, Loader2 } from 'lucide-react';

const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');

interface DashboardProps {
  supplier: Supplier;
  type?: 'PRODUTOR' | 'FORNECEDOR';
  monthlySchedule?: Record<string, number[]>;
  onLogout: () => void;
  onScheduleDelivery: (supplierCpf: string, date: string, time: string) => void;
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
  onSaveInvoice: (supplierCpf: string, deliveryIds: string[], invoiceNumber: string, invoiceUrl: string) => Promise<void>;
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
  type = 'PRODUTOR',
  monthlySchedule,
  onLogout, 
  onScheduleDelivery, 
  onCancelDeliveries,
  onSaveInvoice,
  emailModalData,
  onCloseEmailModal
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSendInvoiceModalOpen, setIsSendInvoiceModalOpen] = useState(false);
  const [invoiceToSend, setInvoiceToSend] = useState<{ date: string; deliveries: Delivery[] } | null>(null);
  const [deliveriesToShow, setDeliveriesToShow] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      variant?: 'danger' | 'warning' | 'info';
  }>({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {},
  });

  const panelTitle = type === 'PRODUTOR' ? 'Painel do Produtor 2026' : 'Painel do Fornecedor 2026';
  const headerColor = type === 'PRODUTOR' ? 'text-green-800' : 'text-indigo-800';
  const bannerColor = type === 'PRODUTOR' ? 'bg-indigo-600 border-indigo-800' : 'bg-emerald-600 border-emerald-800';
  const bannerTextColor = type === 'PRODUTOR' ? 'text-indigo-200' : 'text-emerald-100';
  const weekBadgeColor = type === 'PRODUTOR' ? 'bg-white text-indigo-800' : 'bg-white text-emerald-800';

  const handleDayClick = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const deliveriesOnDate = Object.values(supplier.deliveries || {}).filter(d => d.date === dateString);
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

  const handleOpenSendInvoiceModal = (invoiceInfo: { date: string; deliveries: Delivery[] }) => {
    setInvoiceToSend(invoiceInfo);
    setIsSendInvoiceModalOpen(true);
    setIsViewModalOpen(false);
  };

  const handleCloseSendInvoiceModal = () => { setInvoiceToSend(null); setIsSendInvoiceModalOpen(false); };
  
  const handlePlayGeneralHelp = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const text = "Olá! Este é o seu painel de entregas. Para agendar uma nova entrega, clique em um dia vazio no calendário. Para enviar uma nota fiscal de uma entrega já realizada, clique no dia da entrega e selecione 'Enviar Nota Fiscal'. Se precisar de ajuda em cada passo, procure pelo ícone de som.";
      await speechService.speak(text);
    } finally {
      setIsSpeaking(false);
    }
  };
  
  const pendingDailyInvoices = useMemo(() => {
    const pending = Object.values(supplier.deliveries || {}).filter(d => {
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
    return Object.values(supplier.contractItems || {}).map(item => {
        const deliveredThisMonth = Object.values(supplier.deliveries || {})
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
        <div className="flex items-center gap-4">
          <div>
            <h1 className={`text-xl font-black ${headerColor} uppercase tracking-tighter italic`}>Olá, {supplier.name.split(' ')[0]}!</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{panelTitle}</p>
          </div>
          <button 
            onClick={handlePlayGeneralHelp}
            disabled={isSpeaking}
            className={`p-2 rounded-full transition-colors ${isSpeaking ? 'bg-indigo-200 text-indigo-800 animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
            title="Ajuda por Voz"
          >
            {isSpeaking ? <Volume2 className="h-5 w-5 animate-pulse" /> : <HelpCircle className="h-5 w-5" />}
          </button>
        </div>
        <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-4 rounded-xl transition-all border border-red-100 text-[10px] uppercase tracking-widest active:scale-95">Sair</button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Banner de Semanas Liberadas */}
        <div className={`${bannerColor} text-white p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border-b-8 animate-fade-in`}>
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                    <h2 className="text-lg font-black uppercase tracking-tight leading-none">Semanas Liberadas</h2>
                    <p className={`text-xs font-bold ${bannerTextColor} mt-1 uppercase tracking-widest`}>Suas janelas de entrega para 2026</p>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {monthlySchedule ? (
                    Object.entries(monthlySchedule).filter(([_, weeks]) => Object.values(weeks || {}).length > 0).map(([month, weeks]) => (
                        <div key={month} className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-xl border border-white/30">
                            <span className="text-[9px] font-black uppercase">{month.substring(0,3)}:</span>
                            <div className="flex gap-1">
                                {Object.values(weeks || {}).map(w => (
                                    <span key={w as number} className="bg-white text-gray-800 w-5 h-5 flex items-center justify-center rounded-lg text-[10px] font-black shadow-sm">{w as number}</span>
                                ))}
                            </div>
                        </div>
                    ))
                ) : supplier.allowedWeeks && Object.values(supplier.allowedWeeks || {}).length > 0 ? (
                    Object.values(supplier.allowedWeeks || {}).sort((a: any, b: any) => a-b).map(w => (
                        <span key={w as number} className={`${weekBadgeColor} font-black px-4 py-2 rounded-xl text-sm shadow-md`}>Semana {w as number}</span>
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
                deliveries={Object.values(supplier.deliveries || {})} 
                simulatedToday={SIMULATED_TODAY} 
                allowedWeeks={supplier.allowedWeeks}
                monthlySchedule={monthlySchedule}
              />
          </div>
          <div className="space-y-6">
            <SummaryCard supplier={supplier} />
            {pendingDailyInvoices.length > 0 && (
                <InvoiceUploader 
                    pendingInvoices={pendingDailyInvoices} 
                    onSendInvoice={handleOpenSendInvoiceModal}
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
        <ViewDeliveryModal 
            date={selectedDate} 
            deliveries={deliveriesToShow} 
            onClose={handleCloseViewModal} 
            onAddNew={handleAddNewFromView} 
            onCancel={(ids) => { 
                setConfirmConfig({
                    isOpen: true,
                    title: 'Excluir',
                    message: 'Excluir?',
                    onConfirm: () => {
                        onCancelDeliveries(supplier.cpf, ids); 
                        handleCloseViewModal();
                        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                    },
                    variant: 'danger'
                });
            }} 
            onFulfill={handleOpenSendInvoiceModal} 
            simulatedToday={SIMULATED_TODAY} 
        />
      )}
      
      {isSendInvoiceModalOpen && invoiceToSend && (
        <SendInvoiceModal 
          invoiceInfo={invoiceToSend} 
          onClose={handleCloseSendInvoiceModal} 
          onSave={(invoiceNumber, invoiceUrl) => onSaveInvoice(supplier.cpf, invoiceToSend.deliveries.map(d => d.id), invoiceNumber, invoiceUrl)}
        />
      )}

      {emailModalData && <EmailConfirmationModal data={emailModalData} onClose={onCloseEmailModal} />}
      
      <ConfirmModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
          variant={confirmConfig.variant}
      />
    </div>
  );
};

export default Dashboard;
