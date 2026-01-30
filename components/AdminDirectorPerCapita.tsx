
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

const AdminDirectorPerCapita: React.FC<AdminDirectorPerCapitaProps> = ({ suppliers, logs, onRegister, onDelete }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [week, setWeek] = useState('1');
  const [recipient, setRecipient] = useState<'Chefe de Departamento' | 'Diretor de Disciplina'>('Chefe de Departamento');
  const [formItems, setFormItems] = useState<{ name: string; quantity: string }[]>([{ name: '', quantity: '' }]);
  const [isSaving, setIsSaving] = useState(false);

  const availableItems = useMemo(() => {
    const itemMap = new Map<string, { price: number; unit: string }>();
    suppliers.forEach(s => {
      s.contractItems.forEach(ci => {
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

  const handleExportExcel = () => {
    const headers = ["Data", "Mês", "Semana", "Destinatário", "Item", "Quantidade", "Vlr. Unitário", "Vlr. Total"];
    const csvContent = [
      headers.join(";"),
      ...logs.flatMap(l => l.items.map(item => [
        new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        l.month || '-',
        l.week || '-',
        l.recipient,
        item.name,
        item.quantity.toString().replace('.', ','),
        item.unitPrice.toFixed(2).replace('.', ','),
        item.totalValue.toFixed(2).replace('.', ',')
      ].join(";")))
    ].join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `controle_per_capita_diretoria_${date}.csv`;
    link.click();
  };

  const handlePrintReport = () => {
    const logoSAP = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Bras%C3%A3o_do_estado_de_S%C3%A3o_Paulo.svg/1200px-Bras%C3%A3o_do_estado_de_S%C3%A3o_Paulo.svg.png";

    const printContent = `
      <html>
        <head>
          <title>Relatório de Entrega - Diretoria</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Arial', sans-serif; padding: 0; color: #000; line-height: 1.3; margin: 0; }
            .official-header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 30px; padding-top: 10px; }
            .official-header .logos-container { display: flex; align-items: center; gap: 15px; }
            .official-header img.brasao { height: 50px; width: auto; }
            .official-header .divider { width: 2px; height: 40px; background-color: #000; margin: 0 10px; }
            .official-header .sp-logo-text { font-weight: bold; font-size: 16px; line-height: 1; text-align: left; }
            .official-header .sp-logo-sub { font-size: 9px; font-weight: normal; display: block; margin-top: 2px; }
            .report-title { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .report-title h1 { font-size: 16px; margin: 0; text-transform: uppercase; }
            .report-title p { font-size: 11px; margin: 3px 0 0 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 10px; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .signatures { margin-top: 60px; display: flex; justify-content: space-around; }
            .signature-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .official-footer { position: fixed; bottom: 15mm; right: 15mm; text-align: right; font-size: 9px; color: #000; }
            .official-footer .dept { font-weight: normal; margin-bottom: 2px; }
            .official-footer .unit { font-weight: bold; font-size: 10px; }
            .official-footer .address { margin-top: 2px; }
            @media print { .official-footer { position: fixed; bottom: 15mm; } body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="official-header">
            <div class="logos-container">
               <img src="${logoSAP}" class="brasao" alt="Brasão SAP">
               <div class="divider"></div>
               <div class="sp-logo-text">
                  SÃO PAULO
                  <span class="sp-logo-sub">GOVERNO DO ESTADO</span>
               </div>
            </div>
          </div>
          <div class="report-title">
            <h1>Controle de Entrega de Materiais - Diretoria</h1>
            <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} | Controle Mensal/Semanal</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 70px;">Data</th>
                <th style="width: 60px; text-align: center;">Mês/Sem</th>
                <th style="width: 120px;">Destinatário</th>
                <th>Descrição do Item</th>
                <th style="width: 50px; text-align: center;">Qtd.</th>
                <th style="width: 80px; text-align: right;">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${logs.flatMap(l => l.items.map(item => `
                <tr>
                  <td>${new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style="text-align: center;">${l.month?.substring(0,3)}/S${l.week}</td>
                  <td>${l.recipient}</td>
                  <td>${item.name}</td>
                  <td style="text-align: center;">${item.quantity.toString().replace('.', ',')}</td>
                  <td style="text-align: right;">${formatCurrency(item.totalValue)}</td>
                </tr>
              `)).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; text-transform: uppercase;">Valor Total Acumulado:</td>
                <td style="text-align: right;">${formatCurrency(logs.reduce((acc, l) => acc + l.totalValue, 0))}</td>
              </tr>
            </tbody>
          </table>
          <div class="signatures">
            <div class="signature-box">Responsável pela Entrega</div>
            <div class="signature-box">Assinatura do Recebedor</div>
          </div>
          <div class="official-footer">
            <div class="dept">Secretaria da Administração Penitenciária</div>
            <div class="unit">Polícia Penal - Penitenciária de Taiúva</div>
            <div class="address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP – CEP: 14.720-000</div>
            <div class="contact">Fone: (16) 3247-6261 – E-mail: dg@ptaiuva.sap.gov.br</div>
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); }, 800); };</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 uppercase tracking-tighter">Novo Envio para Diretoria</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Mensal</label>
              <select value={month} onChange={e => setMonth(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Semanal</label>
              <select value={week} onChange={e => setWeek(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-center">
                {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Destinatário</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button type="button" onClick={() => setRecipient('Chefe de Departamento')} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${recipient === 'Chefe de Departamento' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>Chefe Depto.</button>
                <button type="button" onClick={() => setRecipient('Diretor de Disciplina')} className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all ${recipient === 'Diretor de Disciplina' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>Dir. Disciplina</button>
              </div>
            </div>
             <div className="space-y-1 text-right">
              <label className="text-xs font-bold text-gray-500 uppercase">Vlr. Total</label>
              <div className="text-xl font-black text-indigo-600 truncate">{formatCurrency(calculateTotal)}</div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <label className="text-xs font-bold text-gray-500 uppercase">Itens e Quantidades</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {formItems.map((item, index) => {
                const itemInfo = availableItems.find(ai => ai.name === item.name);
                return (
                  <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border">
                    <select value={item.name} onChange={e => handleItemChange(index, 'name', e.target.value)} className="flex-1 p-2 border rounded-md text-sm">
                      <option value="">-- Selecionar Item --</option>
                      {availableItems.map(ai => <option key={ai.name} value={ai.name}>{ai.name}</option>)}
                    </select>
                    <input type="text" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Qtd." className="w-24 p-2 border rounded-md text-sm font-mono text-right" />
                    <div className="w-28 text-right text-xs font-bold text-indigo-600">
                      {itemInfo && !isNaN(parseFloat(item.quantity.replace(',','.'))) ? formatCurrency(parseFloat(item.quantity.replace(',','.')) * itemInfo.price) : '--'}
                    </div>
                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 p-1 hover:text-red-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={handleAddItem} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">+ Adicionar outro item</button>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-lg disabled:bg-gray-400">
              {isSaving ? 'Registrando...' : 'Confirmar Envio'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-gray-800">Histórico de Saídas Diretoria</h3>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Planilha Excel
            </button>
            <button onClick={handlePrintReport} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Gerar Relatório PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-center">Ref. Período</th>
                <th className="p-3 text-left">Destinatário</th>
                <th className="p-3 text-left">Resumo de Itens</th>
                <th className="p-3 text-right">Vlr. Total</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-mono">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-center">
                    <div className="text-[10px] font-bold text-gray-600">{log.month}</div>
                    <div className="text-[10px] text-gray-400">Semana {log.week}</div>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${log.recipient === 'Chefe de Departamento' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {log.recipient}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-500 italic max-w-xs truncate" title={log.items.map(i => `${i.name} (${i.quantity})`).join(', ')}>
                    {log.items.map(i => i.name).join(', ')}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-700">{formatCurrency(log.totalValue)}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => { if(window.confirm('Excluir este registro?')) onDelete(log.id); }} className="text-red-400 hover:text-red-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhum envio registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default AdminDirectorPerCapita;
