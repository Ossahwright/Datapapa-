/**
 * 📊 OPERATIONAL METRICS HELPER
 * Shared between client and server for consistent timing analysis.
 */

export function calculateExecutionMetrics(tx: any) {
  if (!tx) return null;

  const msToSec = (ms: number) => ms > 0 ? (ms / 1000).toFixed(1) : "0";
  const msToMin = (ms: number) => ms > 0 ? (ms / 60000).toFixed(1) : "0";

  const createdAt = new Date(tx.created_at).getTime();
  const paymentVerifiedAt = tx.payment_verified_at ? new Date(tx.payment_verified_at).getTime() : 0;
  const executionStartedAt = tx.provider_execution_started_at ? new Date(tx.provider_execution_started_at).getTime() : 0;
  const providerAcceptedAt = tx.provider_accepted_at ? new Date(tx.provider_accepted_at).getTime() : 0;
  const deliveredAt = tx.delivered_at ? new Date(tx.delivered_at).getTime() : 0;

  // Metric Calculation
  const metrics = {
    webhook_processing_seconds: paymentVerifiedAt ? msToSec(paymentVerifiedAt - createdAt) : "N/A",
    execution_trigger_seconds: (executionStartedAt && paymentVerifiedAt) ? msToSec(executionStartedAt - paymentVerifiedAt) : "N/A",
    provider_acceptance_seconds: (providerAcceptedAt && executionStartedAt) ? msToSec(providerAcceptedAt - executionStartedAt) : "N/A",
    provider_delivery_minutes: (deliveredAt && providerAcceptedAt) ? msToMin(deliveredAt - providerAcceptedAt) : "N/A",
    total_fulfillment_minutes: (deliveredAt && createdAt) ? msToMin(deliveredAt - createdAt) : "N/A"
  };

  // Bottleneck Detection
  let bottleneck = "None detected";
  const triggerSec = parseFloat(metrics.execution_trigger_seconds);
  const acceptSec = parseFloat(metrics.provider_acceptance_seconds);
  const deliveryMin = parseFloat(metrics.provider_delivery_minutes);

  if (!isNaN(triggerSec) && triggerSec > 10) bottleneck = "Webhook/Orchestration Lag";
  else if (!isNaN(acceptSec) && acceptSec > 10) bottleneck = "DataHub API Latency";
  else if (!isNaN(deliveryMin) && deliveryMin > 45) bottleneck = "Telecom/Provider Queue Delay";

  return { metrics, bottleneck };
}
