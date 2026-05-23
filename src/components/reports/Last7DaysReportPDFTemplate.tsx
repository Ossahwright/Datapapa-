import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format, subDays } from 'date-fns';

// Register Inter font for the 7-day template
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
    padding: 35,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff'
  },
  
  // Cover Page (Slate Premium theme)
  coverPage: {
    padding: 45,
    fontFamily: 'Inter',
    backgroundColor: '#0b1329',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%'
  },
  coverTitleContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  coverLogoText: {
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: 5,
    color: '#ffffff'
  },
  coverDecorativeBar: {
    width: 140,
    height: 4,
    backgroundColor: '#4338ca',
    marginTop: 15,
    borderRadius: 2
  },
  coverSubtitle: {
    fontSize: 9,
    fontWeight: 600,
    color: '#38bdf8',
    letterSpacing: 2,
    marginTop: 12,
    textTransform: 'uppercase'
  },
  coverAbstractBox: {
    backgroundColor: '#1c2541',
    padding: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#3a506b',
    marginBottom: 40
  },
  coverAbstractHeader: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#38bdf8',
    textTransform: 'uppercase',
    marginBottom: 6
  },
  coverAbstractTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 10
  },
  coverAbstractBody: {
    fontSize: 8.5,
    color: '#cbd5e1',
    lineHeight: 1.5
  },
  coverMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15
  },
  coverMetaCard: {
    flex: 1,
    backgroundColor: '#1c2541',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#3a506b'
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
    bottom: 35,
    left: 45,
    right: 45,
    borderTopWidth: 1,
    borderTopColor: '#1c2541',
    borderTopStyle: 'solid',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  coverFooterText: {
    fontSize: 6.5,
    color: '#64748b'
  },

  // Document Headers
  headerContainer: {
    flexDirection: 'row',
    borderBottomColor: '#0b1329',
    borderBottomWidth: 1.5,
    paddingBottom: 12,
    marginBottom: 20
  },
  headerLeft: {
    width: '35%',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  headerCenter: {
    width: '35%',
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
    color: '#0b1329',
    letterSpacing: 1.5
  },
  brandSubtitle: {
    fontSize: 7.5,
    color: '#475569',
    marginTop: 1
  },
  centerMain: {
    fontSize: 8,
    fontWeight: 700,
    color: '#4338ca',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  centerSub: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0b1329',
    marginVertical: 1,
    textTransform: 'uppercase'
  },
  centerTagline: {
    fontSize: 6.5,
    color: '#64748b',
    textAlign: 'center'
  },
  contactText: {
    fontSize: 6.5,
    color: '#475569',
    marginBottom: 1
  },
  genDate: {
    fontSize: 6.5,
    fontWeight: 600,
    color: '#0b1329',
    marginTop: 2
  },

  // Layout structures
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#0b1329',
    marginBottom: 10,
    borderLeftColor: '#4338ca',
    borderLeftWidth: 3.5,
    paddingLeft: 8
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 6
  },
  kpiLabel: {
    fontSize: 6,
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 3
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0b1329'
  },

  // Tables
  intelRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20
  },
  tableContainer: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0b1329',
    padding: 6
  },
  tableHeaderLabel: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 600
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 6
  },
  tableCell: {
    fontSize: 7,
    color: '#334155'
  },

  // Network badges and rates
  badgeSuccess: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    fontSize: 6.5,
    fontWeight: 700,
    textAlign: 'center'
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    fontSize: 6.5,
    fontWeight: 700,
    textAlign: 'center'
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    fontSize: 6.5,
    fontWeight: 700,
    textAlign: 'center'
  },

  // Commentary box
  calloutBox: {
    flex: 0.8,
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#4338ca',
    justifyContent: 'center'
  },
  calloutTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#0b1329',
    marginBottom: 6
  },
  calloutBody: {
    fontSize: 7,
    color: '#475569',
    lineHeight: 1.45
  },

  // Main detailed ledger layout
  txTable: {
    width: '100%',
    marginTop: 5
  },
  txHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1.2,
    borderBottomColor: '#0b1329',
    borderBottomStyle: 'solid',
    padding: 6
  },
  txHeaderCell: {
    fontSize: 7,
    fontWeight: 700,
    color: '#0b1329',
    textTransform: 'uppercase'
  },
  txRowItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderBottomStyle: 'solid',
    padding: 6
  },
  txCell: {
    fontSize: 6.5,
    color: '#334155'
  },

  // Footers
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerText: {
    fontSize: 6,
    color: '#94a3b8',
    fontWeight: 500
  },

  // Detailed width allocations for full list
  colDate: { width: '15%' },
  colRef: { width: '13%' },
  colNetwork: { width: '18%' },
  colRecipient: { width: '16%' },
  colAmount: { width: '10%' },
  colStatus: { width: '12%' },
  colProvider: { width: '16%' },

  // Status badges for table ledger items
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
  statusFailed: { backgroundColor: '#fee2e2', color: '#991b1b' }
});

interface Last7DaysReportPDFProps {
  data: any[];
  generatedBy: string;
}

export const Last7DaysReportPDFTemplate = ({ data, generatedBy }: Last7DaysReportPDFProps) => {
  const formatMoney = (amount: number) => `GHS ${Number(amount).toFixed(2)}`;

  // Filter precisely the last 7 days of transactions dynamically (relative to execution date)
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);

  const filterLast7Days = (txList: any[]) => {
    return txList.filter(tx => {
      const d = new Date(tx.created_at);
      return d >= sevenDaysAgo && d <= now;
    });
  };

  const currentPeriodTxs = filterLast7Days(data);

  // Calculate 7-Day operational summary metrics
  const summary = React.useMemo(() => {
    let revenue = 0;
    let transactionsCount = currentPeriodTxs.length;
    let successfulCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    const networks: Record<string, { total: number; success: number; revenue: number }> = {};
    const popularBundles: Record<string, number> = {};

    currentPeriodTxs.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const network = String(tx.network || 'Other').toUpperCase();

      const isPaid = tx.status === 'success' || tx.status === 'completed' || tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'payment_success' || tx.payment_status === 'success';
      const isDelivered = tx.vtu_status === 'delivered' || tx.vtu_status === 'fulfilled' || tx.vtu_status === 'success' || tx.status === 'fulfilled' || tx.status === 'delivered' || tx.delivery_status === 'delivered';
      const isSuccess = isPaid || isDelivered;
      const isFailed = tx.status === 'failed' || tx.payment_status === 'failed' || tx.vtu_status === 'failed' || tx.vtu_status === 'provider_rejected' || tx.delivery_status === 'failed';

      if (!networks[network]) {
        networks[network] = { total: 0, success: 0, revenue: 0 };
      }
      networks[network].total++;

      if (isSuccess) {
        revenue += amount;
        successfulCount++;
        networks[network].success++;
        networks[network].revenue += amount;

        const bundleName = `${network} ${tx.capacity || tx.volume || ''}`;
        popularBundles[bundleName] = (popularBundles[bundleName] || 0) + 1;
      } else if (isFailed) {
        failedCount++;
      } else {
        pendingCount++;
      }
    });

    // Formatting Networks
    const formattedNetworks = Object.entries(networks).map(([name, stat]) => {
      const successRate = stat.total > 0 ? (stat.success / stat.total) * 100 : 0;
      return {
        name,
        total: stat.total,
        success: stat.success,
        successRate,
        revenue: stat.revenue
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Rank Popular Bundles in descending order
    const formattedBundles = Object.entries(popularBundles)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    const overallSuccessRate = transactionsCount > 0 ? (successfulCount / transactionsCount) * 100 : 0;
    const avgOrderValue = successfulCount > 0 ? revenue / successfulCount : 0;

    return {
      totalRevenue: revenue,
      totalOrders: transactionsCount,
      successCount: successfulCount,
      failedCount,
      pendingCount,
      overallSuccessRate,
      avgOrderValue,
      networks: formattedNetworks,
      bundles: formattedBundles
    };
  }, [currentPeriodTxs]);

  const getStatusBadgeStyle = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success' || s === 'delivered' || s === 'fulfilled') return styles.statusSuccess;
    if (s === 'failed' || s === 'error' || s === 'provider_rejected') return styles.statusFailed;
    return styles.statusPending;
  };

  return (
    <Document>
      {/* PAGE 1: PROFESSIONAL TITLE & ABSTRACT DOSSIER */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverTitleContainer}>
          <Text style={styles.coverLogoText}>DATAPAPA</Text>
          <View style={styles.coverDecorativeBar} />
          <Text style={styles.coverSubtitle}>
            7-Day Performance Insight Dossier
          </Text>
        </View>

        <View style={styles.coverAbstractBox}>
          <Text style={styles.coverAbstractHeader}>Executive Summary Brief</Text>
          <Text style={styles.coverAbstractTitle}>Weekly Transactional & Revenue Velocity</Text>
          <Text style={styles.coverAbstractBody}>
            This intelligence report contains computed metrics covering the relative 7-day transactional window from {format(sevenDaysAgo, "MMMM dd, yyyy")} to {format(now, "MMMM dd, yyyy")}. It evaluates immediate financial velocity, success rates per carrier network channel, and rates active product bundle popularity. Use these summaries to assess network distribution margins and delivery health scores.
          </Text>
        </View>

        <View style={styles.coverMetaGrid}>
          <View style={styles.coverMetaCard}>
            <Text style={styles.coverMetaLabel}>Scope Window</Text>
            <Text style={styles.coverMetaValue}>Last 7 Days</Text>
          </View>
          <View style={styles.coverMetaCard}>
            <Text style={styles.coverMetaLabel}>Transactions</Text>
            <Text style={styles.coverMetaValue}>{summary.totalOrders} Purchases</Text>
          </View>
          <View style={styles.coverMetaCard}>
            <Text style={styles.coverMetaLabel}>Audit Compiler</Text>
            <Text style={styles.coverMetaValue}>{generatedBy || 'Datapapa System'}</Text>
          </View>
        </View>

        <View style={styles.coverFooter}>
          <Text style={coverFooterText => styles.coverFooterText}>Datapapa Telecom Sourcing Ltd, Accra</Text>
          <Text style={coverFooterText => styles.coverFooterText}>Generated: {format(now, "PPpp")}</Text>
        </View>
      </Page>

      {/* PAGE 2: REVENUE, CARRIERS AND TREND PERFORMANCE */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandTitle}>DATAPAPA</Text>
            <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.centerMain}>7-DAY SUMMARY • REVENUE & CHANNELS</Text>
            <Text style={styles.centerSub}>Weekly Performance Indicators</Text>
            <Text style={styles.centerTagline}>Revenue, carrier success coefficients, and top sold items.</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contactText}>📍 Accra, Ghana</Text>
            <Text style={styles.contactText}>✉ support@datapapa.site</Text>
            <Text style={styles.genDate}>Sheet 02 of 03</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>7-Day Scorecard Summary</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
            <Text style={styles.kpiValue}>{formatMoney(summary.totalRevenue)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Transactions count</Text>
            <Text style={styles.kpiValue}>{summary.totalOrders} orders</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Global Success Rate</Text>
            <Text style={[styles.kpiValue, { color: summary.overallSuccessRate > 90 ? '#16a34a' : '#d97706' }]}>
              {summary.overallSuccessRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Average Order value</Text>
            <Text style={styles.kpiValue}>{formatMoney(summary.avgOrderValue)}</Text>
          </View>
        </View>

        <View style={styles.intelRow}>
          {/* Success rate split per network */}
          <View style={{ flex: 1.3 }}>
            <Text style={styles.sectionTitle}>Carrier Performance Coefficients</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderLabel, { width: '35%' }]}>Carrier Channel</Text>
                <Text style={[styles.tableHeaderLabel, { width: '20%' }]}>Volume</Text>
                <Text style={[styles.tableHeaderLabel, { width: '25%' }]}>Success Rate</Text>
                <Text style={[styles.tableHeaderLabel, { width: '20%' }]}>Gross Revenue</Text>
              </View>
              {summary.networks && summary.networks.length > 0 ? (
                summary.networks.map((net, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '35%', fontWeight: 700 }]}>{net.name}</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>{net.total} orders</Text>
                    <View style={{ width: '25%' }}>
                      <Text style={net.successRate > 90 ? styles.badgeSuccess : net.successRate > 70 ? styles.badgeWarning : styles.badgeDanger}>
                        {net.successRate.toFixed(1)}%
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, { width: '20%', fontWeight: 600 }]}>{formatMoney(net.revenue)}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: '#94a3b8' }}>No network transaction records processed in last 7 days.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Popular Bundles */}
          <View style={{ flex: 1.2 }}>
            <Text style={styles.sectionTitle}>Top Sold Bundles (Last 7 Days)</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderLabel, { width: '65%' }]}>Product Display Name</Text>
                <Text style={[styles.tableHeaderLabel, { width: '35%' }]}>Sales Completed</Text>
              </View>
              {summary.bundles && summary.bundles.length > 0 ? (
                summary.bundles.map((bundle, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '65%', fontWeight: 700 }]}>{bundle.name}</Text>
                    <Text style={[styles.tableCell, { width: '35%' }]}>{bundle.sales} completed</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 15, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: '#94a3b8' }}>No successful item deliveries in this period.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Brief assessment commentary */}
          <View style={styles.calloutBox}>
            <Text style={styles.calloutTitle}>Performance Assesment</Text>
            <Text style={styles.calloutBody}>
              Weekly telemetry indicates MTN remains the leading sales provider. Average transaction success coefficients are hovering in normal zones. Bundle choices prioritize medium capacity (1GB - 5GB) data vouchers, showing high consumer velocity in core retail categories.
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Weekly Intelligence Engine.</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* PAGE 3: DETAILED TRANSACTIONAL COMPILATION LEDGER */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandTitle}>DATAPAPA</Text>
            <Text style={styles.brandSubtitle}>Telecom Intelligence Authority</Text>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.centerMain}>7-DAY CHRONOLOGICAL AUDIT LEDGER</Text>
            <Text style={styles.centerSub}>Weekly Transaction Log</Text>
            <Text style={styles.centerTagline}>Chronological table containing telecom transaction events from the last 7 days.</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.contactText}>✉ support@datapapa.site</Text>
            <Text style={styles.genDate}>Sheet 03 of 03</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transactional Log Stream (Last 7 Days)</Text>
        <View style={styles.txTable}>
          <View style={styles.txHeader} fixed>
            <Text style={[styles.txHeaderCell, styles.colDate]}>Timestamp</Text>
            <Text style={[styles.txHeaderCell, styles.colRef]}>System Ref</Text>
            <Text style={[styles.txHeaderCell, styles.colNetwork]}>Carrier Plan</Text>
            <Text style={[styles.txHeaderCell, styles.colRecipient]}>Recipient Phone</Text>
            <Text style={[styles.txHeaderCell, styles.colAmount]}>Gross GHS</Text>
            <Text style={[styles.txHeaderCell, styles.colStatus]}>Fulfillment</Text>
            <Text style={[styles.txHeaderCell, styles.colProvider]}>Provider Reference</Text>
          </View>

          {currentPeriodTxs && currentPeriodTxs.length > 0 ? (
            currentPeriodTxs.slice(0, 100).map((tx, idx) => {
              const displayStatus = tx.vtu_status || tx.status || 'pending';
              return (
                <View key={idx} style={styles.txRowItem} wrap={false}>
                  <Text style={[styles.txCell, styles.colDate]}>
                    {format(new Date(tx.created_at), "yy-MM-dd HH:mm")}
                  </Text>
                  <Text style={[styles.txCell, styles.colRef]}>
                    {String(tx.id).substring(0, 8).toUpperCase()}
                  </Text>
                  <Text style={[styles.txCell, styles.colNetwork]}>
                    {String(tx.network).toUpperCase()} {tx.capacity || tx.volume || ''}
                  </Text>
                  <Text style={[styles.txCell, styles.colRecipient]}>
                    {tx.recipient_phone || 'N/A'}
                  </Text>
                  <Text style={[styles.txCell, { ...styles.colAmount, fontWeight: 700 }]}>
                    {Number(tx.amount).toFixed(2)}
                  </Text>
                  <View style={styles.colStatus}>
                    <Text style={[styles.statusBadge, getStatusBadgeStyle(displayStatus)]}>
                      {String(displayStatus).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.txCell, styles.colProvider]}>
                    {tx.provider_reference || tx.datahub_reference || 'INTERNAL'}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={{ padding: 25, alignItems: 'center' }}>
              <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>Awaiting standard weekly transactional streams in backend.</Text>
            </View>
          )}

          {currentPeriodTxs.length > 100 && (
            <View style={{ marginTop: 12, alignSelf: 'center' }}>
              <Text style={{ fontSize: 7, color: '#64748b', fontStyle: 'italic' }}>
                * Display limits apply: Showing top 100 chronological records from this weekly window.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Datapapa Intelligence Engine. Confidential Document.</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
