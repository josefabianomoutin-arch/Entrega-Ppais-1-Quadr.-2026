
import React, { useState, useMemo } from 'react';
import type { Supplier, DirectorPerCapitaLog, DirectorItem } from '../types';

interface AdminDirectorPerCapitaProps {
  suppliers: Supplier[];
  logs: DirectorPerCapitaLog[];
  onRegister: (log: Omit<DirectorPerCapitaLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<void>;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKS = ['1', '2', '3', '4', '5'];

const AdminDirectorPerCapita: React.FC<AdminDirectorPerCapitaProps> = ({ suppliers, logs = [], onRegister, onDelete }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [week, setWeek] = useState('1');
  const [recipient, setRecipient] = useState<'Chefe de Departamento' | 'Diretor de Disciplina'>('Chefe de Departamento');
  const [formItems, setFormItems] = useState<{ name: string; quantity: string }[]>([{ name: '', quantity: '' }]);
  const [isSaving, setIsSaving] = useState(false);

  const availableItems = useMemo(() => {
    const itemMap = new Map<string, { price: number; unit: string }>();
    suppliers.forEach(s => {
      (s.contractItems || []).forEach(ci => {
        if (!itemMap.has(ci.name)) {
          itemMap.set(ci.name, { price: ci.valuePerKg, unit: ci.unit || 'Kg' });
        }
      });
    });
    return Array.from(itemMap.entries()).map(([name, info]) => ({ name, ...info })).sort((a,b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const handleAddItem = () => setFormItems([...formItems, { name: '', quantity: '' }]);
  const handleRemoveItem = (index: number) => setFormItems(formItems.filter((_, i) => i !== index));
  const handleItemChange = (index: number, field: 'name' | 'quantity', value: string) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const calculateTotal = useMemo(() => {
    return formItems.reduce((acc, fItem) => {
      const info = availableItems.find(ai => ai.name === fItem.name);
      const qty = parseFloat(fItem.quantity.replace(',', '.'));
      if (info && !isNaN(qty)) return acc + (qty * info.price);
      return acc;
    }, 0);
  }, [formItems, availableItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems: DirectorItem[] = formItems
      .map(fi => {
        const info = availableItems.find(ai => ai.name === fi.name);
        const qty = parseFloat(fi.quantity.replace(',', '.'));
        if (info && !isNaN(qty) && qty > 0) {
          return { name: fi.name, quantity: qty, unitPrice: info.price, totalValue: qty * info.price };
        }
        return null;
      })
      .filter((i): i is DirectorItem => i !== null);

    if (validItems.length === 0) {
      alert('Adicione pelo menos um item válido.');
      return;
    }

    setIsSaving(true);
    const result = await onRegister({ 
        date, 
        month, 
        week, 
        recipient, 
        items: validItems, 
        totalValue: calculateTotal 
    });
    if (result.success) {
      setFormItems([{ name: '', quantity: '' }]);
      setDate(new Date().toISOString().split('T')[0]);
    }
    setIsSaving(false);
  };

  const handlePrintReport = () => {
    const printContent = `
      <html>
        <head>
          <title>Relatório de Entrega - Diretoria</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header-sap { font-size: 14px; margin-bottom: 2px; }
            .header-unit { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .header-address { font-size: 11px; }
            .header-contact { font-size: 11px; }
            .report-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
            .footer { margin-top: 60px; display: flex; justify-content: space-around; }
            .sig { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-sap">Secretaria da Administração Penitenciária</div>
            <div class="header-unit">Polícia Penal - Penitenciária de Taiúva</div>
            <div class="header-address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP - CEP: 14.720-000</div>
            <div class="header-contact">Fone: (16) 3247-6261 - E-mail: dg@ptaiuva.sap.gov.br</div>
          </div>
          
          <div class="report-title">Controle de Saída - Itens para Diretoria</div>
          
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Mês/Semana</th>
                <th>Destinatário</th>
                <th>Descrição do Item</th>
                <th>Qtd.</th>
                <th>V. Unit.</th>
                <th>V. Total</th>
              </tr>
            </thead>
            <tbody>
              ${logs.flatMap(l => l.items.map(item => `
                <tr>
                  <td>${new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>${l.month} / S${l.week}</td>
                  <td>${l.recipient}</td>
                  <td>${item.name}</td>
                  <td>${item.quantity.toLocaleString('pt-BR')}</td>
                  <td>${formatCurrency(item.unitPrice)}</td>
                  <td>${formatCurrency(item.totalValue)}</td>
                </tr>
              `)).join('')}
            </tbody>
            <tfoot>
               <tr style="font-weight: bold; background-color: #eee;">
                  <td colspan="6" style="text-align: right">TOTAL GERAL DO RELATÓRIO:</td>
                  <td>${formatCurrency(logs.reduce((acc, curr) => acc + curr.totalValue, 0))}</td>
               </tr>
            </tfoot>
          </table>
          
          <div class="footer">
            <div class="sig">Responsável (Almoxarifado)</div>
            <div class="sig">Recebedor (Diretoria)</div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 uppercase">Novo Envio para Diretoria</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Mês de Referência</label>
              <select value={month} onChange={e => setMonth(e.target.value)} className="w-full p-2 border rounded-lg">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Semana</label>
              <select value={week} onChange={e => setWeek(e.target.value)} className="w-full p-2 border rounded-lg">
                {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Destinatário</label>
              <select value={recipient} onChange={e => setRecipient(e.target.value as any)} className="w-full p-2 border rounded-lg">
                <option value="Chefe de Departamento">Chefe de Departamento</option>
                <option value="Diretor de Disciplina">Diretor de Disciplina</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Itens a Enviar</label>
            {formItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                <select 
                  value={item.name} 
                  onChange={e => handleItemChange(index, 'name', e.target.value)} 
                  className="flex-1 p-2 border rounded-lg text-sm"
                >
                  <option value="">-- Selecionar Item do Contrato --</option>
                  {availableItems.map(ai => <option key={ai.name} value={ai.name}>{ai.name}</option>)}
                </select>
                <input 
                  type="text" 
                  value={item.quantity} 
                  onChange={e => handleItemChange(index, 'quantity', e.target.value.replace(/[^0-9,]/g, ''))} 
                  placeholder="Qtd." 
                  className="w-24 p-2 border rounded-lg text-sm font-mono text-center" 
                />
                <button 
                  type="button" 
                  onClick={() => handleRemoveItem(index)} 
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  disabled={formItems.length === 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Adicionar outro item
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t gap-4">
            <div className="text-indigo-900">
                <span className="text-sm font-bold uppercase text-indigo-400">Total do Envio:</span>
                <span className="ml-2 font-black text-2xl">{formatCurrency(calculateTotal)}</span>
            </div>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-xl font-black transition-all shadow-lg active:scale-95 uppercase tracking-wider disabled:bg-gray-400"
            >
              {isSaving ? 'Registrando...' : 'Registrar Envio'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Histórico de Envios</h3>
            <p className="text-xs text-gray-500">Registros de saídas para as diretorias</p>
          </div>
          <button 
            onClick={handlePrintReport} 
            disabled={logs.length === 0}
            className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Gerar PDF para Impressão
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-inner">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b">
              <tr>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Referência</th>
                <th className="p-4 text-left">Destinatário</th>
                <th className="p-4 text-left">Descrição dos Itens</th>
                <th className="p-4 text-right">Valor Total</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-gray-700">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-4">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold">
                        {log.month} (S{log.week})
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-gray-600">{log.recipient}</td>
                  <td className="p-4 text-xs text-gray-500 italic max-w-xs truncate" title={log.items.map(i => i.name).join(', ')}>
                    {log.items.map(i => i.name).join(', ')}
                  </td>
                  <td className="p-4 text-right font-black text-indigo-700">{formatCurrency(log.totalValue)}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => { if(window.confirm('Deseja excluir este registro permanentemente?')) onDelete(log.id); }} 
                      className="text-red-400 hover:text-red-600 p-2 rounded-full transition-colors"
                      title="Excluir Registro"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic">Nenhum registro de envio para diretoria localizado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminDirectorPerCapita;
