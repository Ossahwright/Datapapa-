import axios from 'axios';

export class HubtelProvider {
  private static getHeaders() {
    const clientId = process.env.HUBTEL_CLIENT_ID || '';
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET || '';
    const base64Credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64Credentials}`,
      'Accept': 'application/json'
    };
  }

  private static getBaseUrl() {
    return process.env.HUBTEL_BASE_URL || 'https://api.hubtel.com/v1';
  }

  /**
   * 📞 Airtime purchase endpoint or simulated placeholder
   */
  static async purchase(transaction: any) {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;

    // Sandbox simulation fallback helper
    if (!clientId || !clientSecret || clientId === "" || clientSecret === "") {
      console.log("ℹ️ [Hubtel Sandbox] Buying airtime simulator activated for:", transaction.recipient_phone, "Amount:", transaction.amount);
      return {
        success: true,
        status: "SUCCESSFUL",
        reference: `HUB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        message: "Airtime purchase processed successfully (Sandbox Simulator)"
      };
    }

    const endpoint = `${this.getBaseUrl().replace(/\/+$/, '')}/airtime-purchase`;
    const payload = {
      network: transaction.network_key || transaction.network,
      recipient: transaction.recipient_phone,
      amount: parseFloat(transaction.amount),
      client_reference: transaction.id,
      callback_url: process.env.HUBTEL_CALLBACK_URL || ''
    };

    console.log(`[Hubtel Provider] Live purchase triggered at: ${endpoint}`);
    const response = await axios.post(endpoint, payload, {
      headers: this.getHeaders(),
      timeout: 30000
    });
    return response.data;
  }

  /**
   * 📞 Fetch transaction status
   */
  static async checkStatus(reference: string) {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    if (!clientId) {
      return {
        success: true,
        status: "SUCCESSFUL",
        reference,
        message: "Simulated successful airtime status (Sandbox)"
      };
    }

    const endpoint = `${this.getBaseUrl().replace(/\/+$/, '')}/airtime/status/${reference}`;
    const response = await axios.get(endpoint, {
      headers: this.getHeaders(),
      timeout: 15000
    });
    return response.data;
  }

  /**
   * 📞 Check wallet balance
   */
  static async getWalletBalance() {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    if (!clientId) {
      return {
        success: true,
        balance: 1543.20,
        provider: "HUBTEL"
      };
    }

    const endpoint = `${this.getBaseUrl().replace(/\/+$/, '')}/wallet/balance`;
    const response = await axios.get(endpoint, {
      headers: this.getHeaders(),
      timeout: 15000
    });
    return response.data;
  }

  /**
   * 📞 Callback / webhook handling placeholder
   */
  static async handleCallback(payload: any) {
    console.log("[Hubtel Callback Handler] Received payload:", payload);
    return {
      success: true,
      processed: true,
      timestamp: new Date().toISOString()
    };
  }
}
