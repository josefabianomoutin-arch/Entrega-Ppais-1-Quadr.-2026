
import React, { useState, useEffect, useMemo } from 'react';
import type { StandardMenu, DailyMenus, MenuRow, Supplier } from '../types';

interface AdminStandardMenuProps {
  template: StandardMenu;
  dailyMenus: DailyMenus;
  onUpdateTemplate: (template: StandardMenu) => Promise<void>;
  onUpdateDailyMenus: (menus: DailyMenus) => Promise<void>;
  inmateCount: number;
  suppliers: Supplier[];
}

const WEEK_DAYS_BR = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MEAL_PERIODS = ['CAFÉ DA MANHÃ', 'ALMOÇO', 'JANTA', 'LANCHE NOITE'];
const ROWS_PER_DAY = 15;

const AdminStandardMenu: React.FC<AdminStandardMenuProps> = ({ template, dailyMenus, onUpdateTemplate, onUpdateDailyMenus, inmateCount, suppliers }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMenu, setCurrentMenu] = useState<MenuRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateDay, setTemplateDay] = useState<string>('SEGUNDA-FEIRA');
  const [isLoadedFromSaved, setIsLoadedFromSaved] = useState(false);
  const [templateView, setTemplateView] = useState<'week' | 'day'>('week');

  const availableContractItems = useMemo(() => {
    const itemSet = new Set<string>();
    (suppliers || []).forEach(s => {
        (s.contractItems || []).forEach(ci => {
            itemSet.add(ci.name);
        });
    });
    return Array.from(itemSet).sort();
  }, [suppliers]);
  
  const contractItemUnitMap = useMemo(() => {
    const map = new Map<string, string>();
    (suppliers || []).forEach(s => {
        (s.contractItems || []).forEach(ci => {
            if (!map.has(ci.name)) {
                map.set(ci.name, ci.unit || 'kg-1');
            }
        });
    });
    return map;
  }, [suppliers]);

  const getUnitLabel = (unitString: string | undefined): string => {
    if (!unitString) return 'g/ml';
    const [type] = (unitString || 'kg-1').split('-');
    if (type === 'dz') return 'Dz';
    if (type === 'un') return 'Un';
    return 'g/ml';
  };

  const calculateTotalWeight = (unitWeightStr: string, contractedItemName: string | undefined): string => {
    const unitVal = parseFloat(unitWeightStr.replace(',', '.')) || 0;
    if (unitVal <= 0 || inmateCount <= 0) {
        return '';
    }

    const unitString = contractItemUnitMap.get(contractedItemName || '');
    const [unitType] = (unitString || 'kg-1').split('-');
    const calculatedTotal = unitVal * inmateCount;

    if (unitType === 'dz' || unitType === 'un') {
        const unitLabel = unitType === 'dz' ? 'Dz' : 'Un';
        return `${calculatedTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${unitLabel}`;
    }
    
    const suffix = (unitString || 'kg').toLowerCase().includes('litro') ? 'L' : 'Kg';
    return `${(calculatedTotal / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${suffix}`;
  }

  // Carrega o cardápio para a data selecionada
  useEffect(() => {
    const normalize = (rows: any[], baseId: string): MenuRow[] => {
      const defaultRow = { period: '', foodItem: '', contractedItem: '', unitWeight: '', totalWeight: '' };
      return (rows || []).map((row, i) => ({
        ...defaultRow,
        ...row,
        id: row.id || `${baseId}-${i}`,
        foodItem: row.foodItem || row.description || '', // Compatibility with old data
      }));
    };

    if (isEditingTemplate) {
        if (templateView === 'day') {
            setIsLoadedFromSaved(false);
            const baseRows = template[templateDay] || [];
            const paddedRows = Array.from({ length: ROWS_PER_DAY }, (_, i) => baseRows[i] || {});
            setCurrentMenu(normalize(paddedRows, templateDay));
        }
    } else {
        let rowsToSet: MenuRow[];
        if (dailyMenus[selectedDate]) {
            setIsLoadedFromSaved(true);
            const baseRows = dailyMenus[selectedDate] || [];
            const paddedRows = Array.from({ length: ROWS_PER_DAY }, (_, i) => baseRows[i] || {});
            rowsToSet = normalize(paddedRows, selectedDate);
        } else {
            setIsLoadedFromSaved(false);
            const dateObj = new Date(selectedDate + 'T00:00:00');
            const dayName = WEEK_DAYS_BR[dateObj.getDay()];
            const baseTemplateRows = template[dayName] || [];
            const paddedTemplateRows = Array.from({ length: ROWS_PER_DAY }, (_, i) => baseTemplateRows[i] || {});
            
            const copiesWithoutIds = (paddedTemplateRows as Partial<MenuRow>[]).map(({ id, ...rest }) => rest);

            rowsToSet = normalize(copiesWithoutIds, selectedDate);
        }
        
        rowsToSet.forEach(row => {
            row.totalWeight = calculateTotalWeight(row.unitWeight, row.contractedItem);
        });
        setCurrentMenu(rowsToSet);
    }
  }, [selectedDate, dailyMenus, template, isEditingTemplate, templateDay, inmateCount, templateView]);


  const handleInputChange = (index: number, field: keyof MenuRow, value: string) => {
    const updated = [...currentMenu];
    let newRow = { ...updated[index], [field]: value };

    if (field === 'unitWeight' || field === 'contractedItem') {
        const item = field === 'contractedItem' ? value : newRow.contractedItem;
        const weight = field === 'unitWeight' ? value : newRow.unitWeight;
        newRow.totalWeight = calculateTotalWeight(weight, item);
    }

    updated[index] = newRow;
    setCurrentMenu(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isEditingTemplate) {
        await onUpdateTemplate({ ...template, [templateDay]: currentMenu.filter(r => r.foodItem || r.contractedItem || r.unitWeight) });
        alert('Template atualizado com sucesso!');
      } else {
        await onUpdateDailyMenus({ ...dailyMenus, [selectedDate]: currentMenu.filter(r => r.foodItem || r.contractedItem || r.unitWeight) });
        alert(isLoadedFromSaved ? 'Cardápio atualizado com sucesso!' : 'Cardápio do dia salvo com sucesso!');
      }
    } catch (e) {
      alert('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedHistory = useMemo(() => {
    return Object.keys(dailyMenus).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [dailyMenus]);
  
  const supplierAnalysis = useMemo(() => {
    const contractedItemsInMenu = [...new Set(currentMenu.map(row => row.contractedItem).filter(Boolean) as string[])];

    if (contractedItemsInMenu.length === 0 || !suppliers || suppliers.length === 0) {
        return [];
    }

    return contractedItemsInMenu.map(itemName => {
        const foundSuppliers = suppliers
            .filter(supplier => (supplier.contractItems || []).some(ci => ci.name === itemName))
            .map(supplier => {
                const contractItem = supplier.contractItems.find(ci => ci.name === itemName);
                const totalContracted = contractItem?.totalKg || 0;
                
                const totalDelivered = (supplier.deliveries || [])
                    .filter(d => d.item === itemName)
                    .reduce((sum, d) => sum + (d.kg || 0), 0);
                
                const remainingBalance = Math.max(0, totalContracted - totalDelivered);
                
                const unitString = contractItem?.unit || 'kg-1';
                const [unitType] = unitString.split('-');
                
                let displayUnit = 'Kg';
                if (unitType === 'dz') displayUnit = 'Dz';
                else if (unitType === 'un') displayUnit = 'Un';
                else if (['litro', 'l', 'embalagem', 'caixa'].includes(unitType)) displayUnit = 'L';

                return {
                    name: supplier.name,
                    remainingBalance,
                    displayUnit
                };
            });

        return {
            contractedItem: itemName,
            suppliers: foundSuppliers.sort((a, b) => b.remainingBalance - a.remainingBalance),
        };
    });
  }, [currentMenu, suppliers]);

  const weeklyTemplateAnalysis = useMemo(() => {
    if (!template || inmateCount <= 0) return [];
  
    const analysisMap = new Map<string, {
        totalRequiredBaseUnit: number; // Store in grams for weight/volume, or units for Dz/Un
        unitType: 'weight' | 'volume' | 'dozen' | 'unit';
        suppliers: { name: string; remainingBalance: number; unit: string; }[];
    }>();
  
    // 1. Aggregate total weekly requirement for each item
    WEEK_DAYS_BR.forEach(day => {
      (template[day] || []).forEach(row => {
        if (row.contractedItem && row.unitWeight) {
          const unitVal = parseFloat(row.unitWeight.replace(',', '.')) || 0;
          const requiredForThisRow = unitVal * inmateCount;
  
          if (requiredForThisRow > 0) {
            const itemInfo = analysisMap.get(row.contractedItem) || {
              totalRequiredBaseUnit: 0,
              unitType: 'weight', // default
              suppliers: []
            };
  
            const unitString = contractItemUnitMap.get(row.contractedItem);
            const [type] = (unitString || 'kg-1').split('-');
  
            if (type === 'dz') itemInfo.unitType = 'dozen';
            else if (type === 'un') itemInfo.unitType = 'unit';
            else if (['litro', 'l', 'embalagem', 'caixa'].some(u => type.includes(u))) itemInfo.unitType = 'volume';
            else itemInfo.unitType = 'weight';
  
            itemInfo.totalRequiredBaseUnit += requiredForThisRow;
            analysisMap.set(row.contractedItem, itemInfo);
          }
        }
      });
    });
  
    // 2. Find suppliers and their balances for each required item
    analysisMap.forEach((itemData, itemName) => {
        const foundSuppliers = suppliers
            .filter(s => (s.contractItems || []).some(ci => ci.name === itemName))
            .map(s => {
                const contractItem = s.contractItems.find(ci => ci.name === itemName);
                const totalContracted = contractItem?.totalKg || 0;
                
                const totalDelivered = (s.deliveries || [])
                    .filter(d => d.item === itemName)
                    .reduce((sum, d) => sum + (d.kg || 0), 0);
                
                const remainingBalance = Math.max(0, totalContracted - totalDelivered);

                const unitString = contractItem?.unit || 'kg-1';
                const [unitType] = unitString.split('-');
                
                let displayUnit = 'Kg';
                if (unitType === 'dz') displayUnit = 'Dz';
                else if (unitType === 'un') displayUnit = 'Un';
                else if (['litro', 'l', 'embalagem', 'caixa'].includes(unitType)) displayUnit = 'L';
                
                return { name: s.name, remainingBalance, unit: displayUnit };
            });
      
        itemData.suppliers = foundSuppliers.sort((a, b) => b.remainingBalance - a.remainingBalance);
    });
  
    // 3. Format for display
    return Array.from(analysisMap.entries()).map(([itemName, data]) => {
      let displayRequirement = '';
      let requirementInKg = 0; // For comparison with supplier balance

      if (data.unitType === 'dozen' || data.unitType === 'unit') {
        const unitLabel = data.unitType === 'dozen' ? 'Dz' : 'Un';
        displayRequirement = `${data.totalRequiredBaseUnit.toLocaleString('pt-BR')} ${unitLabel}`;
        requirementInKg = data.totalRequiredBaseUnit; // Here it's units/dozens, not Kg
      } else {
        const unitLabel = data.unitType === 'volume' ? 'L' : 'Kg';
        const totalInKgOrL = data.totalRequiredBaseUnit / 1000;
        displayRequirement = `${totalInKgOrL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${unitLabel}`;
        requirementInKg = totalInKgOrL;
      }
      
      return {
        itemName,
        weeklyRequirement: displayRequirement,
        requirementInKg, // Standardized for comparison
        unitType: data.unitType,
        suppliers: data.suppliers,
      };
    }).sort((a,b) => a.itemName.localeCompare(b.itemName));
  }, [template, inmateCount, suppliers, contractItemUnitMap]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-full mx-auto border-t-8 border-amber-500 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tighter">Cardápio Institucional</h2>
          <p className="text-gray-400 font-medium">Gestão de descrições e pesos por data ou modelo padrão.</p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <button 
                onClick={() => setIsEditingTemplate(false)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!isEditingTemplate ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                Lançar por Data
            </button>
            <button 
                onClick={() => setIsEditingTemplate(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isEditingTemplate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                Editar Templates Semanais
            </button>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
             <span className="text-[10px] font-black text-amber-600 uppercase block mb-1">População Base</span>
             <span className="text-lg font-bold text-amber-800">{inmateCount} Carcerária</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            {!isEditingTemplate ? (
                <div className="bg-gray-50 p-4 rounded-xl border">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Selecionar Data</label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <p className="mt-2 text-[10px] text-gray-500 italic">
                        Dia da semana: <span className="font-bold uppercase">{WEEK_DAYS_BR[new Date(selectedDate + 'T00:00:00').getDay()]}</span>
                    </p>
                </div>
            ) : (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2">Modo de Visualização</label>
                    <div className="flex gap-1 bg-indigo-200/50 p-1 rounded-lg">
                        <button onClick={() => setTemplateView('week')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${templateView === 'week' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-500'}`}>Visão Semanal</button>
                        <button onClick={() => setTemplateView('day')} className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${templateView === 'day' ? 'bg-white text-indigo-700 shadow' : 'text-indigo-500'}`}>Editar por Dia</button>
                    </div>
                    {templateView === 'day' && (
                        <div className="mt-4 animate-fade-in">
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2">Selecionar Dia do Modelo</label>
                            <select 
                                value={templateDay} 
                                onChange={(e) => setTemplateDay(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            >
                                {WEEK_DAYS_BR.map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {(!isEditingTemplate || templateView === 'day') && (
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase text-sm tracking-widest text-white ${isEditingTemplate ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                    {isSaving ? 'Salvando...' : (isEditingTemplate ? 'Salvar Template' : isLoadedFromSaved ? 'Atualizar Cardápio' : 'Salvar Cardápio do Dia')}
                </button>
            )}

            {!isEditingTemplate && sortedHistory.length > 0 && (
                <div className="pt-6 border-t">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Consulta de Histórico</h4>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {sortedHistory.map(date => (
                            <button 
                                key={date} 
                                onClick={() => setSelectedDate(date)}
                                className={`w-full text-left p-2 rounded text-xs font-mono transition-colors ${selectedDate === date ? 'bg-amber-100 text-amber-800 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                            >
                                {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="lg:col-span-3">
             {isEditingTemplate && templateView === 'week' ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">Análise Semanal do Template</h3>
                        <p className="text-sm text-indigo-800/60">Previsão de consumo e disponibilidade de fornecedores com base no cardápio padrão.</p>
                    </div>
                    {weeklyTemplateAnalysis.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                            {weeklyTemplateAnalysis.map(item => {
                                const requirementForComparison = item.unitType === 'dozen' ? item.requirementInKg : item.requirementInKg;
                                return (
                                <div key={item.itemName} className="bg-white p-4 rounded-lg border shadow-sm">
                                    <h4 className="font-black text-gray-800 uppercase tracking-tight">{item.itemName}</h4>
                                    <div className="my-3 bg-gray-50 p-3 rounded-lg text-center">
                                        <p className="text-[10px] font-bold uppercase text-gray-400">Total Necessário na Semana</p>
                                        <p className="text-2xl font-mono font-bold text-indigo-600">{item.weeklyRequirement}</p>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Fornecedores com Saldo</h5>
                                        {item.suppliers.length > 0 ? (
                                            <ul className="space-y-2 text-sm">
                                                {item.suppliers.map(s => {
                                                    const canCover = s.remainingBalance >= requirementForComparison;
                                                    const balanceExhausted = s.remainingBalance <= 0;
                                                    const formattingOptions: Intl.NumberFormatOptions = {
                                                        minimumFractionDigits: (s.unit === 'Dz' || s.unit === 'Un') ? 0 : 2,
                                                        maximumFractionDigits: (s.unit === 'Dz' || s.unit === 'Un') ? 0 : 2,
                                                    };
                                                    return(
                                                    <li key={s.name} className="flex justify-between items-center bg-gray-50/70 p-2 rounded-md">
                                                        <span className="font-semibold text-gray-700">{s.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-mono text-xs font-bold ${balanceExhausted ? 'text-red-500' : 'text-gray-600'}`}>
                                                                {s.remainingBalance.toLocaleString('pt-BR', formattingOptions)} {s.unit}
                                                            </span>
                                                            {!balanceExhausted && (
                                                                <span title={canCover ? 'Saldo suficiente para a semana' : 'Saldo insuficiente para a semana'} className={`w-3 h-3 rounded-full ${canCover ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                                                            )}
                                                        </div>
                                                    </li>
                                                )})}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-center text-red-500 bg-red-50 p-2 rounded-md italic">Nenhum fornecedor com este item no contrato.</p>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed">
                            <p className="text-gray-400 font-medium">Nenhum item de contrato foi adicionado ao cardápio semanal.</p>
                            <p className="text-xs text-gray-400 mt-1">Vá em "Editar por Dia" para construir seu template.</p>
                        </div>
                    )}
                </div>
            ) : (
            <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className={`${isEditingTemplate ? 'bg-indigo-50' : 'bg-amber-50'} p-4 border-b flex justify-between items-center gap-4`}>
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">
                        {isEditingTemplate ? `Template: ${templateDay}` : `Data: ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                    </h3>
                     {isLoadedFromSaved && !isEditingTemplate && (
                        <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-3 py-1 rounded-full animate-fade-in">
                            Editando Cardápio Salvo
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-3 border text-left w-32">Período</th>
                                <th className="p-3 border text-left">Alimento / Preparação</th>
                                <th className="p-3 border text-left">Item Contratado (p/ Análise)</th>
                                <th className="p-3 border text-center w-28">Peso/Qtd. Unit.</th>
                                <th className="p-3 border text-center w-32">Peso/Qtd. Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentMenu.map((row, idx) => {
                                const unitString = contractItemUnitMap.get(row.contractedItem || '');
                                const unitLabel = getUnitLabel(unitString);
                                return (
                                <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-1 border">
                                        <select
                                            value={row.period || ''}
                                            onChange={(e) => handleInputChange(idx, 'period', e.target.value as MenuRow['period'])}
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium text-xs"
                                        >
                                            <option value="">-- Selecione --</option>
                                            {MEAL_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.foodItem}
                                            onChange={(e) => handleInputChange(idx, 'foodItem', e.target.value)}
                                            placeholder="Ex: Arroz à grega"
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium"
                                        />
                                    </td>
                                     <td className="p-1 border">
                                        <select
                                            value={row.contractedItem || ''}
                                            onChange={(e) => handleInputChange(idx, 'contractedItem', e.target.value)}
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium text-xs"
                                        >
                                            <option value="">-- Selecionar Item --</option>
                                            {availableContractItems.map(item => (
                                                <option key={item} value={item}>{item}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.unitWeight}
                                            onChange={(e) => handleInputChange(idx, 'unitWeight', e.target.value)}
                                            placeholder={`(${unitLabel})`}
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-center font-mono text-gray-600"
                                        />
                                    </td>
                                    <td className="p-1 border bg-gray-50/50">
                                        <input
                                            type="text"
                                            value={row.totalWeight}
                                            readOnly
                                            placeholder="Calculado"
                                            className="w-full p-2 bg-transparent outline-none border-none text-center font-mono font-bold text-amber-700 cursor-default"
                                        />
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
      </div>
      
      {(!isEditingTemplate || templateView === 'day') && (
      <div className="mt-12 pt-8 border-t-2 border-dashed">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight text-center mb-6 uppercase">
              Análise de Fornecedores Disponíveis
          </h3>
          {supplierAnalysis.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supplierAnalysis.map(({ contractedItem, suppliers: foundSuppliers }) => (
                      <div key={contractedItem} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-shadow hover:shadow-md">
                          <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 truncate" title={contractedItem}>{contractedItem}</h4>
                          {foundSuppliers.length > 0 ? (
                              <ul className="mt-2 text-sm space-y-3">
                                  {foundSuppliers.map(s => {
                                      const isWholeNumberUnit = s.displayUnit === 'Dz' || s.displayUnit === 'Un';
                                      const formattingOptions: Intl.NumberFormatOptions = {
                                          minimumFractionDigits: isWholeNumberUnit ? 0 : 2,
                                          maximumFractionDigits: isWholeNumberUnit ? 0 : 2,
                                      };
                                      return (
                                      <li key={s.name} className="flex flex-col gap-1 border-b border-gray-100 last:border-none pb-2">
                                          <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                              <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                              <span>{s.name}</span>
                                          </div>
                                          <div className="pl-6 flex justify-between items-center">
                                              <span className="text-[10px] text-gray-400 uppercase font-black">Saldo Restante:</span>
                                              {s.remainingBalance > 0 ? (
                                                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                      {s.remainingBalance.toLocaleString('pt-BR', formattingOptions)} {s.displayUnit}
                                                  </span>
                                              ) : (
                                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">
                                                      Saldo Esgotado
                                                  </span>
                                              )}
                                          </div>
                                      </li>
                                  )})}
                              </ul>
                          ) : (
                              <p className="mt-2 text-sm text-red-600 font-semibold flex items-center gap-2">
                                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  Nenhum fornecedor contratado para este item.
                              </p>
                          )}
                      </div>
                  ))}
              </div>
          ) : (
              <p className="text-center text-gray-400 italic py-4">Selecione um 'Item Contratado' no cardápio acima para ver a disponibilidade dos fornecedores.</p>
          )}
      </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default AdminStandardMenu;
