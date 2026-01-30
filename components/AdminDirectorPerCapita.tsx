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
          <title>Relatório de Entrega</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; text-align: center; }
            .footer { margin-top: 50px; display: flex; justify-content: space-around; }
            .sig { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <strong>SÃO PAULO - GOVERNO DO ESTADO</strong><br>
            Secretaria da Administração Penitenciária
          </div>
          <h2 style="text-align: center">Controle de Saída - Diretoria</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Mês/Sem</th>
                <th>Destinatário</th>
                <th>Item</th>
                <th>Qtd.</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${logs.flatMap(l => l.items.map(item => `
                <tr>
                  <td>${new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>${l.month}/S${l.week}</td>
                  <td>${l.recipient}</td>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.totalValue)}</td>
                </tr>
              `)).join('')}
            </tbody>
          </table>
          <div class="footer">
            <div class="sig">Responsável</div>
            <div class="sig">Recebedor</div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 uppercase">Novo Envio para Diretoria</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border rounded-lg" />
            <select value={month} onChange={e => setMonth(e.target.value)} className="p-2 border rounded-lg">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={week} onChange={e => setWeek(e.target.value)} className="p-2 border rounded-lg">
              {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
            </select>
            <select value={recipient} onChange={e => setRecipient(e.target.value as any)} className="p-2 border rounded-lg">
              <option value="Chefe de Departamento">Chefe de Departamento</option>
              <option value="Diretor de Disciplina">Diretor de Disciplina</option>
            </select>
          </div>

          <div className="space-y-2">
            {formItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <select value={item.name} onChange={e => handleItemChange(index, 'name', e.target.value)} className="flex-1 p-2 border rounded-lg">
                  <option value="">-- Selecionar Item --</option>
                  {availableItems.map(ai => <option key={ai.name} value={ai.name}>{ai.name}</option>)}
                </select>
                <input type="text" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} placeholder="Qtd." className="w-24 p-2 border rounded-lg" />
                <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500">Remover</button>
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="text-blue-600 font-bold text-sm">+ Adicionar Item</button>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="font-bold text-lg">Total: {formatCurrency(calculateTotal)}</span>
            <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold">
              {isSaving ? 'Salvando...' : 'Registrar Envio'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Histórico Diretoria</h3>
          <button onClick={handlePrintReport} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">Gerar PDF</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 uppercase text-xs text-gray-500">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Destinatário</th>
                <th className="p-3 text-left">Itens</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id}>
                  <td className="p-3">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">{log.recipient}</td>
                  <td className="p-3 text-xs">{log.items.map(i => i.name).join(', ')}</td>
                  <td className="p-3 text-right font-bold">{formatCurrency(log.totalValue)}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => onDelete(log.id)} className="text-red-500">Excluir</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum registro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDirectorPerCapita;