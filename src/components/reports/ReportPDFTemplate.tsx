import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register fonts if needed, or use default Helvetica
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyeMZhrib2Bg-4.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI1eMZhrib2Bg-4.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff'
  },
  // Enterprise Header
  headerContainer: {
    flexDirection: 'row',
    borderBottomColor: '#000000',
    borderBottomWidth: 2,
    paddingBottom: 15,
    marginBottom: 20,
  },
  headerLeft: {
    width: '30%',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerCenter: {
    width: '40%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: '30%',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#000000',
  },
  brandSubtitle: {
    fontSize: 8,
    fontWeight: 400,
    color: '#334155',
    marginTop: 2,
  },
  centerMain: {
    fontSize: 10,
    fontWeight: 600,
    color: '#000000',
  },
  centerSub: {
    fontSize: 12,
    fontWeight: 700,
    color: '#000000',
    marginVertical: 2,
    textTransform: 'uppercase',
  },
  centerTagline: {
    fontSize: 7,
    fontWeight: 400,
    color: '#64748b',
  },
  contactText: {
    fontSize: 7,
    color: '#334155',
    marginBottom: 1,
  },
  genDate: {
    fontSize: 7,
    fontWeight: 600,
    color: '#0f172a',
    marginTop: 4,
  },

  // Metadata Block
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#0f172a',
    marginBottom: 8,
    borderLeftColor: '#0f172a',
    borderLeftWidth: 3,
    paddingLeft: 6,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
  },
  metadataItem: {
    width: '33%',
    marginBottom: 6,
  },
  metadataLabel: {
    fontSize: 7,
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  metadataValue: {
    fontSize: 8,
    color: '#0f172a',
    fontWeight: 400,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  kpiCard: {
    width: '24%',
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
  },

  // Intelligence Sections
  intelRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  intelCol: {
    flex: 1,
  },
  intelTable: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  intelHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 6,
  },
  intelHeaderText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 600,
  },
  intelRowItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 6,
  },
  intelCellText: {
    fontSize: 7,
    color: '#334155',
  },

  // Transaction Table
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    borderBottomStyle: 'solid',
    padding: 8,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 700,
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 8,
  },
  tableCell: {
    fontSize: 7,
    color: '#334155',
  },
  groupHeader: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
    borderLeftStyle: 'solid',
    marginTop: 5,
  },
  groupHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#4338ca',
  },

  // Columns widths
  colDate: { width: '15%' },
  colRef: { width: '15%' },
  colNetwork: { width: '15%' },
  colRecipient: { width: '15%' },
  colAmount: { width: '10%' },
  colStatus: { width: '12%' },
  colProvider: { width: '18%' },

  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 6,
    fontWeight: 700,
    textAlign: 'center',
    alignSelf: 'flex-start',
  },
  statusSuccess: { backgroundColor: '#dcfce7', color: '#166534' },
  statusPending: { backgroundColor: '#fef3c7', color: '#92400e' },
  statusFailed: { backgroundColor: '#fee2e2', color: '#991b1b' },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 6,
    color: '#94a3b8',
    fontWeight: 500,
  }
});

interface ReportPDFTemplateProps {
  data: any[];
  kpi: any;
  dateRangeLabel: string;
  generatedBy: string;
  networkStats?: any[];
  deliveryStats?: any[];
}

export const ReportPDFTemplate = ({ 
  data, 
  kpi, 
  dateRangeLabel, 
  generatedBy,
  networkStats = [],
  deliveryStats = []
}: ReportPDFTemplateProps) => {
  const formatMoney = (amount: number) => `GHS ${Number(amount).toFixed(2)}`;
  
  const getStatusStyle = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success' || s === 'delivered' || s === 'fulfilled') return styles.statusSuccess;
    if (s === 'failed' || s === 'provider_rejected' || s === 'error') return styles.statusFailed;
    return styles.statusPending;
  };

  // Grouping logic (by network)
  const groupedData: Record<string, any[]> = {};
  data.slice(0, 100).forEach(tx => {
    const net = String(tx.network || 'Other').toUpperCase();
    if (!groupedData[net]) groupedData[net] = [];
    groupedData[net].push(tx);
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* STEP 1 & 2 — ENTERPRISE HEADER */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandTitle}>DATAPAPA</Text>
            <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.centerMain}>Premium Internet Data Reseller</Text>
            <Text style={styles.centerSub}>Operational Intelligence Ledger</Text>
            <Text style={styles.centerTagline}>Telecom Fulfillment • Digital Distribution • Real-Time Reporting</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contactText}>📍 Accra, Greater Accra, Ghana</Text>
            <Text style={styles.contactText}>✉ support@datapapa.site</Text>
            <Text style={styles.contactText}>🌐 www.datapapa.site</Text>
            <Text style={styles.genDate}>Generated: {format(new Date(), "PPpp")}</Text>
          </View>
        </View>

        {/* STEP 3 — REPORT CONTEXT BLOCK */}
        <Text style={styles.sectionTitle}>Report Metadata</Text>
        <View style={styles.metadataGrid}>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Report Type</Text>
            <Text style={styles.metadataValue}>Transaction Intelligence Ledger</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Filter Range</Text>
            <Text style={styles.metadataValue}>{dateRangeLabel}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Generated By</Text>
            <Text style={styles.metadataValue}>{generatedBy}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Reference ID</Text>
            <Text style={styles.metadataValue}>DP-INT-{Math.random().toString(36).substring(7).toUpperCase()}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Export Node</Text>
            <Text style={styles.metadataValue}>Datapapa System Engine v2.4</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Status</Text>
            <Text style={styles.metadataValue}>Official Intelligence Record</Text>
          </View>
        </View>

        {/* STEP 4 — OPERATIONAL KPI SUMMARY */}
        <Text style={styles.sectionTitle}>Executive Intelligence Summary</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
            <Text style={styles.kpiValue}>{formatMoney(kpi.totalRevenue)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Transactions</Text>
            <Text style={styles.kpiValue}>{kpi.totalTransactions}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Success Rate</Text>
            <Text style={styles.kpiValue}>{((kpi.successCount / Math.max(kpi.totalTransactions, 1)) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Fulfillment (OK)</Text>
            <Text style={styles.kpiValue}>{kpi.successCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>System Refusal (ERR)</Text>
            <Text style={styles.kpiValue}>{kpi.failedCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>MTN Volume</Text>
            <Text style={styles.kpiValue}>{kpi.mtnTransactions || 0}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AirtelTigo Volume</Text>
            <Text style={styles.kpiValue}>{kpi.airtelTigoTransactions || 0}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Telecel Volume</Text>
            <Text style={styles.kpiValue}>{kpi.telecelTransactions || 0}</Text>
          </View>
        </View>

        {/* STEP 5 & 6 — NETWORK & DELIVERY INTELLIGENCE */}
        <View style={styles.intelRow} wrap={false}>
          {/* Network Intelligence */}
          <View style={styles.intelCol}>
            <Text style={styles.sectionTitle}>Network Intelligence</Text>
            <View style={styles.intelTable}>
              <View style={styles.intelHeader}>
                <Text style={[styles.intelHeaderText, { width: '40%' }]}>Network</Text>
                <Text style={[styles.intelHeaderText, { width: '30%' }]}>Volume</Text>
                <Text style={[styles.intelHeaderText, { width: '30%' }]}>Revenue</Text>
              </View>
              {networkStats.map((stat, i) => (
                <View key={i} style={styles.intelRowItem}>
                  <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>{stat.name}</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>{stat.count} items</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>{formatMoney(stat.revenue || 0)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Delivery Intelligence */}
          <View style={styles.intelCol}>
            <Text style={styles.sectionTitle}>Delivery Analytics</Text>
            <View style={styles.intelTable}>
              <View style={styles.intelHeader}>
                <Text style={[styles.intelHeaderText, { width: '40%' }]}>State</Text>
                <Text style={[styles.intelHeaderText, { width: '30%' }]}>Count</Text>
                <Text style={[styles.intelHeaderText, { width: '30%' }]}>Percentage</Text>
              </View>
              {deliveryStats.map((stat, i) => (
                <View key={i} style={styles.intelRowItem}>
                  <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>{stat.name}</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>{stat.value}</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>{((stat.value / Math.max(kpi.totalTransactions, 1)) * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* STEP 7 & 8 — TRANSACTION BREAKDOWN GROUPING */}
        <Text style={styles.sectionTitle}>Detailed Transaction Ledger Intelligence</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Timestamp</Text>
            <Text style={[styles.tableHeaderCell, styles.colRef]}>System Ref</Text>
            <Text style={[styles.tableHeaderCell, styles.colNetwork]}>Fulfillment</Text>
            <Text style={[styles.tableHeaderCell, styles.colRecipient]}>Recipient</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>Fulfillment</Text>
            <Text style={[styles.tableHeaderCell, styles.colProvider]}>External Ref</Text>
          </View>

          {Object.entries(groupedData).map(([network, txs]) => (
            <React.Fragment key={network}>
              <View style={styles.groupHeader} wrap={false}>
                <Text style={styles.groupHeaderText}>{network} SEGMENT ({txs.length} Transactions)</Text>
              </View>
              {txs.map((tx, idx) => {
                const displayStatus = tx.vtu_status || tx.status || 'pending';
                return (
                  <View key={idx} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, styles.colDate]}>
                      {format(new Date(tx.created_at), "yy-MM-dd HH:mm")}
                    </Text>
                    <Text style={[styles.tableCell, styles.colRef]}>
                      {String(tx.id).substring(0, 8).toUpperCase()}
                    </Text>
                    <Text style={[styles.tableCell, styles.colNetwork]}>
                      {String(tx.network).toUpperCase()} {tx.capacity || tx.volume || ''}
                    </Text>
                    <Text style={[styles.tableCell, styles.colRecipient]}>
                      {tx.recipient_phone || 'N/A'}
                    </Text>
                    <Text style={[styles.tableCell, { ...styles.colAmount, fontWeight: 700 }]}>
                      {Number(tx.amount).toFixed(2)}
                    </Text>
                    <View style={styles.colStatus}>
                      <Text style={[styles.statusBadge, getStatusStyle(displayStatus)]}>
                        {String(displayStatus).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, styles.colProvider]}>
                      {tx.provider_reference || tx.datahub_reference || 'INTERNAL'}
                    </Text>
                  </View>
                );
              })}
            </React.Fragment>
          ))}
          
          {data.length > 100 && (
            <View style={{ marginTop: 15, alignSelf: 'center' }}>
              <Text style={{ fontSize: 7, color: '#64748b', fontStyle: 'italic' }}>
                * Operational constraint: Displaying top 100 high-priority intelligence records only.
              </Text>
            </View>
          )}
        </View>

        {/* STEP 9 — PROFESSIONAL FOOTER */}
        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. All Rights Reserved. Confidential Operational Document.</Text>
            <Text style={styles.footerText}>Generated by Datapapa Operational Intelligence Engine • System Instance: DP-SECURE-NODE-GH</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Report Page ${pageNumber} of ${totalPages}`} />
            <Text style={styles.footerText}>Classification: Enterprise Executive-Grade Intelligence</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
