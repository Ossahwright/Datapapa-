/**
 * Centralized WhatsApp Messaging Utility for Datapapa
 * 
 * Ensures all WhatsApp communications open the direct recipient chat 
 * instead of self-chats or generic screens.
 */

export interface WhatsAppOptions {
  phone: string; // Recipient number
  message: string; // Message content
}

/**
 * STRICT Number Normalization
 * Resolves local Ghana numbers to canonical 233XXXXXXXXX format.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  
  // 1. Strip all non-numeric characters
  let cleaned = rawPhone.trim().replace(/\D/g, "");
  
  // 2. Handle standard local format (starts with 0, 10 digits)
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.slice(1);
  } 
  
  // 3. Handle 9-digit format (missing lead zero)
  else if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }
  
  // 4. International format already correct (starts with 233, 12 digits)
  else if (cleaned.startsWith("233") && cleaned.length === 12) {
    // Already canonical
  }
  
  // 5. Cleanup accidental 2330... double-prefix
  else if (cleaned.startsWith("2330") && cleaned.length === 13) {
    cleaned = "233" + cleaned.slice(4);
  }

  return cleaned;
}

/**
 * STRICT Number Validation
 * Ensures canonical format 233XXXXXXXXX is met.
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  
  // Reject common placeholders/test numbers
  const testNumbers = ["0000000000", "233000000000", "0240000000", "0200000000"];
  if (testNumbers.includes(phone) || testNumbers.includes(normalized)) return false;

  return /^233\d{9}$/.test(normalized);
}

/**
 * Launches DIRECT WhatsApp Customer Chat
 * Uses api.whatsapp.com to ensure reliable redirection and escapes iframe using _blank.
 */
export function openWhatsApp({ phone, message }: WhatsAppOptions) {
  if (!phone) {
    console.error("WhatsApp ERROR: Recipient phone is missing.");
    return;
  }

  const normalized = normalizePhoneNumber(phone);
  
  if (!isValidPhoneNumber(normalized)) {
    console.error("WhatsApp ERROR: Invalid recipient number format.", { original: phone, normalized });
    return;
  }

  const encodedMessage = encodeURIComponent(message);
  
  // 🚀 Use api.whatsapp.com/send - it's the more robust official endpoint for web-originated chats.
  // The 'phone=' parameter is CRITICAL to open the direct customer chat.
  const finalUrl = `https://api.whatsapp.com/send?phone=${normalized}&text=${encodedMessage}`;

  console.log("🚀 Opening WhatsApp direct customer chat:", {
    originalRecipient: phone,
    normalizedRecipient: normalized,
    finalUrl
  });

  // 🛡️ CRITICAL: We use window.open(..., "_blank") to escape the iframe sandbox.
  // Using window.location.href inside an iframe results in a "Refused to connect" 
  // error because WhatsApp blocks loading its target pages within frames.
  window.open(finalUrl, "_blank", "noopener,noreferrer");
}
