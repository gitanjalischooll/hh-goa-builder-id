/**
 * IDCardRenderer — Official Template Canvas Rendering Engine.
 * Dynamic FRONT Elements:
 *   1. User photo inside existing photo frame
 *   2. User name replacing 'NAME'
 *   3. Builder title replacing '[GENERATED BUILDER TITLE]'
 *
 * BACK Card: Fixed, 100% unchanged template artwork.
 * Canvas Resolution: 1748 x 1240 px (Official Template Native Resolution).
 */

const CARD_WIDTH = 1748;
const CARD_HEIGHT = 1240;

/**
 * Loads an image from a URL or data URI.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image asset: ${src}`));
    img.src = src;
  });
}

/**
 * Helper to draw a rounded rectangle path.
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export class IDCardRenderer {
  /**
   * Renders the FRONT side of the ID Card.
   * Dynamic elements ONLY: User photo, User name, Builder title.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} data - { name, title, processedPhotoBase64 }
   */
  static async renderFrontCard(canvas, data) {
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');

    // 1. Draw Fixed Official Template Background (assets/idcard-front.png)
    const bgTemplate = await loadImage('assets/idcard-front.png');
    ctx.drawImage(bgTemplate, 0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 2. Overlay User Photo in Photo Vault Slot
    if (data.processedPhotoBase64) {
      ctx.save();
      const photoX = 644;
      const photoY = 305;
      const photoW = 460;
      const photoH = 475;
      const radius = 24;

      roundRect(ctx, photoX, photoY, photoW, photoH, radius);
      ctx.clip();

      try {
        const photoImg = await loadImage(data.processedPhotoBase64);
        ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
      } catch (err) {
        console.error('Error drawing user photo onto card:', err);
      }
      ctx.restore();
    }

    // 3. Overlay User Name (Replacing placeholder 'NAME')
    ctx.save();
    const centerX = CARD_WIDTH / 2;
    const nameY = 965;

    // Smooth gradient cover patch over placeholder text
    const namePatchGrad = ctx.createLinearGradient(centerX - 350, 0, centerX + 350, 0);
    namePatchGrad.addColorStop(0, 'rgba(31, 117, 138, 0)');
    namePatchGrad.addColorStop(0.2, 'rgba(27, 109, 129, 0.95)');
    namePatchGrad.addColorStop(0.8, 'rgba(27, 109, 129, 0.95)');
    namePatchGrad.addColorStop(1, 'rgba(31, 117, 138, 0)');

    ctx.fillStyle = namePatchGrad;
    ctx.fillRect(centerX - 350, nameY - 45, 700, 75);

    // Draw User Name
    const nameText = (data.name || 'BUILDER NAME').toUpperCase();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 54px "Outfit", "Space Grotesk", sans-serif';

    // Auto-scale font for long names
    if (ctx.measureText(nameText).width > 680) {
      ctx.font = '900 42px "Outfit", "Space Grotesk", sans-serif';
    }
    ctx.fillText(nameText, centerX, nameY + 2);
    ctx.restore();

    // 4. Overlay Builder Title inside Yellow Pill Box (Replacing '[GENERATED BUILDER TITLE]')
    ctx.save();
    const pillX = 590;
    const pillY = 1042;
    const pillW = 568;
    const pillH = 76;
    const pillR = 38;

    // Fill & stroke pill box
    roundRect(ctx, pillX, pillY, pillW, pillH, pillR);
    ctx.fillStyle = '#154B59';
    ctx.fill();
    ctx.strokeStyle = '#F4B925';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw Builder Title
    const displayTitle = (data.title || 'BUILDER TITLE').toUpperCase();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F4B925';
    ctx.font = '800 24px "Space Grotesk", monospace';

    // Auto-fit long title strings
    if (ctx.measureText(displayTitle).width > pillW - 40) {
      ctx.font = '800 20px "Space Grotesk", monospace';
    }
    if (ctx.measureText(displayTitle).width > pillW - 40) {
      ctx.font = '800 17px "Space Grotesk", monospace';
    }

    ctx.fillText(displayTitle, centerX, pillY + pillH / 2 + 2);
    ctx.restore();
  }

  /**
   * Renders the BACK side of the ID Card.
   * Draws assets/idcard-back.png as a fixed, 100% unchanged template.
   *
   * @param {HTMLCanvasElement} canvas
   */
  static async renderBackCard(canvas) {
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Draw Fixed Official Back Template (assets/idcard-back.png) with zero overlays
    const bgTemplate = await loadImage('assets/idcard-back.png');
    ctx.drawImage(bgTemplate, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  /**
   * Renders both Front and Back template cards and returns base64 PNG data URLs.
   *
   * @param {Object} data - { name, title, processedPhotoBase64 }
   * @returns {Promise<{ frontImageBase64: string, backImageBase64: string }>}
   */
  static async generateCardImages(data) {
    const frontCanvas = document.createElement('canvas');
    const backCanvas = document.createElement('canvas');

    await this.renderFrontCard(frontCanvas, data);
    await this.renderBackCard(backCanvas);

    return {
      frontImageBase64: frontCanvas.toDataURL('image/png'),
      backImageBase64: backCanvas.toDataURL('image/png'),
    };
  }
}
