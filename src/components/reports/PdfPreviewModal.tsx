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
            
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-3 py-2.5 sm:px-4 sm:py-2 bg-white text-slate-700 border border-slate-200 rounded-xl sm:rounded-lg font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={16} /> <span className="hidden xs:inline">Print</span><span className="xs:hidden">Print</span>
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
                className="flex-[2] sm:flex-none px-3 py-2.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl sm:rounded-lg font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {({ loading }) => (
                  loading ? 'Preparing...' : <><Download size={16} /> Download <span className="hidden xs:inline">PDF</span></>
                )}
              </PDFDownloadLink>

              <button 
                onClick={onClose}
                className="hidden sm:block p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 ml-2"
                title="Close Preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* PDF Viewer Body - Responsive Handling */}
          <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-auto">
            {/* Desktop Experience: Full PDF Viewer */}
            <div className="hidden sm:block h-full w-full">
              <PDFViewer width="100%" height="100%" className="rounded-xl border border-slate-200 shadow-sm bg-white">
                {pdfDoc}
              </PDFViewer>
            </div>

            {/* Mobile Experience: Mobile Intelligence Deck (Fallback since PDFViewer fails on mobile) */}
            <div className="sm:hidden flex flex-col items-center justify-center h-full text-center space-y-6 px-4 py-8">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 animate-pulse">
                <FileText size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Intelligence Ready</h3>
                <p className="text-slate-500 text-sm font-medium max-w-xs mx-auto leading-relaxed">
                  The high-fidelity enterprise ledger has been synthesized. Mobile browsers require manual download for full intelligence review.
                </p>
              </div>
              
              <div className="w-full max-w-xs bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Transactions</span>
                  <span className="text-sm font-bold text-slate-900">{kpi.totalTransactions}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Revenue</span>
                  <span className="text-sm font-bold text-emerald-600">₵{Number(kpi.totalRevenue).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Encrypted LEDGER</span>
                </div>
              </div>

              <div className="w-full pt-4">
                <PDFDownloadLink
                  document={pdfDoc}
                  fileName={`Datapapa_Report_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
                >
                  {({ loading }) => (
                    loading ? 'Processing...' : <><Download size={18} /> OPEN FULL INTELLIGENCE REPORT</>
                  )}
                </PDFDownloadLink>
              </div>
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
