import { getDataHubConfig } from '../../../lib/config-utils.js';
import axios from 'axios';

export class DataHubProvider {
  static async purchase(transaction: any) {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const serviceType = transaction.service_type || "DATA";
    const recipient = (transaction.recipient_phone || "").trim().replace(/\D/g, "");
    let endpoint = "";
    let payload: any = {};

    const networkKey = transaction.provider_network_key || transaction.datahub_network_key || transaction.network_key;
    const finalCapacity = transaction.provider_capacity || transaction.datahub_capacity || transaction.capacity;

    if (serviceType === "DATA") {
      endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;
      payload = {
        networkKey: networkKey,
        recipient: recipient,
        phone: recipient,
        capacity: finalCapacity,
        plan: finalCapacity,
        amount: parseFloat(transaction.amount),
        reference: transaction.id
      };
    } else {
      endpoint = `${baseUrl.replace(/\/+$/, "")}/voucher-purchase`;
      payload = {
        service_type: serviceType,
        voucher_type: serviceType,
        networkKey: networkKey,
        recipient: recipient,
        phone: recipient,
        capacity: finalCapacity,
        amount: parseFloat(transaction.amount),
        reference: transaction.id
      };
    }

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-Key": apiKey
    };

    console.log(`[DataHub Provider] Calling endpoint: ${endpoint} for tx: ${transaction.id}`);
    
    // Sandbox simulation fallback helper if no apiKey
    if (apiKey === "DEMO_KEY" || !apiKey) {
      return {
        success: true,
        status: "SUCCESSFUL",
        reference: `${serviceType === 'DATA' ? 'DH' : 'VCH'}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        message: `${serviceType} transaction processed successfully (Sandbox)`
      };
    }

    const response = await axios.post(endpoint, payload, { headers, timeout: 30000 });
    return response.data;
  }

  static async checkStatus(reference: string) {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const headers = { "X-API-Key": apiKey, "Accept": "application/json" };
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/status?reference=${reference}`;
    const response = await axios.get(endpoint, { headers, timeout: 10000 });
    return response.data;
  }

  static async getWalletBalance() {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const headers = { "X-API-Key": apiKey, "Accept": "application/json" };
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/balance`;
    const response = await axios.get(endpoint, { headers, timeout: 10000 });
    return response.data;
  }
}
