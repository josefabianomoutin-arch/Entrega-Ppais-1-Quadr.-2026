import React, { useRef, useMemo, useState } from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  producerName: string;
  pendingInvoices: Delivery[];
  onUpload: (deliveryIds: string[], invoiceNumber: string) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ producerName, pendingInvoices, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadData, setCurrentUploadData] = useState<{ invoiceNumber: string; deliveryIds: string[] } | null>(null);

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

  const handleSelectFileClick = (invoiceNumber: string, deliveriesForInvoice: Delivery[]) => {
    if (invoiceNumber === 'N/A') {
        alert('Não é possível enviar uma nota fiscal para entregas sem um número de nota fiscal definido.');
        return;
    }
    setCurrentUploadData({
      invoiceNumber,
      deliveryIds: deliveriesForInvoice.map(d => d.id)
    });
    fileInputRef.current?.click();
  };
  
  const formatDate = (dateString: string) => {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('pt-BR');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file && currentUploadData) {
        const { invoiceNumber, deliveryIds } = currentUploadData;
        
        const deliveriesForEmail = pendingInvoices.filter(d => deliveryIds.includes(d.id));
        const pendingListText = deliveriesForEmail
            .map(d => `- Item: ${d.item} (Data: ${formatDate(d.date)})`)
            .join('\n');
        
        const subject = `Notas Fiscais Pendentes - ${producerName} (NF: ${invoiceNumber})`;
        const body = `Prezado(a),

Segue em anexo o arquivo PDF com as notas fiscais (Número: ${invoiceNumber}) referentes a todas as entregas pendentes listadas abaixo:

${pendingListText}

Por favor, anexe o arquivo "${file.name}" a este e-mail antes de enviar.

Atenciosamente,
${producerName}`;

        const mailtoLink = `mailto:destinatario@exemplo.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        window.open(mailtoLink, '_blank');

        onUpload(deliveryIds, invoiceNumber);
        
        setCurrentUploadData(null);
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
                <button
                    onClick={() => handleSelectFileClick(invoiceNumber, deliveries)}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs"
                >
                    Enviar PDF
                </button>
            </div>
          </div>
        ))}
      </div>

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