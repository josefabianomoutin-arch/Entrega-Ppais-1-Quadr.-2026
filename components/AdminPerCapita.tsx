

import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, PerCapitaConfig, WarehouseMovement, AcquisitionItem } from '../types';
import AdminContractItems from './AdminContractItems';
import AdminAcquisitionItems from './AdminAcquisitionItems';
import AdminPerCapitaSuppliers from './AdminPerCapitaSuppliers';
import type { PerCapitaSupplier } from '../types';

interface AdminPerCapitaProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  perCapitaConfig: PerCapitaConfig;
  onUpdatePerCapitaConfig: (config: PerCapitaConfig) => void;
  onUpdateContractForItem: (itemName: string, assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string, category?: string, comprasCode?: string, becCode?: string }[]) => Promise<{ success: boolean, message: string }>;
  onUpdateAcquisitionItem: (item: AcquisitionItem) => Promise<{ success: boolean, message: string }>;
  onDeleteAcquisitionItem: (id: string) => Promise<{ success: boolean, message: string }>;
  acquisitionItems: AcquisitionItem[];
  onUpdateSupplierObservations?: (cpf: string, observations: string) => Promise<{ success: boolean; message?: string }>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const normalizeItemName = (name: string): string => {
    return (name || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[;,\.\-\/]/g, " ")    // Troca separadores por espaço
        .replace(/\s+/g, " ")           // Remove espaços duplos
        .trim()
        .toUpperCase();
};

const formatContractedTotal = (quantity: number, unitString?: string): string => {
    const [unitType, unitWeightStr] = (unitString || 'kg-1').split('-');
    
    if (['litro', 'embalagem', 'caixa'].some(u => unitType.includes(u))) {
        // For volume, quantity is total Liters
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    
    if (unitType === 'dz') {
        // For dozen, quantity is number of dozens
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Dz`;
    }

    if (unitType === 'un') {
        // For 'un', the quantity stored is already the total weight in kg.
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
    }

    // For everything else (saco, balde, kg, etc.), convert quantity of units to total weight.
    const unitWeight = parseFloat(unitWeightStr) || 1;
    const totalWeight = quantity * unitWeight;
    return `${totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
};

const getContractItemWeight = (item: { totalKg?: number, unit?: string }): number => {
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

const hortifrutiKeywords = [
    'abacate', 'abacaxi', 'abóbora', 'abobrinha', 'acelga', 'agrião', 'alface', 
    'banana', 'batata', 'berinjela', 'beterraba', 'brócolis', 'caqui', 'cará', 
    'cebola', 'cebolinha', 'cenoura', 'chuchu', 'couve', 'escarola', 'espinafre', 
    'goiaba', 'inhame', 'jiló', 'laranja', 'limão', 'maçã', 'mamão', 'mandioca', 
    'manga', 'maracujá', 'melancia', 'melão', 'milho', 'moranga', 'mostarda', 
    'pepino', 'pêra', 'pimentão', 'quiabo', 'rabanete', 'repolho', 'rúcula', 
    'salsa', 'tomate', 'uva', 'vagem'
];

const perishablesKeywords = [
    'carne', 'frango', 'suína', 'peixe', 'bovina', 'almôndega', 'embutido', 
    'linguiça', 'salsicha', 'fígado', 'dobradinha', 'charque', 'costela', 'pé', 
    'toucinho', 'bisteca', 'lombo', 'pernil', 'hambúrguer', 'ovo', 'atum', 'sardinha'
];

const isHortifrutiOrPerishable = (itemName: string): boolean => {
    const lowerItemName = itemName.toLowerCase();
    const allKeywords = [...hortifrutiKeywords, ...perishablesKeywords];
    return allKeywords.some(keyword => lowerItemName.includes(keyword));
};

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const PTRES_OPTIONS = ['380328'] as const;
const PTRES_DESCRIPTIONS: Record<string, string> = {
    '380302': 'Materiais para o Setor de Saúde',
    '380303': 'Recurso para Atender peças e serviços de viaturas',
    '380304': 'Recurso para atender despesas de materiais e serviços administrativos',
    '380308': 'Recurso para atender peças e serviço para manutenção e conservação da Unidade',
    '380328': 'Recurso para Diárias e Outras Despesas'
};

const AdminPerCapita: React.FC<AdminPerCapitaProps> = ({ suppliers, warehouseLog, perCapitaConfig, onUpdatePerCapitaConfig, onUpdateContractForItem, onUpdateAcquisitionItem, onDeleteAcquisitionItem, acquisitionItems, onUpdateSupplierObservations }) => {
    const [activeSubTab, setActiveSubTab] = useState<'CALCULO' | 'KIT PPL' | 'PPAIS' | 'ESTOCÁVEIS' | 'PERECÍVEIS' | 'AUTOMAÇÃO' | 'PRODUTOS DE LIMPEZA' | 'ADIANTAMENTOS' | 'CONTROLE'>('CALCULO');
    const [ppaisSubTab, setPpaisSubTab] = useState<'ITEMS' | 'PRODUCERS'>('ITEMS');
    const [pereciveisSubTab, setPereciveisSubTab] = useState<'ITEMS' | 'SUPPLIERS'>('ITEMS');
    const [staffCount, setStaffCount] = useState<number>(0);
    const [inmateCount, setInmateCount] = useState<number>(0);
    const [customPerCapita, setCustomPerCapita] = useState<Record<string, string>>({});
    const [seiProcessNumbers, setSeiProcessNumbers] = useState<Record<string, string>>({});
    const [seiProcessDefinitions, setSeiProcessDefinitions] = useState<Record<string, string>>({});
    const [monthlyQuota, setMonthlyQuota] = useState<Record<string, number>>({});
    const [monthlyResource, setMonthlyResource] = useState<Record<string, number>>({});
    const [ptresResources, setPtresResources] = useState<Record<string, { pieces: number; services: number }>>({});
    const [ppaisProducers, setPpaisProducers] = useState<PerCapitaSupplier[]>([]);
    const [pereciveisSuppliers, setPereciveisSuppliers] = useState<PerCapitaSupplier[]>([]);
    const [monthlyAdvances, setMonthlyAdvances] = useState<Record<string, number>>({});
    const [showComparison, setShowComparison] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [comparisonFilter, setComparisonFilter] = useState<'TODOS' | 'SEM_ENTREGA' | 'ATENCAO' | 'AVANCADO' | 'CONCLUIDO' | 'COM_EMPENHO'>('TODOS');

    useEffect(() => {
        setStaffCount(perCapitaConfig.staffCount || 0);
        setInmateCount(perCapitaConfig.inmateCount || 0);
        setCustomPerCapita(perCapitaConfig.customValues || {});
        setSeiProcessNumbers(perCapitaConfig.seiProcessNumbers || {});
        setSeiProcessDefinitions(perCapitaConfig.seiProcessDefinitions || {});
        setMonthlyQuota(perCapitaConfig.monthlyQuota || {});
        setMonthlyResource(perCapitaConfig.monthlyResource || {});
        setPtresResources(perCapitaConfig.ptresResources || {});
        setPpaisProducers(perCapitaConfig.ppaisProducers || []);
        setPereciveisSuppliers(perCapitaConfig.pereciveisSuppliers || []);
        setMonthlyAdvances(perCapitaConfig.monthlyAdvances || {});
        setIsDirty(false);
    }, [perCapitaConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        const newConfig: PerCapitaConfig = {
            staffCount,
            inmateCount,
            customValues: customPerCapita,
            seiProcessNumbers,
            seiProcessDefinitions,
            monthlyQuota,
            monthlyResource,
            ptresResources,
            ppaisProducers,
            pereciveisSuppliers,
            monthlyAdvances,
        };
        try {
            await onUpdatePerCapitaConfig(newConfig);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save per capita config:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStaffCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStaffCount(parseInt(e.target.value, 10) || 0);
        setIsDirty(true);
    };

    const handleInmateCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInmateCount(parseInt(e.target.value, 10) || 0);
        setIsDirty(true);
    };

    const handleSeiNumberChange = (category: string, value: string) => {
        setSeiProcessNumbers(prev => ({ ...prev, [category]: value }));
        setIsDirty(true);
    };

    const handleSeiDefinitionChange = (category: string, value: string) => {
        setSeiProcessDefinitions(prev => ({ ...prev, [category]: value }));
        setIsDirty(true);
    };

    const handleMonthlyValueChange = (type: 'quota' | 'resource', month: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        if (type === 'quota') {
            setMonthlyQuota(prev => ({ ...prev, [month]: numValue }));
        } else {
            setMonthlyResource(prev => ({ ...prev, [month]: numValue }));
        }
        setIsDirty(true);
    };

    const handleMonthlyAdvanceChange = (month: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setMonthlyAdvances(prev => ({ ...prev, [month]: numValue }));
        setIsDirty(true);
    };

    const handlePtresValueChange = (ptres: string, nature: 'pieces' | 'services', value: string) => {
        const numValue = parseFloat(value) || 0;
        setPtresResources(prev => ({ 
            ...prev, 
            [ptres]: { 
                ...(prev[ptres] || { pieces: 0, services: 0 }), 
                [nature]: numValue 
            } 
        }));
        setIsDirty(true);
    };

    const handleUpdateProducers = (newProducers: PerCapitaSupplier[]) => {
        setPpaisProducers(newProducers);
        setIsDirty(true);
    };

    const handleUpdatePereciveisSuppliers = (newSuppliers: PerCapitaSupplier[]) => {
        setPereciveisSuppliers(newSuppliers);
        setIsDirty(true);
    };

    const ppaisAsSuppliers = useMemo(() => {
        return ppaisProducers.map(p => ({
            ...p,
            deliveries: [],
            allowedWeeks: [],
            initialValue: (p.contractItems || []).reduce((acc, curr) => acc + (curr.totalKg * (curr.valuePerKg || 0)), 0)
        } as Supplier));
    }, [ppaisProducers]);

    const pereciveisAsSuppliers = useMemo(() => {
        return pereciveisSuppliers.map(p => ({
            ...p,
            deliveries: [],
            allowedWeeks: [],
            initialValue: (p.contractItems || []).reduce((acc, curr) => acc + (curr.totalKg * (curr.valuePerKg || 0)), 0)
        } as Supplier));
    }, [pereciveisSuppliers]);

    const handleUpdateContractForPpais = async (itemName: string, assignments: any[]) => {
        const updatedProducers = ppaisProducers.map(producer => {
            const assignment = assignments.find(a => a.supplierCpf === producer.cpfCnpj);
            const newContractItems = (producer.contractItems || []).filter(ci => ci.name !== itemName);
            if (assignment) {
                newContractItems.push({
                    name: itemName,
                    totalKg: assignment.totalKg,
                    valuePerKg: assignment.valuePerKg,
                    unit: assignment.unit,
                    category: assignment.category,
                    comprasCode: assignment.comprasCode,
                    becCode: assignment.becCode
                });
            }
            return { ...producer, contractItems: newContractItems };
        });
        handleUpdateProducers(updatedProducers);
        return { success: true, message: 'Contratos de produtores atualizados' };
    };

    const handleUpdateContractForPereciveis = async (itemName: string, assignments: any[]) => {
        const updatedSuppliers = pereciveisSuppliers.map(supplier => {
            const assignment = assignments.find(a => a.supplierCpf === supplier.cpfCnpj);
            const newContractItems = (supplier.contractItems || []).filter(ci => ci.name !== itemName);
            if (assignment) {
                newContractItems.push({
                    name: itemName,
                    totalKg: assignment.totalKg,
                    valuePerKg: assignment.valuePerKg,
                    unit: assignment.unit,
                    category: assignment.category,
                    comprasCode: assignment.comprasCode,
                    becCode: assignment.becCode
                });
            }
            return { ...supplier, contractItems: newContractItems };
        });
        handleUpdatePereciveisSuppliers(updatedSuppliers);
        return { success: true, message: 'Contratos de fornecedores atualizados' };
    };

    const allContractItemNames = useMemo(() => {
        const names = new Set<string>();
        suppliers.forEach(s => {
            (s.contractItems || []).forEach(ci => names.add(ci.name));
        });
        return Array.from(names).sort();
    }, [suppliers]);

    const handleCustomPerCapitaChange = (itemName: string, value: string) => {
        setCustomPerCapita(prev => ({
            ...prev,
            [itemName]: value.replace(/[^0-9,]/g, '')
        }));
        setIsDirty(true);
    };

    const itemData = useMemo(() => {
      const data = new Map<string, { totalQuantity: number; totalValue: number; unit: string }>();
      suppliers?.forEach(p => {
        (p.contractItems || []).forEach(item => {
          const current = data.get(item.name) || { totalQuantity: 0, totalValue: 0, unit: item.unit || 'kg-1' };
          
          current.totalQuantity += item.totalKg;

          const itemTotalValue = (item.totalKg || 0) * (item.valuePerKg || 0);
          current.totalValue += itemTotalValue;

          data.set(item.name, current);
        });
      });
      return Array.from(data.entries())
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const filteredItemData = useMemo(() => {
        return itemData.filter(item => isHortifrutiOrPerishable(item.name));
    }, [itemData]);

    const perCapitaDenominator = useMemo(() => {
        return inmateCount + staffCount;
    }, [inmateCount, staffCount]);

    const totalPerCapitaKg = useMemo(() => {
        if (perCapitaDenominator === 0) return 0;
        const totalKgOfAllItems = itemData.reduce((sum, item) => {
            const [unitType] = (item.unit || 'kg-1').split('-');
             if (['litro', 'embalagem', 'caixa', 'dz'].some(u => unitType.includes(u))) {
                return sum;
            }
            const weight = getContractItemWeight({ totalKg: item.totalQuantity, unit: item.unit });
            return sum + weight;
        }, 0);
        return (totalKgOfAllItems / perCapitaDenominator) / 8;
    }, [itemData, perCapitaDenominator]);
    
    const totalPerCapitaValue = useMemo(() => {
        if (perCapitaDenominator === 0) return 0;
        const totalValueOfAllItems = itemData.reduce((sum, item) => sum + item.totalValue, 0);
        return (totalValueOfAllItems / perCapitaDenominator) / 8;
    }, [itemData, perCapitaDenominator]);

    const activeCategories = useMemo(() => {
        return ['PPAIS', 'KIT PPL', 'PERECÍVEIS', 'ESTOCÁVEIS', 'AUTOMAÇÃO', 'PRODUTOS DE LIMPEZA'].filter(cat => {
            return (seiProcessDefinitions[cat] && seiProcessDefinitions[cat].trim() !== '') || 
                   (seiProcessNumbers[cat] && seiProcessNumbers[cat].trim() !== '');
        });
    }, [seiProcessDefinitions, seiProcessNumbers]);

    const monthlyExecution = useMemo(() => {
        const execution: Record<string, Record<string, number>> = {};
        months.forEach(m => {
            execution[m] = {
                'PPAIS': 0,
                'KIT PPL': 0,
                'ESTOCÁVEIS': 0,
                'PERECÍVEIS': 0,
                'AUTOMAÇÃO': 0,
                'PRODUTOS DE LIMPEZA': 0
            };
        });

        const getMonthFromDate = (dateStr?: string) => {
            if (!dateStr) return null;
            const d = new Date(dateStr + 'T12:00:00');
            return months[d.getMonth()];
        };

        // 1. Regular Suppliers
        suppliers.forEach(s => {
            s.deliveries?.forEach(d => {
                const m = getMonthFromDate(d.date);
                if (!m) return;
                
                const normalizedDelItem = normalizeItemName(d.item || '');
                const acqItem = acquisitionItems.find(ai => normalizeItemName(ai.name) === normalizedDelItem);
                
                if (acqItem) {
                    if (execution[m][acqItem.category] !== undefined) {
                        execution[m][acqItem.category] += d.value || 0;
                    }
                } else {
                    const contractItem = s.contractItems?.find(ci => normalizeItemName(ci.name) === normalizedDelItem);
                    if (contractItem && contractItem.category && contractItem.category !== 'OUTROS') {
                        if (execution[m][contractItem.category] !== undefined) {
                            execution[m][contractItem.category] += d.value || 0;
                        }
                    }
                }
            });
        });

        // 2. PPAIS Producers
        ppaisProducers.forEach(p => {
            p.deliveries?.forEach(d => {
                const m = getMonthFromDate(d.date);
                if (m) execution[m]['PPAIS'] += d.value || 0;
            });
        });

        // 3. Pereciveis Suppliers
        pereciveisSuppliers.forEach(p => {
            p.deliveries?.forEach(d => {
                const m = getMonthFromDate(d.date);
                if (m) execution[m]['PERECÍVEIS'] += d.value || 0;
            });
        });

        return execution;
    }, [suppliers, ppaisProducers, pereciveisSuppliers, acquisitionItems]);

    const categoryMonthlyAverages = useMemo(() => {
        const averages: Record<string, number> = {};
        activeCategories.forEach(cat => {
            const items = acquisitionItems.filter(item => item.category === cat);
            const total = items.reduce((sum, item) => {
                const quantity = cat === 'PPAIS' ? item.acquiredQuantity : item.stockBalance;
                return sum + ((item.unitValue || 0) * quantity);
            }, 0);
            averages[cat] = total / 8; // Maio-Dez / 8 meses
        });
        return averages;
    }, [activeCategories, acquisitionItems]);

    const totalContractValue = useMemo(() => {
        const targetCategories = ['PPAIS', 'ESTOCÁVEIS', 'PERECÍVEIS'];
        let total = 0;
        
        targetCategories.forEach(cat => {
            months.forEach(month => {
                const execVal = monthlyExecution[month]?.[cat] || 0;
                const isActiveMonth = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].includes(month);
                const futureVal = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                total += execVal > 0 ? execVal : futureVal;
            });
        });
        
        return total;
    }, [monthlyExecution, categoryMonthlyAverages]);

    const contractedItemsSummary = useMemo(() => {
        const summary = new Map<string, { contracted: number; received: number; remaining: number; unit: string; originalName: string; suppliers: Set<string>; empenhos: Set<string> }>();

        suppliers?.forEach(supplier => {
            supplier.contractItems?.forEach(item => {
                const normalizedName = normalizeItemName(item.name);
                if (!summary.has(normalizedName)) {
                    summary.set(normalizedName, { contracted: 0, received: 0, remaining: 0, unit: item.unit || 'KG', originalName: item.name, suppliers: new Set(), empenhos: new Set() });
                }
                const data = summary.get(normalizedName)!;
                data.contracted += item.totalKg || 0;
                data.suppliers.add(supplier.name);
                summary.set(normalizedName, data);
            });

            supplier.deliveries?.forEach(delivery => {
                const normalizedName = normalizeItemName(delivery.item || '');
                if (normalizedName && summary.has(normalizedName)) {
                    const data = summary.get(normalizedName)!;
                    data.received += delivery.kg || 0;
                    if (delivery.receiptTermNumber) {
                        data.empenhos.add(delivery.receiptTermNumber);
                    }
                    summary.set(normalizedName, data);
                }
            });
        });

        const result = Array.from(summary.entries()).map(([name, data]) => {
            const percentage = data.contracted > 0 ? (data.received / data.contracted) * 100 : 0;
            let status = 'NORMAL';
            if (data.received === 0) status = 'SEM_ENTREGA';
            else if (percentage >= 100) status = 'CONCLUIDO';
            else if (percentage >= 70) status = 'AVANCADO';
            else if (percentage < 50) status = 'ATENCAO';

            return {
                name: data.originalName,
                contracted: data.contracted,
                received: data.received,
                remaining: Math.max(0, data.contracted - data.received),
                unit: data.unit,
                percentage,
                status,
                suppliers: Array.from(data.suppliers),
                empenhos: Array.from(data.empenhos),
                hasEmpenho: data.empenhos.size > 0
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return result;
    }, [suppliers]);

    const filteredComparison = useMemo(() => {
        if (comparisonFilter === 'TODOS') return contractedItemsSummary;
        if (comparisonFilter === 'SEM_ENTREGA') return contractedItemsSummary.filter(i => i.status === 'SEM_ENTREGA');
        if (comparisonFilter === 'ATENCAO') return contractedItemsSummary.filter(i => i.status === 'ATENCAO');
        if (comparisonFilter === 'AVANCADO') return contractedItemsSummary.filter(i => i.status === 'AVANCADO');
        if (comparisonFilter === 'CONCLUIDO') return contractedItemsSummary.filter(i => i.status === 'CONCLUIDO');
        if (comparisonFilter === 'COM_EMPENHO') return contractedItemsSummary.filter(i => i.hasEmpenho);
        return contractedItemsSummary;
    }, [contractedItemsSummary, comparisonFilter]);

    const suppliersWithoutEmpenho = useMemo(() => {
        if (!suppliers) return [];
        return suppliers.filter(supplier => {
            const hasEmpenho = supplier.deliveries?.some(d => !!d.receiptTermNumber);
            return !hasEmpenho;
        }).map(supplier => {
            const totalWeight = supplier.contractItems?.reduce((acc, item) => acc + (item.totalKg || 0), 0) || 0;
            const totalValue = supplier.contractItems?.reduce((acc, item) => acc + ((item.totalKg || 0) * (item.valuePerKg || 0)), 0) || 0;
            const items = supplier.contractItems?.map(item => ({
                name: item.name,
                contracted: item.totalKg || 0,
                unit: item.unit || 'KG',
                value: (item.totalKg || 0) * (item.valuePerKg || 0)
            })) || [];

            return {
                name: supplier.name,
                document: supplier.cpf,
                totalWeight,
                totalValue,
                items,
                observations: supplier.observations || ''
            };
        }).filter(s => s.totalWeight > 0 || s.totalValue > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-green-500 animate-fade-in relative">
            
            {(isDirty || saveSuccess) && (
                <div className="sticky top-0 z-10 mb-6 -mx-6 -mt-6">
                    {saveSuccess && (
                        <div className="p-4 bg-green-100 border-b border-green-300 text-center font-semibold text-green-800 shadow-sm animate-fade-in">
                            Dados salvos com sucesso na nuvem!
                        </div>
                    )}
                    {isDirty && (
                        <div className="p-4 bg-yellow-100 border-b border-yellow-300 rounded-t-2xl flex justify-between items-center shadow-sm animate-fade-in">
                            <p className="font-semibold text-yellow-800">Você tem alterações não salvas.</p>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-8 border-b pb-4">
                <button 
                    onClick={() => setActiveSubTab('CALCULO')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'CALCULO' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Cálculo Geral
                </button>
                <button 
                    onClick={() => setActiveSubTab('KIT PPL')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'KIT PPL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    KIT PPL - HIGIÊNE E VESTUÁRIO
                </button>
                <button 
                    onClick={() => setActiveSubTab('PPAIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'PPAIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    PPAIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('ESTOCÁVEIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'ESTOCÁVEIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    ESTOCÁVEIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('PERECÍVEIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'PERECÍVEIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    PERECÍVEIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('AUTOMAÇÃO')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'AUTOMAÇÃO' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    AUTOMAÇÃO
                </button>
                <button 
                    onClick={() => setActiveSubTab('PRODUTOS DE LIMPEZA')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'PRODUTOS DE LIMPEZA' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    PRODUTOS DE LIMPEZA
                </button>
                <button 
                    onClick={() => setActiveSubTab('ADIANTAMENTOS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'ADIANTAMENTOS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    ADIANTAMENTOS
                </button>
                <button 
                    onClick={() => setActiveSubTab('CONTROLE')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'CONTROLE' ? 'bg-indigo-900 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Controle de Recursos
                </button>
            </div>

            {activeSubTab === 'ADIANTAMENTOS' ? (
                <div className="animate-fade-in space-y-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tighter italic">Adiantamentos Mensais</h2>
                        <p className="text-gray-400 font-medium">Lançamento de valores de adiantamento para cada mês do ano.</p>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {months.map(month => (
                                <div key={`advance-${month}`} className="space-y-2">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">{month}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-300">R$</span>
                                        <input 
                                            type="number"
                                            value={monthlyAdvances[month] || ''}
                                            onChange={(e) => handleMonthlyAdvanceChange(month, e.target.value)}
                                            placeholder="0,00" 
                                            className="w-full p-3 pl-9 bg-gray-50 border-2 border-gray-100 rounded-xl font-mono text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : activeSubTab === 'CONTROLE' ? (
                <div className="animate-fade-in space-y-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tighter">Controle de Execução de Recursos Mensais</h2>
                        <p className="text-gray-400 font-medium">Acompanhamento dos gastos por categoria em relação à cota mensal disponível.</p>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-2xl shadow-xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-indigo-950 text-white text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="p-4 text-left">Mês</th>
                                    <th className="p-4 text-right bg-indigo-900">Cota Mensal</th>
                                    {activeCategories.map(cat => (
                                        <th key={`exec-${cat}`} className="p-4 text-right">{cat}</th>
                                    ))}
                                    <th className="p-4 text-right bg-indigo-700">Adiantamentos</th>
                                    <th className="p-4 text-right bg-indigo-800">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {months.map(month => {
                                    const quota = monthlyQuota[month] || 0;
                                    const exec = monthlyExecution[month];
                                    const advance = monthlyAdvances[month] || 0;
                                    const isActiveMonth = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].includes(month);
                                    
                                    const totalSpent = activeCategories.reduce((sum, cat) => {
                                        const value = exec[cat] || 0;
                                        const futureValue = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                                        return sum + (value > 0 ? value : futureValue);
                                    }, 0) + advance;
                                    
                                    const balance = quota - totalSpent;

                                    return (
                                        <tr key={month} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-black text-gray-700 uppercase">{month}</td>
                                            <td className="p-4 text-right font-mono font-bold text-indigo-600 bg-indigo-50/30">{formatCurrency(quota)}</td>
                                            {activeCategories.map(cat => {
                                                const value = exec[cat] || 0;
                                                const futureValue = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                                                const displayValue = value > 0 ? value : futureValue;
                                                const isFuture = value === 0 && futureValue > 0;
                                                
                                                return (
                                                    <td key={`exec-${cat}`} className={`p-4 text-right font-mono ${isFuture ? 'text-blue-600 font-bold bg-blue-50/30' : 'text-indigo-600'}`}>
                                                        {formatCurrency(displayValue)}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-4 text-right font-mono text-indigo-700 bg-indigo-50/20 font-bold">
                                                {formatCurrency(advance)}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-black bg-indigo-50/50 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(balance)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-100 font-black text-gray-800">
                                <tr>
                                    <td className="p-4 uppercase">Totais Anuais</td>
                                    <td className="p-4 text-right font-mono">
                                        {formatCurrency((Object.values(monthlyQuota) as number[]).reduce((a: number, b: number) => a + (b || 0), 0))}
                                    </td>
                                    {activeCategories.map(cat => {
                                        let catTotal = 0;
                                        months.forEach(month => {
                                            const execVal = monthlyExecution[month]?.[cat] || 0;
                                            const isActiveMonth = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].includes(month);
                                            const futureVal = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                                            catTotal += execVal > 0 ? execVal : futureVal;
                                        });
                                        return (
                                            <th key={`exec-${cat}`} className="p-4 text-right font-mono">
                                                {formatCurrency(catTotal)}
                                            </th>
                                        );
                                    })}
                                    <th className="p-4 text-right font-mono bg-indigo-700 text-white">
                                        {formatCurrency((Object.values(monthlyAdvances) as number[]).reduce((a: number, b: number) => a + (b || 0), 0))}
                                    </th>
                                    <th className="p-4 text-right font-mono bg-indigo-900 text-white">
                                        {formatCurrency(
                                            (Object.values(monthlyQuota) as number[]).reduce((a: number, b: number) => a + (b || 0), 0) - 
                                            (activeCategories.reduce((sum, cat) => {
                                                let catTotal = 0;
                                                months.forEach(month => {
                                                    const execVal = monthlyExecution[month]?.[cat] || 0;
                                                    const isActiveMonth = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].includes(month);
                                                    const futureVal = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                                                    catTotal += execVal > 0 ? execVal : futureVal;
                                                });
                                                return sum + catTotal;
                                            }, 0) + (Object.values(monthlyAdvances) as number[]).reduce((a: number, b: number) => a + (b || 0), 0))
                                        )}
                                    </th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border-l-8 border-indigo-600">
                            <h3 className="text-lg font-black text-gray-800 uppercase mb-4">Resumo de Categorias</h3>
                            <div className="space-y-3">
                                {activeCategories.map(cat => {
                                    const total = (Object.values(monthlyExecution) as Record<string, number>[]).reduce((acc: number, curr: Record<string, number>) => acc + (curr[cat] || 0), 0);
                                    if (total === 0) return null;
                                    return (
                                        <div key={cat} className="flex justify-between items-center border-b pb-2">
                                            <span className="text-xs font-bold text-gray-500 uppercase">{cat}</span>
                                            <span className="font-mono font-bold text-gray-800">{formatCurrency(total)}</span>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-center pt-4 border-t-2 border-indigo-100">
                                    <span className="text-sm font-black text-indigo-900 uppercase">Total Geral Gasto</span>
                                    <span className="font-mono font-black text-xl text-indigo-700">
                                        {formatCurrency(
                                            activeCategories.reduce((sum, cat) => {
                                                let catTotal = 0;
                                                months.forEach(month => {
                                                    const execVal = monthlyExecution[month]?.[cat] || 0;
                                                    const isActiveMonth = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].includes(month);
                                                    const futureVal = isActiveMonth ? (categoryMonthlyAverages[cat] || 0) : 0;
                                                    catTotal += execVal > 0 ? execVal : futureVal;
                                                });
                                                return sum + catTotal;
                                            }, 0) + (Object.values(monthlyAdvances) as number[]).reduce((a: number, b: number) => a + (b || 0), 0)
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-lg border-l-8 border-emerald-600">
                            <h3 className="text-lg font-black text-gray-800 uppercase mb-4">Informação de Apoio</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Este painel consolida todos os lançamentos de Notas Fiscais (Entradas) realizados no sistema, categorizando-os automaticamente para debitar da cota mensal planejada no Cálculo Geral.
                            </p>
                            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <p className="text-xs font-bold text-emerald-700 uppercase">Dica de Gestão</p>
                                <p className="text-[10px] text-emerald-600 mt-1">
                                    Mantenha os lançamentos de NF atualizados para que o saldo mensal reflita a realidade financeira de cada processo. Apenas categorias com Processo SEI ou Definição preenchidos são contabilizadas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeSubTab === 'CALCULO' ? (
                <>
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-green-900 uppercase tracking-tighter">Cálculo de Consumo Per Capita</h2>
                <p className="text-gray-400 font-medium">Estime o consumo mensal por pessoa com base nos totais contratados.</p>
                <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200 inline-block">
                    <p className="text-sm font-mono text-gray-600">
                        Fórmula: (Total / (Pop. Carcerária + Servidores)) / 8
                    </p>
                </div>
            </div>

            <div className="bg-green-50/30 p-4 md:p-8 rounded-[2rem] border-2 border-green-100 shadow-sm mb-10 space-y-10">
                <div className="space-y-8">
                    <div className="flex items-center gap-3 border-b-2 border-green-200 pb-4">
                        <div className="p-3 bg-green-100 rounded-2xl text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-green-900 uppercase tracking-tighter italic">Cota Disponível por Mês</h3>
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Planejamento de Consumo Mensal</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {months.map(month => (
                            <div key={month} className="space-y-1">
                                <label className="text-[9px] font-black text-green-600 uppercase tracking-tighter ml-1">{month}</label>
                                <input 
                                    type="number"
                                    value={monthlyQuota[month] || ''}
                                    onChange={(e) => handleMonthlyValueChange('quota', month, e.target.value)}
                                    placeholder="0" 
                                    className="w-full p-2 bg-white border border-green-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-green-400 outline-none transition-all"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8 pt-10 border-t-2 border-green-200/50">
                    <div className="flex items-center gap-3 border-b-2 border-green-200 pb-4">
                        <div className="p-3 bg-green-100 rounded-2xl text-green-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-green-900 uppercase tracking-tighter italic">Recurso Disponível</h3>
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Teto Orçamentário por PTRES (Atualização Diária)</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {PTRES_OPTIONS.map(ptres => (
                            <div key={ptres} className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-all space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="bg-green-700 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">PTRES {ptres}</span>
                                </div>
                                <p className="text-[10px] font-black text-green-800 uppercase italic leading-tight min-h-[2.5em]">{PTRES_DESCRIPTIONS[ptres]}</p>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-green-600 uppercase tracking-tighter ml-1">339030 - Peças</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-green-400">R$</span>
                                            <input 
                                                type="number"
                                                value={ptresResources[ptres]?.pieces || ''}
                                                onChange={(e) => handlePtresValueChange(ptres, 'pieces', e.target.value)}
                                                placeholder="0,00" 
                                                className="w-full p-2.5 pl-9 bg-green-50/50 border border-green-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-green-400 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-green-600 uppercase tracking-tighter ml-1">339039 - Serviço</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-green-400">R$</span>
                                            <input 
                                                type="number"
                                                value={ptresResources[ptres]?.services || ''}
                                                onChange={(e) => handlePtresValueChange(ptres, 'services', e.target.value)}
                                                placeholder="0,00" 
                                                className="w-full p-2.5 pl-9 bg-green-50/50 border border-green-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-green-400 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">População Carcerária</label>
                    <input 
                        type="number"
                        value={inmateCount || ''}
                        onChange={handleInmateCountChange}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total de Servidores</label>
                     <input 
                        type="number"
                        value={staffCount || ''}
                        onChange={handleStaffCountChange}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                 <div className="bg-gray-50/50 p-4 rounded-xl text-center flex flex-col justify-center border">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter mb-1">Valor Total Contratado</p>
                    <p className="text-2xl font-black text-gray-700">{formatCurrency(totalContractValue)}</p>
                </div>
                 <div className="bg-blue-50/50 p-4 rounded-xl text-center flex flex-col justify-center border">
                    <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Total de Consumidores (Base)</p>
                    <p className="text-2xl font-black text-blue-700">{perCapitaDenominator.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</p>
                </div>
                <div className="bg-green-50/50 p-4 rounded-xl text-center flex flex-col justify-center border border-green-200">
                    <p className="text-[10px] text-green-600 uppercase font-black tracking-tighter mb-1">Total Per Capita (Kg)</p>
                    <p className="text-2xl font-black text-green-700">
                        {totalPerCapitaKg.toFixed(4).replace('.', ',')}
                        <span className="text-base font-medium ml-1">Kg</span>
                    </p>
                </div>
                 <div className="bg-blue-50/50 p-4 rounded-xl text-center flex flex-col justify-center border border-blue-200">
                    <p className="text-[10px] text-blue-600 uppercase font-black tracking-tighter mb-1">Total Per Capita (R$)</p>
                    <p className="text-2xl font-black text-blue-700">
                        {formatCurrency(totalPerCapitaValue)}
                    </p>
                </div>
            </div>

             <div className="text-center my-10 border-t pt-10">
                <button 
                    onClick={() => setShowComparison(!showComparison)}
                    className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
                >
                    {showComparison ? 'Ocultar Comparativo' : 'Exibir Comparativo de Contrato'}
                </button>
            </div>

            {showComparison && (
                <div className="mt-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black text-gray-800 text-center uppercase tracking-tighter flex-1">
                            Comparativo Resumido dos Itens Adquiridos no Contrato
                        </h3>
                        <button 
                            onClick={() => {
                                const printWindow = window.open('', '_blank');
                                if (!printWindow) {
                                    alert('Por favor, permita popups para imprimir.');
                                    return;
                                }
                                const htmlContent = `
                                    <html>
                                    <head>
                                        <title>Comparativo Resumido dos Itens Adquiridos no Contrato</title>
                                        <style>
                                            @page { size: A4 portrait; margin: 10mm; }
                                            body { font-family: Arial, sans-serif; font-size: 10px; }
                                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                                            th { background-color: #f3f4f6; text-transform: uppercase; font-size: 9px; }
                                            .text-center { text-align: center; }
                                            .text-right { text-align: right; }
                                            h2 { text-align: center; text-transform: uppercase; margin-bottom: 5px; }
                                            .header-info { text-align: center; color: #666; margin-bottom: 20px; font-size: 11px; }
                                        </style>
                                    </head>
                                    <body>
                                        <h2>Comparativo Resumido dos Itens Adquiridos no Contrato</h2>
                                        <div class="header-info">Data de emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th class="text-center">#</th>
                                                    <th>Item</th>
                                                    <th class="text-center">Qtd. Contratada</th>
                                                    <th class="text-center">Qtd. Recebida</th>
                                                    <th class="text-center">Restam Entregar</th>
                                                    <th class="text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${filteredComparison.map((item, index) => {
                                                    const statusText = item.status === 'SEM_ENTREGA' ? 'SEM ENTREGA' : item.status === 'ATENCAO' ? 'ATENÇÃO (< 50%)' : item.status === 'AVANCADO' ? 'AVANÇADO (≥ 70%)' : item.status === 'CONCLUIDO' ? 'CONCLUÍDO (100%)' : 'NORMAL';
                                                    const empenhoText = item.empenhos.length > 0 ? ` <span style="font-size: 10px; color: #666; background: #eee; padding: 2px 4px; border-radius: 4px;">Empenho: ${item.empenhos.join(', ')}</span>` : '';
                                                    const supplierText = item.suppliers.length > 0 ? `<div style="font-size: 10px; color: #888; margin-top: 2px;">${item.suppliers.join(', ')}</div>` : '';
                                                    return `
                                                        <tr>
                                                            <td class="text-center">${index + 1}</td>
                                                            <td>${item.name}${empenhoText}${supplierText}</td>
                                                            <td class="text-center">${item.contracted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.unit}</td>
                                                            <td class="text-center">${item.received.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.unit}</td>
                                                            <td class="text-center">${item.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.unit}</td>
                                                            <td class="text-center">${statusText} (${item.percentage.toFixed(0)}%)</td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                        <script>
                                            window.onload = () => {
                                                window.print();
                                            };
                                        </script>
                                    </body>
                                    </html>
                                `;
                                printWindow.document.write(htmlContent);
                                printWindow.document.close();
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-3 px-6 rounded-xl shadow-sm transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Imprimir PDF
                        </button>
                    </div>
                    <div className="border rounded-lg flex flex-col">
                        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 border-b">
                            <button onClick={() => setComparisonFilter('TODOS')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${comparisonFilter === 'TODOS' ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-100'}`}>Todos</button>
                            <button onClick={() => setComparisonFilter('SEM_ENTREGA')} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${comparisonFilter === 'SEM_ENTREGA' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-current"></span> Sem Entrega (0%)
                            </button>
                            <button onClick={() => setComparisonFilter('ATENCAO')} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${comparisonFilter === 'ATENCAO' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-current"></span> Atenção (&lt; 50%)
                            </button>
                            <button onClick={() => setComparisonFilter('AVANCADO')} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${comparisonFilter === 'AVANCADO' ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-current"></span> Avançado (≥ 70%)
                            </button>
                            <button onClick={() => setComparisonFilter('CONCLUIDO')} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${comparisonFilter === 'CONCLUIDO' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-600 border border-green-200 hover:bg-green-50'}`}>
                                <span className="w-2 h-2 rounded-full bg-current"></span> Concluído (100%)
                            </button>
                            <button onClick={() => setComparisonFilter('COM_EMPENHO')} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${comparisonFilter === 'COM_EMPENHO' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Com Empenho
                            </button>
                        </div>
                        <div 
                            className="overflow-x-auto custom-scrollbar"
                            onScroll={(e) => {
                                const bottomScroll = document.getElementById('comparison-bottom-scroll');
                                if (bottomScroll) bottomScroll.scrollLeft = e.currentTarget.scrollLeft;
                            }}
                        >
                            <div id="comparison-top-dummy" style={{ height: '1px' }}></div>
                        </div>
                        <div 
                            id="comparison-bottom-scroll"
                            className="overflow-x-auto custom-scrollbar"
                            onScroll={(e) => {
                                const topScroll = e.currentTarget.previousElementSibling;
                                if (topScroll) topScroll.scrollLeft = e.currentTarget.scrollLeft;
                            }}
                        >
                            <table 
                                className="w-full text-sm"
                                ref={(el) => {
                                    if (el) {
                                        const dummy = document.getElementById('comparison-top-dummy');
                                        if (dummy) dummy.style.width = `${el.offsetWidth}px`;
                                    }
                                }}
                            >
                                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                    <tr>
                                        <th className="p-3 text-center">#</th>
                                        <th className="p-3 text-left">Item</th>
                                        <th className="p-3 text-center">Qtd. Contratada</th>
                                        <th className="p-3 text-center">Qtd. Recebida</th>
                                        <th className="p-3 text-center">Restam Entregar</th>
                                        <th className="p-3 text-center w-32">Progresso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredComparison.map((item, index) => {
                                        return (
                                            <tr key={item.name} className="hover:bg-gray-50">
                                                <td className="p-3 text-center font-mono text-gray-500">{index + 1}</td>
                                                <td className="p-3 font-semibold text-gray-800">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span>{item.name}</span>
                                                            {item.empenhos.length > 0 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                                    Empenho: {item.empenhos.join(', ')}
                                                                </span>
                                                            )}
                                                            {item.status === 'SEM_ENTREGA' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">SEM ENTREGA</span>}
                                                            {item.status === 'ATENCAO' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">ATENÇÃO</span>}
                                                            {item.status === 'AVANCADO' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">AVANÇADO</span>}
                                                            {item.status === 'CONCLUIDO' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">CONCLUÍDO</span>}
                                                        </div>
                                                        {item.suppliers.length > 0 && (
                                                            <span className="text-[10px] font-normal text-gray-400 mt-0.5">
                                                                {item.suppliers.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-mono text-gray-500">{item.contracted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unit}</td>
                                                <td className="p-3 text-center font-mono text-gray-500">{item.received.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unit}</td>
                                                <td className="p-3 text-center font-mono font-bold text-blue-600">
                                                    {item.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unit}
                                                </td>
                                                <td className="p-3 w-32">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${item.status === 'SEM_ENTREGA' ? 'bg-red-500' : item.status === 'ATENCAO' ? 'bg-orange-500' : item.status === 'AVANCADO' ? 'bg-blue-500' : item.status === 'CONCLUIDO' ? 'bg-green-500' : 'bg-blue-400'}`} 
                                                                style={{ width: `${Math.min(100, item.percentage)}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-gray-500 w-8 text-right">{item.percentage.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {suppliersWithoutEmpenho.length > 0 && (
                        <div className="mt-12 animate-fade-in">
                            <h3 className="text-xl font-black text-red-800 text-center uppercase tracking-tighter mb-6 flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                Empresas que faltam emitir o empenho
                            </h3>
                            <div className="border border-red-100 rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-red-50 text-xs uppercase text-red-800">
                                        <tr>
                                            <th className="p-3 text-left">Empresa</th>
                                            <th className="p-3 text-center">CNPJ/CPF</th>
                                            <th className="p-3 text-center">Peso a Empenhar</th>
                                            <th className="p-3 text-center">Valor a Empenhar</th>
                                            <th className="p-3 text-left">Observações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-50 bg-white">
                                        {suppliersWithoutEmpenho.map((supplier, index) => (
                                            <React.Fragment key={supplier.document}>
                                                <tr className="hover:bg-red-50/50 transition-colors">
                                                    <td className="p-3 font-semibold text-gray-800">
                                                        {supplier.name}
                                                        {supplier.items.length > 0 && (
                                                            <div className="mt-2 pl-4 border-l-2 border-red-100 space-y-1">
                                                                {supplier.items.map((item, idx) => (
                                                                    <div key={idx} className="text-[10px] text-gray-500 flex justify-between items-center max-w-sm">
                                                                        <span className="truncate pr-2" title={item.name}>• {item.name}</span>
                                                                        <span className="font-mono text-gray-400 whitespace-nowrap">
                                                                            {item.contracted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unit} - {formatCurrency(item.value)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center font-mono text-gray-500 align-top">{supplier.document}</td>
                                                    <td className="p-3 text-center font-mono text-gray-600 align-top">{supplier.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG</td>
                                                    <td className="p-3 text-center font-mono font-bold text-red-600 align-top">{formatCurrency(supplier.totalValue)}</td>
                                                    <td className="p-3 align-top">
                                                        <textarea 
                                                            className="w-full p-2 text-[10px] border border-gray-200 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                                                            rows={2}
                                                            placeholder="Adicionar observação..."
                                                            defaultValue={supplier.observations}
                                                            onBlur={(e) => {
                                                                if (onUpdateSupplierObservations && e.target.value !== supplier.observations) {
                                                                    onUpdateSupplierObservations(supplier.document, e.target.value);
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-red-50 font-bold text-red-900">
                                        <tr>
                                            <td colSpan={2} className="p-3 text-right uppercase text-xs tracking-wider">Total a Empenhar:</td>
                                            <td className="p-3 text-center font-mono">{suppliersWithoutEmpenho.reduce((acc, s) => acc + s.totalWeight, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG</td>
                                            <td className="p-3 text-center font-mono">{formatCurrency(suppliersWithoutEmpenho.reduce((acc, s) => acc + s.totalValue, 0))}</td>
                                            <td className="p-3"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

                </>
            ) : (
                <div className="animate-fade-in">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tighter">
                            {activeSubTab === 'KIT PPL' ? 'KIT PPL - HIGIÊNE E VESTUÁRIO' : activeSubTab}
                        </h2>
                        <p className="text-gray-400 font-medium">Levantamento de informações iniciais para gestão de itens.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Número do Processo SEI</label>
                            <input 
                                type="text"
                                value={seiProcessNumbers[activeSubTab] || ''}
                                onChange={(e) => handleSeiNumberChange(activeSubTab, e.target.value)}
                                placeholder="Ex: 00000.000000/0000-00" 
                                className="input-field font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Definição do Processo</label>
                            <input 
                                type="text"
                                value={seiProcessDefinitions[activeSubTab] || ''}
                                onChange={(e) => handleSeiDefinitionChange(activeSubTab, e.target.value)}
                                placeholder="Ex: Aquisição de gêneros alimentícios..." 
                                className="input-field text-sm"
                            />
                        </div>
                    </div>

                    {activeSubTab === 'PPAIS' && (
                        <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                            <button 
                                onClick={() => setPpaisSubTab('ITEMS')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ppaisSubTab === 'ITEMS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Itens de Aquisição
                            </button>
                            <button 
                                onClick={() => setPpaisSubTab('PRODUCERS')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ppaisSubTab === 'PRODUCERS' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Cadastro de Produtores
                            </button>
                        </div>
                    )}

                    {activeSubTab === 'PERECÍVEIS' && (
                        <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                            <button 
                                onClick={() => setPereciveisSubTab('ITEMS')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pereciveisSubTab === 'ITEMS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Itens de Aquisição
                            </button>
                            <button 
                                onClick={() => setPereciveisSubTab('SUPPLIERS')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pereciveisSubTab === 'SUPPLIERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Cadastro de Fornecedores
                            </button>
                        </div>
                    )}

                    {activeSubTab === 'PPAIS' && ppaisSubTab === 'PRODUCERS' ? (
                        <AdminPerCapitaSuppliers 
                            suppliers={ppaisProducers}
                            onUpdate={handleUpdateProducers}
                            type="PRODUTOR"
                            colorScheme="emerald"
                        />
                    ) : activeSubTab === 'PERECÍVEIS' && pereciveisSubTab === 'SUPPLIERS' ? (
                        <AdminPerCapitaSuppliers 
                            suppliers={pereciveisSuppliers}
                            onUpdate={handleUpdatePereciveisSuppliers}
                            type="FORNECEDOR"
                            colorScheme="indigo"
                        />
                    ) : (
                        <AdminAcquisitionItems 
                            category={activeSubTab} 
                            items={acquisitionItems} 
                            onUpdate={onUpdateAcquisitionItem} 
                            onDelete={onDeleteAcquisitionItem} 
                            contractItems={allContractItemNames}
                            suppliers={
                                activeSubTab === 'PPAIS' ? ppaisAsSuppliers : 
                                activeSubTab === 'PERECÍVEIS' ? pereciveisAsSuppliers : 
                                suppliers
                            }
                            onUpdateContractForItem={
                                activeSubTab === 'PPAIS' ? handleUpdateContractForPpais : 
                                activeSubTab === 'PERECÍVEIS' ? handleUpdateContractForPereciveis : 
                                onUpdateContractForItem
                            }
                        />
                    )}
                </div>
            )}


            <style>{`
                .input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 1rem; border: 2px solid #F3F4F6; border-radius: 1rem; background-color: #fff; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); } 
                .input-field:focus { border-color: #10B981; background-color: #fff; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.15); }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminPerCapita;