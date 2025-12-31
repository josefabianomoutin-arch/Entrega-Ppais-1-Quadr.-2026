import React, { useRef, useMemo, useState } from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  producerName: string;
  pendingInvoices: Delivery[];
  onUpload: (deliveryIds: string[], invoiceNumber: string) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ producerName, pendingInvoices, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const groupedByInvoice = useMemo(() => {
    const groups = new Map<string, Delivery[]>();
    pendingInvoices.forEach(delivery => {
      const key = delivery.invoiceNumber || 'N/A';
      const group = groups.get(key) || [];
      group.push(delivery);
      groups.set(key, group);
    });
    return groups;
  }, [pendingInvoices]);

  const handleAttachClick = (invoiceNumber: string) => {
    if (invoiceNumber === 'N/A' || !fileInputRef.current) return;
    fileInputRef.current.setAttribute('data-invoice-number', invoiceNumber);
    fileInputRef.current.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const invoiceNumber = event.target.getAttribute('data-invoice-number');

    if (file && invoiceNumber && invoiceNumber !== 'N/A') {
      setIsProcessing(invoiceNumber);
      setUploadMessage('');
      try {
        const deliveriesForInvoice = groupedByInvoice.get(invoiceNumber)?.map(d => d.id) || [];
        if (deliveriesForInvoice.length > 0) {
          onUpload(deliveriesForInvoice, invoiceNumber);
          setUploadMessage(`Verifique seu app de e-mail para concluir o envio da NF ${invoiceNumber}.`);
        }
      } catch (error) {
        setUploadMessage(`Ocorreu um erro ao preparar o e-mail da NF ${invoiceNumber}.`);
        console.error("Mailto link generation failed: ", error);
      } finally {
        setIsProcessing(null);
      }
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-red-600">Notas Fiscais Pendentes</h2>
      
      <div className="space-y-3 max-h-60 overflow-y-auto mb-4 border-t border-b py-2 pr-2">
        {Array.from(groupedByInvoice.entries()).map(([invoiceNumber, deliveries]) => (
          <div key={invoiceNumber} className="p-3 bg-gray-50 rounded-lg shadow-sm">
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-bold text-gray-800 text-sm">Nota Fiscal: <span className="font-mono">{invoiceNumber}</span></p>
                    <p className="text-xs text-gray-500">{deliveries.length} item(s) nesta NF</p>
                </div>
                 {isProcessing === invoiceNumber ? (
                    <span className="text-xs font-bold text-gray-500 animate-pulse">Aguarde...</span>
                ) : (
                    <button
                        onClick={() => handleAttachClick(invoiceNumber)}
                        disabled={invoiceNumber === 'N/A'}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Enviar por E-mail
                    </button>
                )}
            </div>
          </div>
        ))}
      </div>

      {uploadMessage && <p className="text-blue-600 text-xs text-center font-semibold bg-blue-50 p-2 rounded-md">{uploadMessage}</p>}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="application/pdf" 
      />
    </div>
  );
};

export default InvoiceUploader;