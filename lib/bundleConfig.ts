import { findNetworkConfig } from './networkConfig.js';

export interface BundleDefinition {
  id: string;
  displayLabel: string;
  networkId: string;
  providerNetworkKey: string;
  providerCapacity: string;
  price: number;
}

export const BUNDLE_CONFIG: Record<string, BundleDefinition> = {
  // MTN BUNDLES
  MTN_1GB: {
    id: "MTN_1GB",
    displayLabel: "1GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "1",
    price: 6
  },
  MTN_2GB: {
    id: "MTN_2GB",
    displayLabel: "2GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "2",
    price: 12
  },
  MTN_3GB: {
    id: "MTN_3GB",
    displayLabel: "3GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "3",
    price: 18
  },
  MTN_4GB: {
    id: "MTN_4GB",
    displayLabel: "4GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "4",
    price: 24
  },
  MTN_5GB: {
    id: "MTN_5GB",
    displayLabel: "5GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "5",
    price: 30
  },
  MTN_10GB: {
    id: "MTN_10GB",
    displayLabel: "10GB",
    networkId: "MTN",
    providerNetworkKey: "YELLO",
    providerCapacity: "10",
    price: 60
  },

  // AIRTELTIGO PREMIUM (iShare)
  AT_PREMIUM_1GB: {
    id: "AT_PREMIUM_1GB",
    displayLabel: "1GB",
    networkId: "AIRTELTIGO_PREMIUM",
    providerNetworkKey: "AT_PREMIUM",
    providerCapacity: "1",
    price: 6
  },
  AT_PREMIUM_2GB: {
    id: "AT_PREMIUM_2GB",
    displayLabel: "2GB",
    networkId: "AIRTELTIGO_PREMIUM",
    providerNetworkKey: "AT_PREMIUM",
    providerCapacity: "2",
    price: 12
  },
  AT_PREMIUM_5GB: {
    id: "AT_PREMIUM_5GB",
    displayLabel: "5GB",
    networkId: "AIRTELTIGO_PREMIUM",
    providerNetworkKey: "AT_PREMIUM",
    providerCapacity: "5",
    price: 30
  },

  // AIRTELTIGO BIGTIME
  AT_BIGTIME_1GB: {
    id: "AT_BIGTIME_1GB",
    displayLabel: "1GB",
    networkId: "AIRTELTIGO_BIGTIME",
    providerNetworkKey: "AT_BIGTIME",
    providerCapacity: "1",
    price: 6
  },
  AT_BIGTIME_2GB: {
    id: "AT_BIGTIME_2GB",
    displayLabel: "2GB",
    networkId: "AIRTELTIGO_BIGTIME",
    providerNetworkKey: "AT_BIGTIME",
    providerCapacity: "2",
    price: 12
  },
  AT_BIGTIME_5GB: {
    id: "AT_BIGTIME_5GB",
    displayLabel: "5GB",
    networkId: "AIRTELTIGO_BIGTIME",
    providerNetworkKey: "AT_BIGTIME",
    providerCapacity: "5",
    price: 30
  },

  // TELECEL (VODAFONE)
  TELECEL_1GB: {
    id: "TELECEL_1GB",
    displayLabel: "1GB",
    networkId: "TELECEL",
    providerNetworkKey: "VODA",
    providerCapacity: "1",
    price: 6
  },
  TELECEL_2GB: {
    id: "TELECEL_2GB",
    displayLabel: "2GB",
    networkId: "TELECEL",
    providerNetworkKey: "VODA",
    providerCapacity: "2",
    price: 12
  },
  TELECEL_5GB: {
    id: "TELECEL_5GB",
    displayLabel: "5GB",
    networkId: "TELECEL",
    providerNetworkKey: "VODA",
    providerCapacity: "5",
    price: 30
  }
};

export const getNormalizedBundle = (id: string): BundleDefinition | undefined => {
  return BUNDLE_CONFIG[id];
};

/**
 * 🚀 HELPER: FIND BUNDLE BY DISPLAY ATTRIBUTES
 * Used for dynamic normalization when fetching from DB
 */
export const findNormalizedBundle = (networkKey: string, capacity: string): BundleDefinition | undefined => {
  const netInfo = findNetworkConfig(networkKey);
  if (!netInfo) return undefined;
  
  const cleanCap = capacity?.replace(/GB/i, '')?.trim()?.toUpperCase();

  return Object.values(BUNDLE_CONFIG).find(b => {
    // Network must match the resolved network ID
    const netMatch = b.networkId === netInfo.id;
    
    // Capacity must match display label or provider capacity
    const capMatch = 
      b.providerCapacity === cleanCap || 
      b.displayLabel.replace(/GB/i, '') === cleanCap ||
      (b.providerCapacity + "GB") === cleanCap ||
      b.displayLabel.toUpperCase() === cleanCap;
    
    return netMatch && capMatch;
  });
};
