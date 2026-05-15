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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
        <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Executive Report Preview</h2>
                <p className="text-xs text-slate-500 font-medium">Datapapa Intelligence Ledger</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Printer size={16} /> Print Report
              </button>

              <PDFDownloadLink
                document={pdfDoc}
                fileName={`Datapapa_Report_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                {({ loading }) => (
                  loading ? 'Preparing Document...' : <><Download size={16} /> Download PDF</>
                )}
              </PDFDownloadLink>

              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 ml-2"
                title="Close Preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* PDF Viewer Body */}
          <div className="flex-1 bg-slate-100 p-4">
            <PDFViewer width="100%" height="100%" className="rounded-xl border border-slate-200 shadow-sm">
              {pdfDoc}
            </PDFViewer>
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
