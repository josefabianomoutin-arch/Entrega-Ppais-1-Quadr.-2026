
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

interface ValidationErrors {
    [itemId: string]: string;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getContractItemWeight = (item: ContractItem): number => {
    if (!item) return 0;
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    
    const quantity = item.totalKg || 0;

    if (unitType === 'un') {
        return quantity;
    }
    if (unitType === 'dz') {
        return 0;
    }

    const unitWeight = parseFloat(unitWeightStr) || 1;
    return quantity * unitWeight;
};

const FulfillmentModal: React.FC<FulfillmentModalProps> = ({ invoiceInfo, contractItems, onClose, onSave }) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState<FulfilledItem[]>([{ id: `item-${Date.now()}`, name: '', kg: '' }]);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const formattedDate = new Date(invoiceInfo.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  
  const earliestTime = useMemo(() => {
      if (!invoiceInfo.deliveries || invoiceInfo.deliveries.length === 0) return 'N/A';
      return invoiceInfo.deliveries.map(d => d.time).sort()[0];
  }, [invoiceInfo.deliveries]);

  const validateKg = (itemId: string, itemName: string, kgString: string): string => {
    // Se o item não foi selecionado ou o peso não foi preenchido, não há erro a ser mostrado ainda.
    // A validação de campos obrigatórios ocorre no momento do envio.
    if (!itemName || !kgString) return '';

    const kg = parseFloat(kgString.replace(',', '.'));
    
    // Valida se o valor inserido é um número válido e positivo.
    if (isNaN(kg)) return 'Valor de peso inválido.';
    if (kg <= 0) return 'O peso deve ser um valor positivo.';

    // A validação anterior que limitava a entrega a +/- 10% da meta mensal foi removida.
    return '';
  };

  const handleItemChange = (id: string, field: 'name' | 'kg', value: string) => {
    let newKg = field === 'kg' ? value.replace(/[^0-9,.]/g, '') : '';

    setItems(currentItems => {
        const updatedItems = currentItems.map(item => item.id === id ? { ...item, [field]: field === 'kg' ? newKg : value } : item);
        
        // Find the specific item that was changed to get its name for validation
        const changedItem = updatedItems.find(item => item.id === id);
        if (changedItem) {
            const kgToValidate = field === 'kg' ? newKg : changedItem.kg;
            const validationError = validateKg(id, changedItem.name, kgToValidate);
            setErrors(prevErrors => ({ ...prevErrors, [id]: validationError }));
        }

        return updatedItems;
    });
  };

  const handleAddItem = () => {
    setItems(currentItems => [...currentItems, { id: `item-${Date.now()}-${Math.random()}`, name: '', kg: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id));
    setErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors[id];
        return newErrors;
    });
  };

  const totalValue = useMemo(() => {
    return items.reduce((total, item) => {
      const contractItem = contractItems.find(ci => ci.name === item.name);
      const kg = parseFloat(item.kg.replace(',', '.'));
      
      if (contractItem && !isNaN(kg)) {
        const [unitType, unitWeightStr] = (contractItem.unit || 'kg-1').split('-');
        let valuePerKg = contractItem.valuePerKg || 0; // Para 'kg' e 'un', este já é o valor/kg
        
        if (unitType !== 'kg' && unitType !== 'un' && unitType !== 'dz') {
            const unitWeight = parseFloat(unitWeightStr);
            if (unitWeight > 0) {
                valuePerKg = (contractItem.valuePerKg || 0) / unitWeight; // value_per_unit / weight_of_unit
            }
        }
        
        if (unitType === 'dz') return total;

        return total + (kg * valuePerKg);
      }
      return total;
    }, 0);
  }, [items, contractItems]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      alert('Por favor, insira o número da nota fiscal.');
      return;
    }

    // Final validation check
    const finalErrors: ValidationErrors = {};
    items.forEach(item => {
        const error = validateKg(item.id, item.name, item.kg);
        if (error) finalErrors[item.id] = error;
    });
    setErrors(finalErrors);
    if(Object.values(finalErrors).some(e => e)) {
        alert('Existem erros nos itens. Por favor, corrija os valores de peso antes de salvar.');
        return;
    }


    const fulfilledItems = items.map(item => {
        const contractItem = contractItems.find(ci => ci.name === item.name);
        const kg = parseFloat(item.kg.replace(',', '.'));

        if (!contractItem || isNaN(kg) || kg <= 0) return null;
        
        const [unitType, unitWeightStr] = (contractItem.unit || 'kg-1').split('-');
        if (unitType === 'dz') return null;
        
        let valuePerKg = contractItem.valuePerKg || 0;
        if (unitType !== 'kg' && unitType !== 'un') {
            const unitWeight = parseFloat(unitWeightStr);
            if (unitWeight > 0) valuePerKg = (contractItem.valuePerKg || 0) / unitWeight;
        }

        return { name: item.name, kg: kg, value: kg * valuePerKg };
    }).filter((item): item is { name: string; kg: number; value: number } => item !== null);

    if (fulfilledItems.length === 0) {
      alert('Adicione pelo menos um item válido com peso maior que zero. Itens medidos em Dúzia não podem ser faturados por peso.');
      return;
    }

    onSave({ invoiceNumber, fulfilledItems });
  };
  
  const availableContractItems = useMemo(() => {
      return contractItems.filter(ci => {
          const [unitType] = (ci.unit || 'kg-1').split('-');
          return unitType !== 'dz'; // Filtra itens em dúzia que não podem ser faturados por kg
      }).sort((a,b) => a.name.localeCompare(b.name));
  }, [contractItems]);

  const isSaveDisabled = Object.values(errors).some(e => e) || items.some(i => !i.name || !i.kg);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Faturar Entrega</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <p className="mb-6 text-gray-600">
            Data da Entrega: <span className="font-semibold text-green-700">{formattedDate}</span>
            <span className="text-sm text-gray-500 ml-2">(a partir de {earliestTime})</span>
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="invoice-number" className="block text-sm font-medium text-gray-700">Número da Nota Fiscal</label>
                <input type="text" id="invoice-number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required placeholder="Ex: 001234" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"/>
            </div>

            <div className="space-y-4 pt-2 border-t">
                <label className="block text-sm font-medium text-gray-700">Itens Entregues (em Kg)</label>
                <div className="space-y-4 max-h-64 overflow-y-auto p-2 border rounded-md bg-gray-50">
                    {items.map((item, index) => {
                        const contractItem = contractItems.find(ci => ci.name === item.name);
                        let itemValue = 0;
                        if(contractItem) {
                            const kg = parseFloat(item.kg.replace(',','.'));
                             if (contractItem && !isNaN(kg)) {
                                const [unitType, unitWeightStr] = (contractItem.unit || 'kg-1').split('-');
                                let valuePerKg = contractItem.valuePerKg || 0; 
                                if (unitType !== 'kg' && unitType !== 'un' && unitType !== 'dz') {
                                    const unitWeight = parseFloat(unitWeightStr);
                                    if (unitWeight > 0) valuePerKg = (contractItem.valuePerKg || 0) / unitWeight;
                                }
                                if(unitType !== 'dz') itemValue = kg * valuePerKg;
                            }
                        }
                        const error = errors[item.id];

                        return (
                        <div key={item.id} className="p-3 border rounded-lg bg-white shadow-sm">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <select 
                                    value={item.name} 
                                    onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                    className="w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                                >
                                    <option value="">-- Selecione o Item --</option>
                                    {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                </select>
                                <input
                                    type="text"
                                    value={item.kg}
                                    onChange={e => handleItemChange(item.id, 'kg', e.target.value)}
                                    placeholder="Peso (Kg)"
                                    className={`w-full sm:w-1/4 px-3 py-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm font-mono`}
                                />
                                <div className="w-full sm:w-1/4 text-center sm:text-right">
                                    {item.name && contractItem && !isNaN(parseFloat(item.kg.replace(',','.'))) ? (
                                        <span className="text-sm font-semibold text-green-600">
                                            {formatCurrency(itemValue)}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">--</span>
                                    )}
                                </div>
                                <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full" title="Remover Item">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                            {error && <p className="text-red-600 text-xs mt-1 pl-1">{error}</p>}
                        </div>
                    )})}
                     <button type="button" onClick={handleAddItem} className="w-full text-sm text-blue-600 hover:bg-blue-50 py-2 rounded-md border-2 border-dashed flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Adicionar Item
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 font-bold text-lg border-t">
                <span className="text-gray-600">Valor Total da NF:</span>
                <span className="text-blue-600">{formatCurrency(totalValue)}</span>
            </div>
            
            <div className="pt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">Cancelar</button>
                <button 
                    type="submit" 
                    disabled={isSaveDisabled}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Salvar e Enviar NF
                </button>
            </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default FulfillmentModal;
