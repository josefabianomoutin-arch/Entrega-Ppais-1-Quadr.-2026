
import React, { useState, useMemo } from 'react';
import type { Delivery, ContractItem } from '../types';

interface FulfillmentModalProps {
  invoiceInfo: { date: string; deliveries: Delivery[] };
  contractItems: ContractItem[];
  onClose: () => void;
  onSave: (invoiceData: { invoiceNumber: string; fulfilledItems: { name: string; kg: number; value: number }[] }) => void;
}

interface FulfilledItem {
    id: string;
    name: string;
    kg: string;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getDisplayUnit = (item: ContractItem | undefined): string => {
    if (!item || !item.unit) return 'Kg';
    const [unitType] = item.unit.split('-');
    const unitMap: { [key: string]: string } = {
        kg: 'Kg', un: 'Kg', saco: 'Kg', balde: 'Kg', pacote: 'Kg', pote: 'Kg',
        litro: 'L', l: 'L', caixa: 'L', embalagem: 'L',
        dz: 'Dz'
    };
    return unitMap[unitType] || 'Un';
};

const FulfillmentModal: React.FC<FulfillmentModalProps> = ({ invoiceInfo, contractItems, onClose, onSave }) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState<FulfilledItem[]>([{ id: `item-${Date.now()}`, name: '', kg: '' }]);
  const [confirmed, setConfirmed] = useState(false);

  const formattedDate = new Date(invoiceInfo.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  
  const earliestTime = useMemo(() => {
      if (!invoiceInfo.deliveries || invoiceInfo.deliveries.length === 0) return 'N/A';
      return invoiceInfo.deliveries.map(d => d.time).sort()[0];
  }, [invoiceInfo.deliveries]);

  const handleItemChange = (id: string, field: 'name' | 'kg', value: string) => {
    setItems(currentItems => currentItems.map(item => {
        if (item.id === id) {
            let newVal = value;
            if (field === 'kg') {
                newVal = value.replace(/[^0-9,.]/g, '').replace('.', ',');
            }
            return { ...item, [field]: newVal };
        }
        return item;
    }));
  };

  const handleAddItem = () => {
    setItems(currentItems => [...currentItems, { id: `item-${Date.now()}-${Math.random()}`, name: '', kg: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
        setItems(currentItems => currentItems.filter(item => item.id !== id));
    }
  };

  const totalValue = useMemo(() => {
    return items.reduce((total, item) => {
      const contractItem = contractItems.find(ci => ci.name === item.name);
      const kgStr = item.kg.replace(',', '.');
      const kg = parseFloat(kgStr);
      
      if (contractItem && !isNaN(kg) && kg > 0) {
        const [unitType, unitWeightStr] = (contractItem.unit || 'kg-1').split('-');
        let valuePerKg = contractItem.valuePerKg || 0;
        
        if (unitType !== 'kg' && unitType !== 'un' && unitType !== 'dz') {
            const unitWeight = parseFloat(unitWeightStr);
            if (unitWeight > 0) {
                valuePerKg = (contractItem.valuePerKg || 0) / unitWeight;
            }
        }
        
        if (unitType === 'dz') return total;
        return total + (kg * valuePerKg);
      }
      return total;
    }, 0);
  }, [items, contractItems]);

  // TRAVA DE SEGURANÇA: Validação dos campos obrigatórios
  const isFormValid = useMemo(() => {
    const hasNf = invoiceNumber.trim().length > 0;
    const hasItems = items.length > 0;
    const allItemsValid = items.every(item => {
        const kg = parseFloat(item.kg.replace(',', '.'));
        return item.name !== '' && !isNaN(kg) && kg > 0;
    });
    return hasNf && hasItems && allItemsValid && confirmed;
  }, [invoiceNumber, items, confirmed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) return;

    const fulfilledItems = items.map(item => {
        const contractItem = contractItems.find(ci => ci.name === item.name);
        const kg = parseFloat(item.kg.replace(',', '.'));

        if (!contractItem || isNaN(kg) || kg <= 0) return null;
        
        const [unitType, unitWeightStr] = (contractItem.unit || 'kg-1').split('-');
        let valuePerKg = contractItem.valuePerKg || 0;
        if (unitType !== 'kg' && unitType !== 'un') {
            const unitWeight = parseFloat(unitWeightStr);
            if (unitWeight > 0) valuePerKg = (contractItem.valuePerKg || 0) / unitWeight;
        }

        return { name: item.name, kg: kg, value: kg * valuePerKg };
    }).filter((item): item is { name: string; kg: number; value: number } => item !== null);

    onSave({ invoiceNumber, fulfilledItems });
  };
  
  const availableContractItems = useMemo(() => {
      return contractItems.filter(ci => {
          const [unitType] = (ci.unit || 'kg-1').split('-');
          return unitType !== 'dz';
      }).sort((a,b) => a.name.localeCompare(b.name));
  }, [contractItems]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 animate-fade-in-up border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Lançamento de Faturamento</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Obrigatório informar Pesos e Itens</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-6 flex items-start gap-3">
            <div className="bg-orange-500 text-white p-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
                <p className="text-[10px] text-orange-800 font-black uppercase tracking-tight">Data da Entrega Agendada</p>
                <p className="text-sm font-bold text-orange-950">{formattedDate} às {earliestTime}</p>
            </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label htmlFor="invoice-number" className="text-[10px] font-black text-gray-400 uppercase ml-1">Nº da Nota Fiscal (NF)</label>
                    <input type="text" id="invoice-number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required placeholder="Ex: 001234" className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-800"/>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 flex flex-col justify-center border-2 border-dashed border-gray-200">
                    <p className="text-[9px] text-gray-400 font-black uppercase text-center mb-1">Total da Nota Calculado</p>
                    <p className="text-xl font-black text-indigo-700 text-center">{formatCurrency(totalValue)}</p>
                </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trava: Informe Pesos e Itens Abaixo</label>
                    <button type="button" onClick={handleAddItem} className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
                
                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {items.map((item, index) => {
                        const contractItem = contractItems.find(ci => ci.name === item.name);
                        const displayUnit = getDisplayUnit(contractItem);
                        const isInvalid = item.kg !== '' && (parseFloat(item.kg.replace(',', '.')) <= 0 || isNaN(parseFloat(item.kg.replace(',', '.'))));

                        return (
                            <div key={item.id} className={`p-4 border-2 rounded-2xl transition-all ${isInvalid ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white hover:border-indigo-100 shadow-sm'}`}>
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <select 
                                        value={item.name} 
                                        onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                        className="w-full sm:flex-1 px-3 py-2.5 border border-gray-200 rounded-xl outline-none font-bold text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Selecione o Produto --</option>
                                        {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                    </select>
                                    <div className="flex items-center gap-2 w-full sm:w-40">
                                        <input
                                            type="text"
                                            value={item.kg}
                                            onChange={e => handleItemChange(item.id, 'kg', e.target.value)}
                                            placeholder={`Peso (${displayUnit})`}
                                            className={`w-full px-3 py-2.5 border-2 rounded-xl outline-none font-mono text-center font-black ${isInvalid ? 'border-red-300 text-red-600' : 'border-gray-100 text-gray-800 focus:border-indigo-500'}`}
                                        />
                                    </div>
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-300 hover:text-red-600 transition-colors p-1" title="Remover">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            checked={confirmed} 
                            onChange={e => setConfirmed(e.target.checked)}
                            className="peer sr-only"
                        />
                        <div className="w-6 h-6 border-2 border-gray-300 rounded-md peer-checked:bg-orange-600 peer-checked:border-orange-600 transition-all flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter select-none group-hover:text-gray-900 transition-colors">
                        Confirmo que os pesos e itens lançados acima conferem com o físico entregue na Unidade.
                    </span>
                </label>
            </div>
            
            <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
                <button 
                    type="submit" 
                    disabled={!isFormValid}
                    className={`flex-[2] flex items-center justify-center gap-2 font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-sm text-white ${isFormValid ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                >
                    {!isFormValid && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                    Salvar e Enviar NF
                </button>
            </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default FulfillmentModal;
