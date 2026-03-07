/**
 * WhatsApp Integration utilities
 */

export interface WhatsAppMessage {
  phone: string; // Egypt: +201234567890 or 01234567890
  text?: string;
  documentUrl?: string; // URL to invoice PDF
}

/**
 * Format phone number for WhatsApp
 * Converts Egyptian format (01x) to international (+20xx)
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return "";

  let cleaned = phone.replace(/\D/g, ""); // Remove non-digits

  // Handle Egyptian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.substring(1); // 01234567890 → 201234567890
  }

  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

/**
 * Generate WhatsApp message for invoice
 */
export function generateInvoiceMessage(
  customerName: string,
  invoiceId: number,
  total: number,
  invoiceUrl?: string,
): string {
  const message = `مرحباً ${customerName},

إليك فاتورتك:
رقم الفاتورة: #${invoiceId}
الإجمالي: ${total.toLocaleString()} ج.م

${invoiceUrl ? `الرابط: ${invoiceUrl}` : ""}

شكراً لتعاملك معنا!`;

  return message;
}

/**
 * Open WhatsApp chat with pre-filled message
 * Works in browser (WhatsApp Web)
 */
export function openWhatsAppChat(phone: string, message?: string): void {
  if (!phone) {
    alert("رقم التليفون مفقود");
    return;
  }

  const formattedPhone = formatWhatsAppPhone(phone);
  const baseUrl = "https://wa.me/";
  let url = `${baseUrl}${formattedPhone.replace("+", "")}`;

  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }

  // Open in new tab
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Send WhatsApp message (requires WhatsApp Desktop app)
 * For invoice with document link
 */
export function sendWhatsAppInvoice(
  phone: string,
  customerName: string,
  invoiceId: number,
  total: number,
  invoiceUrl?: string,
): void {
  const message = generateInvoiceMessage(
    customerName,
    invoiceId,
    total,
    invoiceUrl,
  );
  openWhatsAppChat(phone, message);
}
