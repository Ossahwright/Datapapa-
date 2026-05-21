/**
 * 🛡️ DATAPAPA AUTHORITATIVE INFRASTRUCTURE CONSTANTS
 * Responsibility: Single source of truth for all operational constants.
 * ALL infrastructure mappings, routes, and states are frozen here.
 */

export const API_ROUTES = Object.freeze({
  PAYSTACK_WEBHOOK: "/api/paystack-webhook",
  DATAHUB_WEBHOOK: "/api/datahub-webhook",
  PAYSTACK_INITIALIZE: "/api/paystack/initialize",
  PROVIDER_HEALTH: "/api/system-status?feature=provider-health",
  INITIATE_TRANSACTION: "/api/initiate-transaction",
  ADMIN_OPS: "/api/admin-ops",
  ADMIN_TX_ACTION: "/api/admin-ops",
  SYNC_WALLET: "/api/admin-ops",
  RECONCILE_TX: "/api/admin-ops",
  BULK_RECONCILE: "/api/admin-ops",
  RETRY_VTU: "/api/admin-ops",
  SYSTEM_STATUS: "/api/system-status"
});

export const PAYMENT_STATUSES = Object.freeze({
  INITIALIZED: "initialized",
  SUCCESS: "success",
  PAYMENT_SUCCESS: "payment_success",
  PAID: "paid",
  FAILED: "failed",
  PENDING: "pending",
  PAYMENT_PENDING: "payment_pending"
});

export const VTU_STATUSES = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  FULFILLMENT_PROCESSING: "fulfillment_processing",
  PROVIDER_EXECUTION_STARTED: "provider_execution_started",
  PROVIDER_ACCEPTED: "provider_accepted",
  AWAITING_PROVIDER_CONFIRMATION: "awaiting_provider_confirmation",
  DELIVERED: "delivered",
  FAILED: "failed",
  SUCCESS: "success",
  COMPLETED: "completed",
  PROVIDER_REJECTED: "provider_rejected",
  RECONCILIATION_PENDING: "reconciliation_pending",
  MANUAL_REVIEW_REQUIRED: "manual_review_required",
  DELAYED_PROVIDER_PROCESSING: "delayed_provider_processing",
  FULFILLED: "fulfilled"
});

export const RECONCILIATION_STATES = Object.freeze({
  PAYMENT_VERIFIED: "payment_verified",
  PAYMENT_VERIFIED_EXECUTION_FAILED: "payment_verified_execution_failed",
  DELAYED_PROVIDER_PROCESSING: "delayed_provider_processing",
  RECONCILIATION_PENDING: "reconciliation_pending",
  MANUAL_REVIEW_REQUIRED: "manual_review_required",
  AWAITING_PROVIDER_CONFIRMATION: "awaiting_provider_confirmation",
  COMPLETED: "completed",
  FAILED: "failed",
  PAYMENT_VERIFICATION_FAILED: "payment_verification_failed"
});


export const EXECUTION_SOURCES = Object.freeze({
  PAYSTACK_WEBHOOK: "paystack_v2_webhook",
  ADMIN_RETRY: "admin_retry",
  RECONCILIATION_ENGINE: "reconciliation_engine",
  DIRECT_API: "direct_api",
  MANUAL_RETRY: "manual_retry"
});

export const NETWORK_KEYS = Object.freeze({
  MTN: "YELLO",
  TELECEL: "TELECEL",
  AT_PREMIUM: "AT_PREMIUM",
  AT_BIGTIME: "AT_BIGTIME",
  VODA: "VODA"
});

export const PROVIDER_HEALTH = Object.freeze({
  OPERATIONAL: "operational",
  DEGRADED: "degraded",
  OUTAGE: "outage",
  UNREACHABLE: "unreachable"
});

export const LOG_MARKERS = Object.freeze({
  PAYSTACK_WEBHOOK_HIT: "=== PAYSTACK WEBHOOK ROUTE HIT ===",
  PAYMENT_PROMOTED: "=== PAYMENT STATUS PROMOTED ===",
  VTU_EXECUTION_STARTED: "=== VTU EXECUTION STARTED ===",
  DELIVERY_CONFIRMED: "=== DELIVERY CONFIRMED ===",
  PROVIDER_HEALTH_CHECK_START: "=== PROVIDER HEALTH CHECK START ===",
  PROVIDER_STATUS_RECEIVED: "=== PROVIDER STATUS RECEIVED ===",
  PROVIDER_DEGRADED: "=== PROVIDER DEGRADED ===",
  PROVIDER_OUTAGE_DETECTED: "=== PROVIDER OUTAGE DETECTED ===",
  PURCHASE_GATING_ACTIVATED: "=== PURCHASE GATING ACTIVATED ==="
});
