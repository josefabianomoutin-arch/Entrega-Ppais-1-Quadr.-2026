import React, { useRef, useMemo, useState } from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  producerName: string;
  pendingInvoices: Delivery[];
  onUpload: (deliveryIds: string[], invoiceNumber: string, file: File) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ producerName, pendingInvoices, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

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
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const invoiceNumber = event.target.getAttribute('data-invoice-number');

    if (file && invoiceNumber && invoiceNumber !== 'N/A') {
      setIsUploading(invoiceNumber);
      setUploadError('');
      try {
        const deliveriesForInvoice = groupedByInvoice.get(invoiceNumber)?.map(d => d.id) || [];
        if (deliveriesForInvoice.length > 0) {
          await onUpload(deliveriesForInvoice, invoiceNumber, file);
        }
      } catch (error) {
        setUploadError(`Falha no envio da NF ${invoiceNumber}. Tente novamente.`);
        console.error("Upload failed: ", error);
      } finally {
        setIsUploading(null);
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
                 {isUploading === invoiceNumber ? (
                    <span className="text-xs font-bold text-gray-500 animate-pulse">Enviando...</span>
                ) : (
                    <button
                        onClick={() => handleAttachClick(invoiceNumber)}
                        disabled={invoiceNumber === 'N/A'}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Anexar PDF
                    </button>
                )}
            </div>
          </div>
        ))}
      </div>

      {uploadError && <p className="text-red-500 text-xs text-center font-semibold">{uploadError}</p>}

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