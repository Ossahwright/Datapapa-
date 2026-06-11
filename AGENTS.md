# Datapapa System & Provider Architecture Guidelines

## CRITICAL PROVIDER ARCHITECTURE CORRECTION

The implementation must reflect the actual provider relationships used by Datapapa.

======================================================
DATAHUBGH ARCHITECTURE

The following services are ALL processed through the SAME DataHubGH account:
1. DATA Bundles
2. BECE Vouchers
3. WASSCE Vouchers

IMPORTANT:
- These services DO NOT use separate API credentials.
- These services DO NOT use separate wallets.
- These services DO NOT use separate provider accounts.

They all use:
- The same DataHubGH API key
- The same DataHubGH account
- The same DataHubGH wallet balance

Therefore:
- When Data is sold: → Debit DataHubGH wallet
- When BECE Voucher is sold: → Debit DataHubGH wallet
- When WASSCE Voucher is sold: → Debit DataHubGH wallet

All three services share the same funding source.

======================================================
HUBTEL ARCHITECTURE

AIRTIME is different.
- Provider: Hubtel
- Funding Source: Hubtel Account
- API: Hubtel Airtime API

When Airtime is sold: → Debit Hubtel account
- Airtime must NOT use DataHubGH.

======================================================
SERVICE ROUTING

- DATA → DataHubGH
- BECE → DataHubGH
- WASSCE → DataHubGH
- AIRTIME → Hubtel

======================================================
DATABASE DESIGN

- Do NOT create separate DataHubGH provider tables.
- Use a simple routing model in the transactions table:
  - `service_type` (Allowed values: `DATA`, `AIRTIME`, `BECE`, `WASSCE`)
  - `provider` (Allowed values: `DATAHUBGH`, `HUBTEL`)

Examples:
- DATA + DATAHUBGH
- BECE + DATAHUBGH
- WASSCE + DATAHUBGH
- AIRTIME + HUBTEL

======================================================
ADMIN DASHBOARD

Display the following fields:
- Service Type
- Provider
- Status
- Amount

Examples:
- DATA | DATAHUBGH
- BECE | DATAHUBGH
- WASSCE | DATAHUBGH
- AIRTIME | HUBTEL

======================================================
REPORTING

Provider Reporting should aggregate:
- DATAHUBGH Revenue (DATA + BECE + WASSCE)
- HUBTEL Revenue (AIRTIME)

This reflects actual wallet consumption and profitability.
