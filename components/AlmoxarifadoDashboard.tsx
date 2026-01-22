import React, { useState, useRef } from 'react';
import type { Supplier, Delivery, WarehouseMovement } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    onLogout: () => void;
    onRegisterMovement: (movement: Omit<WarehouseMovement, 'id' | 'timestamp'>) => Promise<boolean>;
}

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, onLogout, onRegisterMovement }) => {
    const [entryBarcode, setEntryBarcode] = useState('');
    const [exitBarcode, setExitBarcode] = useState('');
    const [exitInvoice, setExitInvoice] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const entryInputRef = useRef<HTMLInputElement>(null);
    const exitInputRef = useRef<HTMLInputElement>(null);

    const clearFeedback = () => {
        if (feedback) {
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    const processMovement = async (type: 'entrada' | 'saída') => {
        const barcode = type === 'entrada' ? entryBarcode : exitBarcode;
        
        if (!barcode) {
            setFeedback({ type: 'error', message: 'O campo de Lote / Código de Barras é obrigatório.' });
            clearFeedback();
            return;
        }

        if (type === 'saída' && !exitInvoice) {
            setFeedback({ type: 'error', message: 'O número da Nota Fiscal de Saída é obrigatório.' });
            clearFeedback();
            return;
        }

        setIsProcessing(true);
        setFeedback(null);

        // 1. Encontrar o lote
        let foundLot: any = null;
        let foundDelivery: Delivery | null = null;
        let foundSupplier: Supplier | null = null;

        for (const supplier of suppliers) {
            for (const delivery of supplier.deliveries) {
                const lot = (delivery.lots || []).find(l => l.barcode === barcode);
                if (lot) {
                    foundLot = lot;
                    foundDelivery = delivery;
                    foundSupplier = supplier;
                    break;
                }
            }
            if (foundLot) break;
        }

        if (!foundLot || !foundDelivery || !foundSupplier) {
            setFeedback({ type: 'error', message: `Lote com código "${barcode}" não encontrado no sistema.` });
            setIsProcessing(false);
            clearFeedback();
            return;
        }

        // 2. Lógica de verificação PEPS (Primeiro que Entra, Primeiro que Sai)
        const itemName = foundDelivery.item;
        const allLotsOfItem: { lot: any; delivery: Delivery }[] = [];
        suppliers.forEach(s => {
            s.deliveries.forEach(d => {
                if (d.item === itemName) {
                    (d.lots || []).forEach(l => {
                        if (l.remainingQuantity > 0) {
                           allLotsOfItem.push({ lot: l, delivery: d });
                        }
                    });
                }
            });
        });
        
        // Ordena para encontrar o mais antigo (baseado na data da entrega)
        allLotsOfItem.sort((a, b) => new Date(a.delivery.date).getTime() - new Date(b.delivery.date).getTime());
        
        const oldestLotData = allLotsOfItem[0];

        if (oldestLotData && oldestLotData.lot.id !== foundLot.id) {
            const oldestDelivery = suppliers.flatMap(s => s.deliveries).find(d => d.id === oldestLotData.delivery.id);
            const confirmation = window.confirm(
                `ATENÇÃO: Este não é o lote mais antigo para este produto.\n\n` +
                `Lote mais antigo: ${oldestLotData.lot.lotNumber}\n` +
                `NF de Entrada: ${oldestDelivery?.invoiceNumber}\n` +
                `Data de Entrada: ${new Date(oldestDelivery!.date + 'T00:00:00').toLocaleDateString('pt-BR')}\n\n` +
                `Deseja continuar com a operação mesmo assim?`
            );
            if (!confirmation) {
                setIsProcessing(false);
                return;
            }
        }

        // 3. Registrar a movimentação
        const movementData: Omit<WarehouseMovement, 'id' | 'timestamp'> = {
            type: type,
            lotId: foundLot.id,
            lotNumber: foundLot.lotNumber,
            itemName: foundDelivery.item || 'Item Desconhecido',
            supplierName: foundSupplier.name,
            deliveryId: foundDelivery.id,
            ...(type === 'saída' && { outboundInvoice: exitInvoice }),
            ...(type === 'entrada' && { inboundInvoice: foundDelivery.invoiceNumber }),
        };

        const success = await onRegisterMovement(movementData);

        if (success) {
            setFeedback({ type: 'success', message: `Registro de ${type} para o lote "${barcode}" realizado com sucesso!` });
            if (type === 'entrada') {
                setEntryBarcode('');
                entryInputRef.current?.focus();
            } else {
                setExitBarcode('');
                setExitInvoice('');
                exitInputRef.current?.focus();
            }
        } else {
            setFeedback({ type: 'error', message: `Falha ao registrar a ${type}. Verifique sua conexão e tente novamente.` });
        }
        
        setIsProcessing(false);
        clearFeedback();
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-md p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-700">Painel do Almoxarifado</h1>
                    <p className="text-sm text-gray-500">Registro de Entradas e Saídas de Lotes</p>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                    Sair
                </button>
            </header>

            <main className="p-8">
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Card de Entrada */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-500">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">Registrar Entrada</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="entry-barcode" className="block text-sm font-medium text-gray-600 mb-1">Lote / Código de Barras</label>
                                <input
                                    ref={entryInputRef}
                                    id="entry-barcode"
                                    type="text"
                                    value={entryBarcode}
                                    onChange={(e) => setEntryBarcode(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && processMovement('entrada')}
                                    placeholder="Leia ou digite o código"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                                />
                            </div>
                            <button
                                onClick={() => processMovement('entrada')}
                                disabled={isProcessing}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                            >
                                {isProcessing ? 'Processando...' : 'Registrar Entrada'}
                            </button>
                        </div>
                    </div>

                    {/* Card de Saída */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">Registrar Saída</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="exit-barcode" className="block text-sm font-medium text-gray-600 mb-1">Lote / Código de Barras</label>
                                <input
                                    ref={exitInputRef}
                                    id="exit-barcode"
                                    type="text"
                                    value={exitBarcode}
                                    onChange={(e) => setExitBarcode(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && processMovement('saída')}
                                    placeholder="Leia ou digite o código"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                />
                            </div>
                            <div>
                                <label htmlFor="exit-invoice" className="block text-sm font-medium text-gray-600 mb-1">Nº da Nota Fiscal de Saída</label>
                                <input
                                    id="exit-invoice"
                                    type="text"
                                    value={exitInvoice}
                                    onChange={(e) => setExitInvoice(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && processMovement('saída')}
                                    placeholder="Digite o número da NF"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                                />
                            </div>
                            <button
                                onClick={() => processMovement('saída')}
                                disabled={isProcessing}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                            >
                                {isProcessing ? 'Processando...' : 'Registrar Saída'}
                            </button>
                        </div>
                    </div>
                </div>

                {feedback && (
                    <div className={`mt-8 max-w-4xl mx-auto p-4 rounded-lg text-center font-semibold animate-fade-in ${
                        feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {feedback.message}
                    </div>
                )}
            </main>
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;