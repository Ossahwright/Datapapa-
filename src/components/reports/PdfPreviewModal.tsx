import React from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { ReportPDFTemplate } from './ReportPDFTemplate';
import { Last7DaysReportPDFTemplate } from './Last7DaysReportPDFTemplate';
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
  bundles?: any[];
  rewards?: any[];
  customerStats?: any;
  selectedSections?: {
    coverPage?: boolean;
    kpiSummary?: boolean;
    charts?: boolean;
    bundles?: boolean;
    customers?: boolean;
    rewards?: boolean;
    systemHealth?: boolean;
    transactions?: boolean;
  };
}

export type TemplateType = 'standard' | 'seven-day';

export const PdfPreviewModal = ({ 
  isOpen, 
  onClose, 
  data, 
  kpi, 
  dateRangeLabel, 
  generatedBy,
  networkStats = [],
  deliveryStats = [],
  bundles = [],
  rewards = [],
  customerStats = null,
  selectedSections
}: PdfPreviewModalProps) => {
  const [template, setTemplate] = React.useState<TemplateType>('standard');

  if (!isOpen) return null;

  const handlePrint = () => {
    console.log("=== REPORT PRINT STARTED ===");
    window.print();
  };

  // Determine appropriate PDF Document Component dynamically
  const pdfDoc = template === 'seven-day' ? (
    <Last7DaysReportPDFTemplate 
      data={data}
      generatedBy={generatedBy}
    />
  ) : (
    <ReportPDFTemplate 
      data={data} 
      kpi={kpi} 
      dateRangeLabel={dateRangeLabel} 
      generatedBy={generatedBy}
      networkStats={networkStats}
      deliveryStats={deliveryStats}
      bundles={bundles}
      rewards={rewards}
      customerStats={customerStats}
      selectedSections={selectedSections}
    />
  );

  const getTemplateLabel = () => {
    switch(template) {
      case 'standard': return '360° Comprehensive Dossier';
      case 'seven-day': return 'Last 7 Days Digest';
      default: return 'Custom Report';
    }
  };

  const fileName = `Datapapa_${getTemplateLabel().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/90 backdrop-blur-sm print:hidden">
        <div className="bg-white w-full h-full sm:h-[95vh] sm:max-w-7xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Responsive Header Banner */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 gap-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shrink-0 shadow-lg shadow-indigo-600/20">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-lg sm:text-xl leading-tight text-slate-900">Datapapa Export Portal</h2>
                <p className="text-xs text-slate-500 font-semibold truncate">Active Draft: {getTemplateLabel()}</p>
              </div>
              <button 
                onClick={onClose}
                className="lg:hidden p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 ml-auto"
              >
                <X size={20} />
              </button>
            </div>

            {/* Premium Template Selection Dropdown / Horizontal Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 text-slate-700">
              {[
                { id: 'standard', label: '360° General' },
                { id: 'seven-day', label: '7-Day Quick' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTemplate(opt.id as TemplateType)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                    template === opt.id 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm shrink-0"
              >
                <Printer size={15} /> <span>Print Mode</span>
              </button>

              <PDFDownloadLink
                document={pdfDoc}
                fileName={fileName}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200 text-sm shrink-0"
              >
                {({ loading }) => (
                  loading ? 'Synthesizing...' : <><Download size={15} /> Export PDF</>
                )}
              </PDFDownloadLink>

              <button 
                onClick={onClose}
                className="hidden lg:block p-2 ml-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                title="Close Portal"
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
                  fileName={fileName}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
                >
                  {({ loading }) => (
                    loading ? 'Processing...' : <><Download size={18} /> OPEN FULL INTELLIGENCE REPORT</>
                  )}
                </PDFDownloadLink>
              </div>
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
