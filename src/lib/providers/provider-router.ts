import { DataHubProvider } from './datahub-provider.js';
import { HubtelProvider } from './hubtel-provider.js';

export class ProviderRouter {
  static getProvider(serviceType: 'DATA' | 'AIRTIME' | 'BECE' | 'WASSCE') {
    if (serviceType === 'AIRTIME') {
      return HubtelProvider;
    }
    return DataHubProvider;
  }

  static getProviderName(serviceType: 'DATA' | 'AIRTIME' | 'BECE' | 'WASSCE'): 'DATAHUBGH' | 'HUBTEL' {
    if (serviceType === 'AIRTIME') {
      return 'HUBTEL';
    }
    return 'DATAHUBGH';
  }

  static async purchase(transaction: any) {
    const serviceType = transaction.service_type || 'DATA';
    const provider = this.getProvider(serviceType);
    return provider.purchase(transaction);
  }

  static async checkStatus(transaction: any) {
    const serviceType = transaction.service_type || 'DATA';
    const provider = this.getProvider(serviceType);
    const reference = transaction.provider_reference || transaction.external_reference || transaction.id;
    return provider.checkStatus(reference);
  }
}
