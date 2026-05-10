
export type NetworkId = 'MTN' | 'AIRTELTIGO_PREMIUM' | 'AIRTELTIGO_BIGTIME' | 'TELECEL';

export interface NetworkInfo {
  id: NetworkId;
  label: string;
  provider: string; // The backend/database identifier
  networkKey: string; // The DataHubGH API identifier
}

export const NETWORK_CONFIG: Record<NetworkId, NetworkInfo> = {
  MTN: {
    id: "MTN",
    label: "MTN",
    provider: "mtn",
    networkKey: "YELLO"
  },

  AIRTELTIGO_PREMIUM: {
    id: "AIRTELTIGO_PREMIUM",
    label: "AirtelTigo-iShare",
    provider: "airteltigo",
    networkKey: "AT_PREMIUM"
  },

  AIRTELTIGO_BIGTIME: {
    id: "AIRTELTIGO_BIGTIME",
    label: "AirtelTigo-Bigtime",
    provider: "airteltigo",
    networkKey: "AT_BIGTIME"
  },

  TELECEL: {
    id: "TELECEL",
    label: "Telecel",
    provider: "telecel",
    networkKey: "TELECEL"
  }
};

export const NETWORKS = Object.values(NETWORK_CONFIG);

/**
 * Helper to find network config by any legacy identifier or provider-specific key
 */
export const findNetworkConfig = (identifier: string): NetworkInfo | undefined => {
  if (!identifier) return undefined;
  const clean = identifier.toUpperCase().trim().replace(/[-\s]/g, '_');
  
  // 1. Try direct ID match
  if (NETWORK_CONFIG[clean as NetworkId]) return NETWORK_CONFIG[clean as NetworkId];

  // 2. Try matching by provider value (e.g., 'mtn', 'airteltigo')
  const byProvider = NETWORKS.find(n => n.provider.toUpperCase() === clean);
  if (byProvider) return byProvider;

  // 3. Try matching by networkKey (e.g., 'YELLO', 'AT_PREMIUM')
  const byKey = NETWORKS.find(n => n.networkKey.toUpperCase() === clean);
  if (byKey) return byKey;

  // 4. Try matching by Label
  const byLabel = NETWORKS.find(n => n.label.toUpperCase().replace(/[-\s]/g, '_') === clean);
  if (byLabel) return byLabel;

  // 5. Special case for common legacy strings
  if (clean === 'AIRTELTIGO' || clean === 'AT' || clean === 'AT_ISHARE') return NETWORK_CONFIG.AIRTELTIGO_PREMIUM;
  if (clean === 'VODAFONE') return NETWORK_CONFIG.TELECEL;

  return undefined;
};
