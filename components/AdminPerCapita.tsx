import React, { useState, useMemo } from 'react';
import type { Producer } from '../types';

interface AdminPerCapitaProps {
  producers: Producer[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const AdminPerCapita: React.FC<AdminPerCapitaProps> = ({ producers }) => {
    const [staffCount, setStaffCount] = useState<number>(0);
    const [inmateCount, setInmateCount] = useState<number>(0);
    
    // Agrega o total de Kg e o valor total para cada item de todos os contratos
    const itemData = useMemo(() => {
      const data = new Map<string, { totalKg: number; totalValue: number }>();
      producers.forEach(p => {
        (p.contractItems || []).forEach(item => {
          const current = data.get(item.name) || { totalKg: 0, totalValue: 0 };
          current.totalKg += item.totalKg;
          current.totalValue += item.totalKg * item.valuePerKg;
          data.set(item.name, current);
        });
      });
      return Array.from(data.entries())
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [producers]);

    // Calcula o denominador da fórmula per capta
    const perCapitaDenominator = useMemo(() => {
        return inmateCount + (staffCount / 3);
    }, [inmateCount, staffCount]);

    // Calcula o valor total do per capta em KG
    const totalPerCaptaKg = useMemo(() => {
        if (perCapitaDenominator === 0) {
            return 0;
        }
        const totalKgOfAllItems = itemData.reduce((sum, item) => sum + item.totalKg, 0);
        return (totalKgOfAllItems / perCapitaDenominator) / 4;
    }, [itemData, perCapitaDenominator]);
    
    // Calcula o valor total do per capta em R$
    const totalPerCaptaValue = useMemo(() => {
        if (perCapitaDenominator === 0) {
            return 0;
        }
        const totalValueOfAllItems = itemData.reduce((sum, item) => sum + item.totalValue, 0);
        return (totalValueOfAllItems / perCapitaDenominator) / 4;
    }, [itemData, perCapitaDenominator]);

    // Calcula o valor total de todos os contratos
    const totalContractValue = useMemo(() => {
        return itemData.reduce((sum, item) => sum + item.totalValue, 0);
    }, [itemData]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-green-500 animate-fade-in">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-green-900 uppercase tracking-tighter">Cálculo de Consumo Per Capta</h2>
                <p className="text-gray-400 font-medium">Estime o consumo mensal por pessoa com base nos totais contratados.</p>
                <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200 inline-block">
                    <p className="text-sm font-mono text-gray-600">
                        Fórmula: (Total / (Pop. Carcerária + (Servidores / 3))) / 4
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">População Carcerária</label>
                    <input 
                        type="number"
                        value={inmateCount || ''}
                        onChange={(e) => setInmateCount(parseInt(e.target.value, 10) || 0)}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total de Servidores</label>
                     <input 
                        type="number"
                        value={staffCount || ''}
                        onChange={(e) => setStaffCount(parseInt(e.target.value, 10) || 0)}
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
                    <p className="text-[10px] text-green-600 uppercase font-black tracking-tighter mb-1">Total Per Capta (Kg)</p>
                    <p className="text-2xl font-black text-green-700">
                        {totalPerCaptaKg.toFixed(4).replace('.', ',')}
                        <span className="text-base font-medium ml-1">Kg</span>
                    </p>
                </div>
                 <div className="bg-blue-50/50 p-4 rounded-xl text-center flex flex-col justify-center border border-blue-200">
                    <p className="text-[10px] text-blue-600 uppercase font-black tracking-tighter mb-1">Total Per Capta (R$)</p>
                    <p className="text-2xl font-black text-blue-700">
                        {formatCurrency(totalPerCaptaValue)}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3 text-left">Item</th>
                            <th className="p-3 text-right">Total Contratado (Kg)</th>
                            <th className="p-3 text-right">Per Capta (Kg/Mês)</th>
                            <th className="p-3 text-right">Per Capta (R$/Mês)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {itemData.map(item => {
                            const perCapitaKg = perCapitaDenominator > 0 ? (item.totalKg / perCapitaDenominator) / 4 : 0;
                            const perCapitaValue = perCapitaDenominator > 0 ? (item.totalValue / perCapitaDenominator) / 4 : 0;
                            return (
                                <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-bold text-gray-800">{item.name}</td>
                                    <td className="p-3 text-right font-mono text-gray-600">
                                        {item.totalKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-green-700">
                                        {perCapitaKg.toFixed(4).replace('.', ',')}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-blue-700">
                                        {formatCurrency(perCapitaValue)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

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