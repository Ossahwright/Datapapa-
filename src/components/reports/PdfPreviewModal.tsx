import React from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { ReportPDFTemplate } from './ReportPDFTemplate';
import { X, Printer, Download, FileText } from 'lucide-react';
import { PrintReportLayout } from './PrintReportLayout';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  kpi: any;
  dateRangeLabel: string;
  generatedBy: string;
  networkStats?: any[];
  deliveryStats?: any[];
}

export const PdfPreviewModal = ({ 
  isOpen, 
  onClose, 
  data, 
  kpi, 
  dateRangeLabel, 
  generatedBy,
  networkStats = [],
  deliveryStats = []
}: PdfPreviewModalProps) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    console.log("=== REPORT PRINT STARTED ===");
    window.print();
  };

  const pdfDoc = (
    <ReportPDFTemplate 
      data={data} 
      kpi={kpi} 
      dateRangeLabel={dateRangeLabel} 
      generatedBy={generatedBy}
      networkStats={networkStats}
      deliveryStats={deliveryStats}
    />
  );

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/90 backdrop-blur-sm print:hidden">
        <div className="bg-white w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Responsive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 gap-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base sm:text-lg leading-tight truncate">Executive Report</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Datapapa Intelligence Ledger</p>
              </div>
              <button 
                onClick={onClose}
                className="sm:hidden p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 ml-auto"
              >
                <X size={20} />
              </button>
            </div>
            
      
        </div>
        </div>
      </div>
      {/* Hidden layout only visible during window.print() */}
      <PrintReportLayout 
        data={data} 
        kpi={kpi} 
        dateRangeLabel={dateRangeLabel} 
        generatedBy={generatedBy}
      />
    </>
  );
};
