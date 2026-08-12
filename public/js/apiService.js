/**
 * ApiService — Client wrapper for Express backend endpoints.
 * Interacts directly with the backend APIs without modification.
 */

const API_BASE = window.location.port === '5000' ? 'http://localhost:3000' : '';

export class ApiService {
  /**
   * Health check to ensure backend service is alive.
   */
  static async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend health check warning:', err.message);
      return { status: 'unreachable', error: err.message };
    }
  }

  /**
   * Process uploaded builder photo (EXIF auto-rotate & 600x600 square crop).
   * Accepts a File object.
   *
   * @param {File} photoFile
   * @returns {Promise<{ success: boolean, base64Photo: string }>}
   */
  static async processImage(photoFile) {
    const formData = new FormData();
    formData.append('photo', photoFile);

    const res = await fetch(`${API_BASE}/api/process-image`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Image processing failed (${res.status})`);
    }

    return data;
  }

  /**
   * Generate dynamic dark-mode neon QR code for the badge.
   * Defaults to https://hhgoa.com as required by existing backend.
   *
   * @param {string} [url='https://hhgoa.com']
   * @returns {Promise<{ success: boolean, qrCodeBase64: string }>}
   */
  static async generateQR(url = 'https://hhgoa.com') {
    const res = await fetch(`${API_BASE}/api/generate-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `QR code generation failed (${res.status})`);
    }

    return data;
  }

  /**
   * Generate 2-page print-ready PDF and trigger browser file download.
   *
   * @param {string} frontImageBase64
   * @param {string} backImageBase64
   * @param {string} filename
   */
  static async downloadPDF(frontImageBase64, backImageBase64, filename = 'HH_Goa_2026_Builder_ID.pdf') {
    const res = await fetch(`${API_BASE}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontImageBase64,
        backImageBase64,
        filename,
      }),
    });

    if (!res.ok) {
      let errorMsg = 'PDF generation failed';
      try {
        const errJson = await res.json();
        errorMsg = errJson.error || errorMsg;
      } catch (e) {
        /* fallback to status */
      }
      throw new Error(`${errorMsg} (${res.status})`);
    }

    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Create ephemeral share link cached in backend memory map for OpenGraph preview & X sharing.
   *
   * @param {string} frontImageBase64
   * @param {string} backImageBase64
   * @returns {Promise<{ success: boolean, cardId: string, shareUrl: string }>}
   */
  static async createShareLink(frontImageBase64, backImageBase64) {
    const res = await fetch(`${API_BASE}/api/create-share-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontImageBase64,
        backImageBase64,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Share link creation failed (${res.status})`);
    }

    return data;
  }
}
