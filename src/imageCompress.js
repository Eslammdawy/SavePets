/**
 * Client-side image compression using HTMLCanvasElement:
 * - Max 800px on the longest side
 * - WebP (JPEG fallback for browsers that do not encode WebP)
 * - Starts at quality 0.6 and steps down if needed to target under 80 KB
 * - Returns { base64, dataUrl, mimeType, sizeBytes }
 */

const MAX_DIMENSION = 800;
const TARGET_MAX_BYTES = 80 * 1024; // 80 KB target
const INITIAL_QUALITY = 0.6;

export async function compressImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file.');
  }

  const bitmap = await loadImageElement(file);
  const origW = bitmap.width || bitmap.naturalWidth;
  const origH = bitmap.height || bitmap.naturalHeight;

  if (!origW || !origH) {
    throw new Error('Could not read image dimensions.');
  }

  let targetW = origW;
  let targetH = origH;

  if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
    if (origW >= origH) {
      targetW = MAX_DIMENSION;
      targetH = Math.max(1, Math.round((origH * MAX_DIMENSION) / origW));
    } else {
      targetH = MAX_DIMENSION;
      targetW = Math.max(1, Math.round((origW * MAX_DIMENSION) / origH));
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  // Detect WebP encoding support; fall back to JPEG if unsupported
  let mimeType = 'image/webp';
  let dataUrl = canvas.toDataURL(mimeType, INITIAL_QUALITY);
  if (!dataUrl.startsWith('data:image/webp')) {
    mimeType = 'image/jpeg';
    dataUrl = canvas.toDataURL(mimeType, INITIAL_QUALITY);
  }

  // Step down quality slightly if over 80 KB target
  let quality = INITIAL_QUALITY;
  let sizeBytes = getBase64ByteSize(dataUrl);

  while (sizeBytes > TARGET_MAX_BYTES && quality > 0.32) {
    quality = Math.round((quality - 0.1) * 100) / 100;
    dataUrl = canvas.toDataURL(mimeType, quality);
    sizeBytes = getBase64ByteSize(dataUrl);
  }

  const base64 = dataUrl.split(',')[1] || '';

  return {
    base64,
    dataUrl,
    mimeType,
    sizeBytes
  };
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image.'));
    };
    img.src = url;
  });
}

function getBase64ByteSize(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
