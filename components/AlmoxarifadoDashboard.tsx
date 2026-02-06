
import React, { useState, useMemo, useRef } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

// Normalização absoluta para comparação de strings (usada na importação)
const superNormalize = (text: string) => {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const recentMovements = useMemo(() => {
        return warehouseLog
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 15);
    }, [warehouseLog]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let text = e.target?.result as string;
            const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            if (lines.length <= 1) return;

            setIsImporting(true);
            let successCount = 0;
            let errorCount = 0;
            let errorDetails: string[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let cols = line.split(";");
                if (cols.length < 5) cols = line.split(",");
                if (cols.length < 6) { errorCount++; continue; }

                const [tipoRaw, csvItem, csvSupplier, nf, lote, qtd, data, venc] = cols.map(c => c.trim());
                const isEntrada = tipoRaw.toUpperCase().includes('ENTRADA');
                
                // Melhoria no parsing: Remove pontos (milhar) e troca vírgula por ponto (decimal)
                const sanitizedQty = qtd.replace(/\./g, '').replace(',', '.');
                const qtyVal = parseFloat(sanitizedQty);

                if (isNaN(qtyVal)) { errorCount++; errorDetails.push(`Linha ${i+1}: Quantidade '${qtd}' inválida.`); continue; }

                const supplier = suppliers.find(s => superNormalize(s.name) === superNormalize(csvSupplier));
                if (!supplier) { errorCount++; errorDetails.push(`Linha ${i+1}: Fornecedor '${csvSupplier}' não localizado.`); continue; }

                const officialItem = supplier.contractItems.find(ci => superNormalize(ci.name) === superNormalize(csvItem));
                if (!officialItem) { errorCount++; errorDetails.push(`Linha ${i+1}: Item '${csvItem}' não consta no contrato de ${supplier.name}.`); continue; }

                try {
                    let res;
                    if (isEntrada) {
                        res = await onRegisterEntry({ supplierCpf: supplier.cpf, itemName: officialItem.name, invoiceNumber: nf, invoiceDate: data || new Date().toISOString().split('T')[0], lotNumber: lote, quantity: qtyVal, expirationDate: venc || '' });
                    } else {
                        res = await onRegisterWithdrawal({ supplierCpf: supplier.cpf, itemName: officialItem.name, outboundInvoice: nf, lotNumber: lote, quantity: qtyVal, expirationDate: venc || '' });
                    }

                    if (res.success) successCount++;
                    else { errorCount++; errorDetails.push(`Linha ${i+1}: ${res.message}`); }
                } catch (err) { errorCount++; }
            }

            setIsImporting(false);
            alert(`Processamento concluído!\n✅ Sucessos: ${successCount}\n❌ Erros: ${errorCount}${errorDetails.length > 0 ? `\n\nResumo de erros:\n${errorDetails.slice(0, 3).join('\n')}` : ''}`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 pb-20">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-tighter">Módulo Almoxarifado</h1>
                    <p className="text-xs text-gray-500 font-medium">Entrada e Saída exclusivamente por Planilha de Histórico.</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl text-sm transition-colors shadow-sm">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                {/* Card de Importação Central */}
                <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-600 text-center space-y-6 animate-fade-in">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H5a2 2 0 00-2 2v6a2 2 0 002 2h22a2 2 0 002-2v-6a2 2 0 00-2-2h-1a4 4 0 00-4 4v2m0-10l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Atualizar Estoque</h2>
                        <p className="text-gray-500 font-medium">Selecione a planilha de histórico (CSV) para processar entradas e saídas.</p>
                    </div>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-12 rounded-2xl transition-all shadow-lg active:scale-95 disabled:bg-gray-400 flex items-center gap-3 mx-auto uppercase tracking-widest text-sm"
                    >
                        {isImporting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processando Arquivo...
                            </>
                        ) : 'Importar Planilha .CSV'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                    
                    <div className="pt-4">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Formatos aceitos: Ponto e Vírgula (;) ou Vírgula (,)</p>
                    </div>
                </div>

                {/* Tabela de Movimentações Recentes */}
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-black text-gray-800 uppercase mb-6 tracking-tight border-b pb-4">Últimas 15 Movimentações</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                    <th className="p-4 text-left">Tipo</th>
                                    <th className="p-4 text-left">Data/Hora</th>
                                    <th className="p-4 text-left">Item</th>
                                    <th className="p-4 text-right">Quantidade</th>
                                    <th className="p-4 text-left">Lote</th>
                                    <th className="p-4 text-left">NF/Documento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentMovements.length > 0 ? recentMovements.map(mov => (
                                    <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            {mov.type === 'entrada' ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Entrada</span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Saída</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 font-mono">{new Date(mov.timestamp).toLocaleString('pt-BR')}</td>
                                        <td className="p-4 font-bold text-gray-700 uppercase">{mov.itemName}</td>
                                        <td className="p-4 text-right font-mono font-bold">
                                            {(mov.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-500">{mov.lotNumber}</td>
                                        <td className="p-4 text-xs text-gray-500 font-mono">{mov.inboundInvoice || mov.outboundInvoice || '-'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Nenhuma movimentação para exibir.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; } @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;
