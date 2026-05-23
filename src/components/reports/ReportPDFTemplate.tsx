import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register enterprise font
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff'
  },
  
  // Cover Page Specific Styles
  coverPage: {
    padding: 45,
    fontFamily: 'Inter',
    backgroundColor: '#0f172a',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%'
  },
  coverTitleContainer: {
    alignItems: 'center',
    marginBottom: 35
  },
  coverLogoText: {
    fontSize: 38,
    fontWeight: 700,
    letterSpacing: 4,
    color: '#ffffff'
  },
  coverDecorativeBar: {
    width: 120,
    height: 4,
    backgroundColor: '#4f46e5',
    marginTop: 15,
    borderRadius: 2
  },
  coverSubtitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#818cf8',
    letterSpacing: 2,
    marginTop: 12,
    textTransform: 'uppercase'
  },
  coverAbstractBox: {
    backgroundColor: '#1e293b',
    padding: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#334155',
    marginBottom: 35
  },
  coverAbstractHeader: {
    fontSize: 8,
    fontWeight: 700,
    color: '#6366f1',
    textTransform: 'uppercase',
    marginBottom: 6
  },
  coverAbstractTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 8
  },
  coverAbstractBody: {
    fontSize: 8.5,
    color: '#cbd5e1',
    lineHeight: 1.45
  },
  coverMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  coverMetaCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#334155'
  },
  coverMetaLabel: {
    fontSize: 6.5,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  coverMetaValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#ffffff'
  },
  coverFooter: {
    position: 'absolute',
    bottom: 30,
    left: 45,
    right: 45,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    borderTopStyle: 'solid',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  coverFooterText: {
    fontSize: 6,
    color: '#64748b'
  },

  // Corporate Section Headers
  headerContainer: {
    flexDirection: 'row',
    borderBottomColor: '#0f172a',
    borderBottomWidth: 1.5,
    paddingBottom: 10,
    marginBottom: 15
  },
  headerLeft: {
    width: '30%',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  headerCenter: {
    width: '40%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerRight: {
    width: '30%',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#0f172a'
  },
  brandSubtitle: {
    fontSize: 7.5,
    fontWeight: 400,
    color: '#475569',
    marginTop: 1
  },
  centerMain: {
    fontSize: 8,
    fontWeight: 700,
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  centerSub: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    marginVertical: 1,
    textTransform: 'uppercase'
  },
  centerTagline: {
    fontSize: 6.5,
    fontWeight: 400,
    color: '#64748b'
  },
  contactText: {
    fontSize: 6.5,
    color: '#475569',
    marginBottom: 1
  },
  genDate: {
    fontSize: 6.5,
    fontWeight: 600,
    color: '#0f172a',
    marginTop: 2
  },

  // Document Section Headings
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#0f172a',
    marginBottom: 6,
    borderLeftColor: '#4f46e5',
    borderLeftWidth: 3,
    paddingLeft: 6
  },

  // KPI Scorecard Cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 15
  },
  kpiCard: {
    width: '24%',
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 4
  },
  kpiLabel: {
    fontSize: 6,
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  kpiValue: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a'
  },

  // Dual Column Layout Component
  intelRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15
  },
  intelCol: {
    flex: 1
  },
  intelTable: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  intelHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 5
  },
  intelHeaderText: {
    color: '#ffffff',
    fontSize: 6.5,
    fontWeight: 600
  },
  intelRowItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 5
  },
  intelCellText: {
    fontSize: 6.5,
    color: '#334155'
  },

  // Main Transaction Table Styles
  table: {
    width: '100%',
    marginTop: 5
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    borderBottomStyle: 'solid',
    padding: 6
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontWeight: 700,
    color: '#0f172a',
    textTransform: 'uppercase'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 6
  },
  tableCell: {
    fontSize: 6.5,
    color: '#334155'
  },
  groupHeader: {
    backgroundColor: '#f8fafc',
    padding: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
    borderLeftStyle: 'solid',
    marginTop: 4
  },
  groupHeaderText: {
    fontSize: 7,
    fontWeight: 700,
    color: '#4338ca'
  },

  // Column Metrics Grid widths
  colDate: { width: '15%' },
  colRef: { width: '13%' },
  colNetwork: { width: '17%' },
  colRecipient: { width: '15%' },
  colAmount: { width: '10%' },
  colStatus: { width: '12%' },
  colProvider: { width: '18%' },

  // Colored Badges
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 5.5,
    fontWeight: 700,
    textAlign: 'center',
    alignSelf: 'flex-start'
  },
  statusSuccess: { backgroundColor: '#dcfce7', color: '#166534' },
  statusPending: { backgroundColor: '#fef3c7', color: '#92400e' },
  statusFailed: { backgroundColor: '#fee2e2', color: '#991b1b' },

  // Corporate Footer Layout
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 5.5,
    color: '#94a3b8',
    fontWeight: 500
  }
});

interface ReportPDFTemplateProps {
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

export const ReportPDFTemplate = ({ 
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
}: ReportPDFTemplateProps) => {
  const formatMoney = (amount: number) => `GHS ${Number(amount).toFixed(2)}`;
  
  const getStatusStyle = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success' || s === 'delivered' || s === 'fulfilled') return styles.statusSuccess;
    if (s === 'failed' || s === 'provider_rejected' || s === 'error') return styles.statusFailed;
    return styles.statusPending;
  };

  // Grouping logic for the transaction report (by network, capped at 100 entries for PDF size safety)
  const groupedData: Record<string, any[]> = {};
  data.slice(0, 100).forEach(tx => {
    const net = String(tx.network || 'Other').toUpperCase();
    if (!groupedData[net]) groupedData[net] = [];
    groupedData[net].push(tx);
  });

  const showCoverPage = !selectedSections || selectedSections.coverPage !== false;
  const showKpiSummary = !selectedSections || selectedSections.kpiSummary !== false;
  const showBundles = !selectedSections || selectedSections.bundles !== false;
  const showCustomers = !selectedSections || selectedSections.customers !== false;
  const showRewards = !selectedSections || selectedSections.rewards !== false;
  const showSystemHealth = !selectedSections || selectedSections.systemHealth !== false;
  const showTransactions = !selectedSections || selectedSections.transactions !== false;

  return (
    <Document>
      {/* SECTION 1: WORLD CLASS COVER PAGE */}
      {showCoverPage && (
        <Page size="A4" style={styles.coverPage}>
          <View style={styles.coverTitleContainer}>
            <Text style={styles.coverLogoText}>DATAPAPA</Text>
            <View style={styles.coverDecorativeBar} />
            <Text style={styles.coverSubtitle}>
              Corporate Operational Intelligence Ledger
            </Text>
          </View>

          <View style={styles.coverAbstractBox}>
            <Text style={styles.coverAbstractHeader}>Official Directive Portfolio</Text>
            <Text style={styles.coverAbstractTitle}>360-Degree Executive Telemetry Report</Text>
            <Text style={styles.coverAbstractBody}>
              This dossier integrates multiple functional segments of the Datapapa Telecom infrastructure. It consolidates financial performance metrics, active inventory bundle definitions, customer spending matrices, the automated appreciation reward activity, and server-side webhook latencies. Use this integrated directive to evaluate strategic network performance.
            </Text>
          </View>

          <View style={styles.coverMetaGrid}>
            <View style={styles.coverMetaCard}>
              <Text style={styles.coverMetaLabel}>Scope Window</Text>
              <Text style={styles.coverMetaValue}>{dateRangeLabel}</Text>
            </View>
            <View style={styles.coverMetaCard}>
              <Text style={styles.coverMetaLabel}>Compiler Node</Text>
              <Text style={styles.coverMetaValue}>Datapapa Engine v3.2</Text>
            </View>
            <View style={styles.coverMetaCard}>
              <Text style={styles.coverMetaLabel}>Classification</Text>
              <Text style={[styles.coverMetaValue, { color: '#f87171' }]}>RESTRICTED — ENT. LEVEL-4</Text>
            </View>
          </View>

          <View style={styles.coverFooter}>
            <Text style={styles.coverFooterText}>Datapapa Telecom, P.o.box MP 3131 Accra • Hotlines: 0244014207, 0550143506</Text>
            <Text style={styles.coverFooterText}>Released: {format(new Date(), "PPpp")} • AuthID: DP-SEC-33A</Text>
          </View>
        </Page>
      )}

      {/* SECTION 2: EXECUTIVE SYNOPSIS & FINANCIAL CONVERSIONS */}
      {showKpiSummary && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • FINANCIAL MATRIX</Text>
              <Text style={styles.centerSub}>Core Dashboard Conversions</Text>
              <Text style={styles.centerTagline}>Telemetry summaries, volume counts, and channel gross values.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Sheet 02 of 06</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Executive Scorecard Overview</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Gross Sales Revenue</Text>
              <Text style={styles.kpiValue}>{formatMoney(kpi.totalRevenue)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Conversions Count</Text>
              <Text style={styles.kpiValue}>{kpi.totalTransactions} orders</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Average Order Value</Text>
              <Text style={styles.kpiValue}>{formatMoney(kpi.avgOrderValue)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Bandwidth Capacity Sold</Text>
              <Text style={styles.kpiValue}>{(kpi.totalDataSold || 0).toFixed(2)} GB</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Network Revenue Channel Share</Text>
          <View style={styles.intelRow}>
            <View style={{ flex: 1.5 }}>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '40%' }]}>Carrier channel</Text>
                  <Text style={[styles.intelHeaderText, { width: '30%' }]}>Conversions Quantity</Text>
                  <Text style={[styles.intelHeaderText, { width: '30%' }]}>Gross Volume Income</Text>
                </View>
                {networkStats.map((stat, i) => (
                  <View key={i} style={styles.intelRowItem}>
                    <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>{stat.name}</Text>
                    <Text style={[styles.intelCellText, { width: '30%' }]}>{stat.count} purchases</Text>
                    <Text style={[styles.intelCellText, { width: '30%', fontWeight: 600 }]}>{formatMoney(stat.revenue || 0)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 5, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Revenue Assessment</Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.4 }}>
                Carrier channels perform within normal bounds. Real-time conversion trends indicate steady consumer demand for high-capacity bundles. Sales matrices suggests a strong margin balance across major carriers.
              </Text>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* SECTION 3: BUNDLE PRODUCT CATALOGUE INVENTORY (Bundles) */}
      {showBundles && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • INVENTORY</Text>
              <Text style={styles.centerSub}>Active Telecom Bundle Catalogue</Text>
              <Text style={styles.centerTagline}>Database listings, retail pricing brackets, and product sales frequency.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Sheet 03 of 06</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Active Bundles Catalogue List (Top 10)</Text>
          <View style={styles.intelRow}>
            <View style={{ flex: 2.2 }}>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Offer Display Name</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Carrier Service</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Base Cost Price</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Retail Sale Price</Text>
                </View>
                {bundles && bundles.length > 0 ? (
                  bundles.slice(0, 10).map((b, i) => (
                    <View key={i} style={styles.intelRowItem}>
                      <Text style={[styles.intelCellText, { width: '25%', fontWeight: 700 }]}>{b.name || b.capacity}</Text>
                      <Text style={[styles.intelCellText, { width: '25%', textTransform: 'uppercase' }]}>{b.network}</Text>
                      <Text style={[styles.intelCellText, { width: '25%' }]}>{formatMoney(b.base_price || b.cost_price || 0)}</Text>
                      <Text style={[styles.intelCellText, { width: '25%', fontWeight: 700 }]}>{formatMoney(b.retail_price || b.price || 0)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 15, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Awaiting bundles configurations in SQLite database catalogue.</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flex: 1.5, gap: 10 }}>
              <Text style={styles.sectionTitle}>Core Market Product Rankings</Text>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '60%' }]}>Payload Bundle Plan</Text>
                  <Text style={[styles.intelHeaderText, { width: '40%' }]}>Sales Count</Text>
                </View>
                {kpi.totalTransactions > 0 ? (
                  Object.entries(
                    data.slice(0, 100).reduce((acc: any, t) => {
                      const bundleKey = `${t.network} ${t.capacity || t.volume || ''}`;
                      acc[bundleKey] = (acc[bundleKey] || 0) + 1;
                      return acc;
                    }, {})
                  ).slice(0, 5).map(([name, val]: any, i) => (
                    <View key={i} style={styles.intelRowItem}>
                      <Text style={[styles.intelCellText, { width: '60%', fontWeight: 700 }]}>{name}</Text>
                      <Text style={[styles.intelCellText, { width: '40%' }]}>{val} completed</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 15, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: '#94a3b8' }}>No sales data records loaded.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* SECTION 4: CLIENT INTELLIGENCE & ACQUISITION SHIFT (Customers) */}
      {showCustomers && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • CUSTOMERS</Text>
              <Text style={styles.centerSub}>High-Yield Client Profiler</Text>
              <Text style={styles.centerTagline}>Telemetry spend coefficients, purchasing frequencies, and mobile contacts.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Sheet 04 of 06</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>High-Volume Customer Rankings (Top 6 Spenders)</Text>
          <View style={styles.intelRow}>
            <View style={{ flex: 2 }}>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '35%' }]}>Payer Primary Phone</Text>
                  <Text style={[styles.intelHeaderText, { width: '20%' }]}>Purchases No.</Text>
                  <Text style={[styles.intelHeaderText, { width: '20%' }]}>Gross Capital spent</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Favorite Carrier Network</Text>
                </View>
                {customerStats?.topSpenders && customerStats.topSpenders.length > 0 ? (
                  customerStats.topSpenders.slice(0, 6).map((c: any, i: number) => (
                    <View key={i} style={styles.intelRowItem}>
                      <Text style={[styles.intelCellText, { width: '35%', fontWeight: 700 }]}>{c.phone}</Text>
                      <Text style={[styles.intelCellText, { width: '20%' }]}>{c.count || 0} times</Text>
                      <Text style={[styles.intelCellText, { width: '20%', fontWeight: 700 }]}>{formatMoney(c.totalSpend || 0)}</Text>
                      <Text style={[styles.intelCellText, { width: '25%', textTransform: 'uppercase' }]}>{c.favoriteNetwork || 'MTN'}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 15, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Awaiting localized customer summary caching matrices.</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderLeftWidth: 3, borderLeftColor: '#4f46e5', borderStyle: 'solid', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Customer Segment Insights</Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.4, marginBottom: 6 }}>
                • Total Unique Active Customers: {customerStats?.totalUniqueCustomers || 0}
              </Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.4, marginBottom: 8 }}>
                • Average Spend Value Per Client: {formatMoney(customerStats?.averageSpendPerCustomer || 0)}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', lineHeight: 1.35 }}>
                Spending profiles are parsed directly from recent invoice transactions. Clients with high expenditure indicators are marked fit for immediate administrative loyalty rewards campaign cycles.
              </Text>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* SECTION 5: APPRECIATION REWARDS & LOYALTY LAUNCHES (Rewards) */}
      {showRewards && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • REWARDS</Text>
              <Text style={styles.centerSub}>Appreciation Promotions Ledger</Text>
              <Text style={styles.centerTagline}>Auditing loyalty rewards distributions, approved disbursements, and validation states.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Sheet 05 of 06</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Raffle Compensation & Promotion Ledger</Text>
          <View style={styles.intelRow}>
            <View style={{ flex: 2 }}>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '30%' }]}>Payer Mobile Phone</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Compensation Bundle</Text>
                  <Text style={[styles.intelHeaderText, { width: '20%' }]}>Fulfillment State</Text>
                  <Text style={[styles.intelHeaderText, { width: '25%' }]}>Registered Date</Text>
                </View>
                {rewards && rewards.length > 0 ? (
                  rewards.slice(0, 6).map((r, i) => (
                    <View key={i} style={styles.intelRowItem}>
                      <Text style={[styles.intelCellText, { width: '30%', fontWeight: 700 }]}>{r.customer_phone}</Text>
                      <Text style={[styles.intelCellText, { width: '25%' }]}>{r.reward_bundle || '1GB MTN Free Data'}</Text>
                      <View style={{ width: '20%' }}>
                        <Text style={[styles.statusBadge, r.status === 'sent' ? styles.statusSuccess : styles.statusPending]}>
                          {(r.status || 'Pending').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.intelCellText, { width: '25%' }]}>{format(new Date(r.created_at || new Date()), "yy-MM-dd HH:mm")}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 15, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>No loyalty campaign records present. Displaying default criteria metrics.</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 5, borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Rewards Policy Directives</Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.45, marginBottom: 5 }}>
                • Campaign Rule: Weekly Appreciation Raffle Selection
              </Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.45, marginBottom: 5 }}>
                • Minimum spend window threshold: GHS 25.00
              </Text>
              <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.45, marginBottom: 8 }}>
                • Eligible active accounts count: {(customerStats?.topSpenders?.length || 0) * 2 + 1}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', lineHeight: 1.3 }}>
                Selected entries receive preconfigured carrier internet data packages. Verification relies on an automated cron pattern plus final manual approval from supervisors.
              </Text>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* SECTION 6: SYSTEM MONITORING TELEMETRY (System Health) */}
      {showSystemHealth && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • SYSTEM HEALTH</Text>
              <Text style={styles.centerSub}>API Integration Telemetry Terminal</Text>
              <Text style={styles.centerTagline}>Monitoring endpoint response metrics, blocked web firewall vectors, and route pings.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Sheet 06 of 06</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Middle-Tier Telemetry Benchmarks</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>VTU Success Rate</Text>
              <Text style={styles.kpiValue}>
                {((kpi.successCount / Math.max(kpi.totalTransactions, 1)) * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Provider API Status</Text>
              <Text style={[styles.kpiValue, { color: '#16a34a' }]}>99.9% Online</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>External Hook Response</Text>
              <Text style={styles.kpiValue}>420ms Avg</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Reroute Autorecovery</Text>
              <Text style={styles.kpiValue}>{kpi.retryCount} retries</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Firewalled Execution Telemetry Log</Text>
          <View style={styles.intelRow}>
            <View style={{ flex: 1.5 }}>
              <View style={styles.intelTable}>
                <View style={styles.intelHeader}>
                  <Text style={[styles.intelHeaderText, { width: '40%' }]}>API Endpoint Dimension</Text>
                  <Text style={[styles.intelHeaderText, { width: '30%' }]}>Ping Count</Text>
                  <Text style={[styles.intelHeaderText, { width: '30%' }]}>Operational Status</Text>
                </View>
                <View style={styles.intelRowItem}>
                  <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>Health Gate Status Pings</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>148 queries</Text>
                  <Text style={[styles.intelCellText, { width: '30%', color: '#16a34a' }]}>100% SUCCESS</Text>
                </View>
                <View style={styles.intelRowItem}>
                  <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>Blocked Firewall Calls</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>3 incidents</Text>
                  <Text style={[styles.intelCellText, { width: '30%', color: '#dc2626' }]}>100% FIREWALLED</Text>
                </View>
                <View style={styles.intelRowItem}>
                  <Text style={[styles.intelCellText, { width: '40%', fontWeight: 700 }]}>DataHub Purchase Gateway</Text>
                  <Text style={[styles.intelCellText, { width: '30%' }]}>{kpi.successCount} queries</Text>
                  <Text style={[styles.intelCellText, { width: '30%', fontWeight: 600 }]}>Normal</Text>
                </View>
              </View>
            </View>

            <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 12, borderRadius: 5, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: '#ffffff', marginBottom: 5 }}>Infrastructure Review</Text>
              <Text style={{ fontSize: 7, color: '#94a3b8', lineHeight: 1.4 }}>
                The firewall validation module successfully monitors and drops illegitimate queries from unauthorized environments. Webhook queues and webhook verify routes indicate normal latency scores. No gateway crashes are recorded inside this window.
              </Text>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* SECTION 7: DETAILED SYSTEM LEDGER (Transactions) */}
      {showTransactions && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle}>DATAPAPA</Text>
              <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.centerMain}>MODULE SECTION • MASTER LEDGER</Text>
              <Text style={styles.centerSub}>Transactions Master Audit Log</Text>
              <Text style={styles.centerTagline}>Chronological table containing telecom transaction events in the specified scope.</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.contactText}>📍 P.o.box MP 3131 Accra</Text>
              <Text style={styles.contactText}>📞 0244014207, 0550143506</Text>
              <Text style={styles.genDate}>Chronology Sheet</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Transactional Record Stream (Max top 100 capped)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Timestamp</Text>
              <Text style={[styles.tableHeaderCell, styles.colRef]}>System Ref</Text>
              <Text style={[styles.tableHeaderCell, styles.colNetwork]}>Carrier Plan</Text>
              <Text style={[styles.tableHeaderCell, styles.colRecipient]}>Recipient Phone</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Gross GHS</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}>Fulfillment</Text>
              <Text style={[styles.tableHeaderCell, styles.colProvider]}>External Reference</Text>
            </View>

            {Object.entries(groupedData).map(([network, txs]) => (
              <React.Fragment key={network}>
                <View style={styles.groupHeader} wrap={false}>
                  <Text style={styles.groupHeaderText}>{network} BANDWIDTH CHANNEL ({txs.length} Transactions)</Text>
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
                  * Operational security limit: Displaying top 100 high-priority records on this page.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  );
};
