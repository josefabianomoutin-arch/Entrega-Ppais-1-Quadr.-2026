import React, { useMemo } from 'react';
import type { Supplier } from '../types';

interface AdminGraphsProps {
  suppliers: Supplier[];
}

const AdminGraphs: React.FC<AdminGraphsProps> = ({ suppliers }) => {
  // Dados para o Gráfico de Entrega de Produtos
  const productData = useMemo(() => {
    const data = new Map<string, { contractedKg: number; deliveredKg: number }>();

    suppliers.forEach(p => {
      (p.contractItems || []).forEach(item => {
        const current = data.get(item.name) || { contractedKg: 0, deliveredKg: 0 };
        current.contractedKg += item.totalKg;
        data.set(item.name, current);
      });
      (p.deliveries || []).forEach(delivery => {
        const current = data.get(delivery.item) || { contractedKg: 0, deliveredKg: 0 };
        current.deliveredKg += delivery.kg;
        data.set(delivery.item, current);
      });
    });
    
    return Array.from(data.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.contractedKg - a.contractedKg);
  }, [suppliers]);
  
  const maxContractedKg = useMemo(() => {
     return Math.max(1, ...productData.map(p => p.contractedKg));
  }, [productData]);

  // Dados para o Gráfico de Status de Notas Fiscais (Contagem por NF única)
  const invoiceData = useMemo(() => {
    const uniqueInvoices = new Map<string, { isSent: boolean }>();

    suppliers.forEach(p => {
        (p.deliveries || []).forEach(d => {
            if (d.invoiceNumber) {
                const invoiceKey = `${p.cpf}-${d.invoiceNumber}`;
                if (!uniqueInvoices.has(invoiceKey)) {
                    uniqueInvoices.set(invoiceKey, { isSent: d.invoiceUploaded });
                }
            }
        });
    });
    
    let sentCount = 0;
    let pendingCount = 0;
    uniqueInvoices.forEach(invoice => {
        if (invoice.isSent) {
            sentCount++;
        } else {
            pendingCount++;
        }
    });

    return { sent: sentCount, pending: pendingCount };
  }, [suppliers]);
  
  const totalInvoices = invoiceData.sent + invoiceData.pending;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-blue-500">
        <h2 className="text-2xl font-black mb-6 text-gray-700 uppercase tracking-tight">Status de Entrega por Produto (Kg)</h2>
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          {productData.length > 0 ? productData.map(item => {
            const deliveredWidthPercentage = item.contractedKg > 0 ? (item.deliveredKg / item.contractedKg) * 100 : 0;
            return (
              <div key={item.name} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <p className="text-xs font-mono text-gray-500">
                    <span className="font-semibold text-green-600">{item.deliveredKg.toFixed(2).replace('.', ',')}</span> / {item.contractedKg.toFixed(2).replace('.', ',')} Kg
                  </p>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-6 relative shadow-inner overflow-hidden">
                   <div 
                      className="bg-green-500 h-6 rounded-full transition-all duration-500"
                      style={{ width: `${deliveredWidthPercentage}%` }}
                      title={`Entregue: ${deliveredWidthPercentage.toFixed(1)}%`}
                    >
                   </div>
                   <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-exclusion tracking-wider">
                        {deliveredWidthPercentage.toFixed(0)}%
                   </span>
                </div>
              </div>
            );
          }) : <p className="text-center text-gray-400 italic py-8">Nenhum item de contrato encontrado para gerar gráfico.</p>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-green-500">
        <h2 className="text-2xl font-black mb-6 text-gray-700 uppercase tracking-tight">Status das Notas Fiscais</h2>
        {totalInvoices > 0 ? (
        <div className="flex justify-around items-end gap-8 h-64 pt-4">
          <div className="flex flex-col items-center h-full w-1/3">
            <div className="w-full h-full flex items-end justify-center">
                <div 
                  className="w-full bg-green-500 rounded-t-lg shadow-lg transition-all duration-500 hover:scale-105"
                  style={{ height: `${(invoiceData.sent / totalInvoices) * 100}%` }}
                  title={`${invoiceData.sent} notas fiscais`}
                ></div>
            </div>
            <p className="mt-2 font-bold text-sm text-center">Enviadas: <span className="text-green-600 text-lg">{invoiceData.sent}</span></p>
          </div>
          <div className="flex flex-col items-center h-full w-1/3">
             <div className="w-full h-full flex items-end justify-center">
                <div 
                  className="w-full bg-red-500 rounded-t-lg shadow-lg transition-all duration-500 hover:scale-105"
                  style={{ height: `${(invoiceData.pending / totalInvoices) * 100}%` }}
                  title={`${invoiceData.pending} notas fiscais`}
                ></div>
             </div>
             <p className="mt-2 font-bold text-sm text-center">Pendentes: <span className="text-red-600 text-lg">{invoiceData.pending}</span></p>
          </div>
        </div>
        ) : <p className="text-center text-gray-400 italic py-8">Nenhuma nota fiscal registrada para gerar gráfico.</p>}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: #F9FAFB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; border: 2px solid #F9FAFB; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3B82F6; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminGraphs;
