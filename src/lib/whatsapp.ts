export interface WhatsAppOptions {
  phone?: string;
  message: string;
}

/**
 * Normalizes a phone number to standard Ghana format (233XXXXXXXXX)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  
  // Remove all non-numeric characters
  let cleaned = rawPhone.trim().replace(/\D/g, "");
  
  // Handle start with 0 (standard Ghana local format)
  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.slice(1);
  } 
  // Handle 9-digit numbers (missing lead 0 or international code)
  else if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }
  // Handle 233 variants
  else if (cleaned.startsWith("233")) {
    // If it's like 2330..., remove the 0 after 233
    if (cleaned.startsWith("2330")) {
      cleaned = "233" + cleaned.slice(4);
    }
  }

  // Final check: standard Ghana WhatsApp numbers are 12 digits (233 + 9 digits)
  return cleaned;
}

/**
 * Robustly validates if a phone number matches standard formats (Ghana focused)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic validation: 10 to 15 digits is safe for global, but 12 is typical for Ghana
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Opens WhatsApp native app on mobile or WhatsApp web on desktop
 */
export function openWhatsApp({ phone, message }: WhatsAppOptions) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const encodedMessage = encodeURIComponent(message);
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : "";

  if (isMobile) {
    // Force native app on mobile
    const nativeUrl = normalizedPhone 
      ? `whatsapp://send?phone=${normalizedPhone}&text=${encodedMessage}`
      : `whatsapp://send?text=${encodedMessage}`;
    
    window.location.href = nativeUrl;
    
    // Fallback to wa.me if the app didn't open (monitored by document focus)
    setTimeout(() => {
      if (document.hasFocus()) {
        window.open(`https://wa.me/${normalizedPhone}?text=${encodedMessage}`, "_blank");
      }
    }, 1200);
  } else {
    // Use Web WhatsApp for desktop sessions
    const webUrl = normalizedPhone
      ? `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodedMessage}`
      : `https://web.whatsapp.com/send?text=${encodedMessage}`;
    
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
}
