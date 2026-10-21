/**
 * Client-side image compression using createImageBitmap + HTMLCanvasElement + canvas.toBlob:
 * - Steps through dimensions [800, 700, 600] if needed to reach < 80 KB target
 * - Uses WebP (JPEG fallback for browsers that do not encode WebP)
 * - Starts at quality 0.6 and steps down to 0.3
 * - Enforces the server hard stop (300 KB)
 * - Returns { base64, dataUrl, mimeType, sizeBytes }
 */

const DIMENSION_STEPS = [800, 700, 600];
const TARGET_MAX_BYTES = 80 * 1024; // 80 KB target
const SERVER_MAX_BYTES = 300 * 1024; // 300 KB server hard stop
const INITIAL_QUALITY = 0.6;
const MIN_QUALITY = 0.3;

export async function compressImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file.');
  }

  const source = await decodeImageSource(file);
  try {
    const origW = source.width || source.naturalWidth;
    const origH = source.height || source.naturalHeight;

    if (!origW || !origH) {
      throw new Error('Could not read image dimensions.');
    }

    let bestResult = null;

    for (const maxDim of DIMENSION_STEPS) {
      const { width, height } = computeScaledDimensions(origW, origH, maxDim);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, width, height);

      let quality = INITIAL_QUALITY;
      while (quality >= MIN_QUALITY) {
        const encoded = await encodeCanvas(canvas, quality);
        bestResult = encoded;

        if (encoded.sizeBytes <= TARGET_MAX_BYTES) {
          return encoded;
        }
        quality = Math.round((quality - 0.1) * 100) / 100;
      }
    }

    if (!bestResult || bestResult.sizeBytes > SERVER_MAX_BYTES) {
      throw new Error('Photo exceeds maximum allowed size (300 KB).');
    }

    return bestResult;
  } finally {
    if (source && typeof source.close === 'function') {
      try {
        source.close();
      } catch (_e) {
        // Ignore close error
      }
    }
  }
}

function computeScaledDimensions(origW, origH, maxDim) {
  if (origW <= maxDim && origH <= maxDim) {
    return { width: origW, height: origH };
  }
  if (origW >= origH) {
    return {
      width: maxDim,
      height: Math.max(1, Math.round((origH * maxDim) / origW))
    };
  }
  return {
    width: Math.max(1, Math.round((origW * maxDim) / origH)),
    height: maxDim
  };
}

async function decodeImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch (_e) {
      // Fall back to HTMLImageElement if createImageBitmap fails
    }
  }
  return loadImageElement(file);
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

async function encodeCanvas(canvas, quality) {
  if (typeof canvas.toBlob === 'function') {
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    let mimeType = 'image/webp';
    if (!blob || blob.type !== 'image/webp') {
      mimeType = 'image/jpeg';
      blob = await canvasToBlob(canvas, mimeType, quality);
    }
    if (blob) {
      const dataUrl = await blobToDataUrl(blob);
      const base64 = dataUrl.split(',')[1] || '';
      return {
        base64,
        dataUrl,
        mimeType: blob.type || mimeType,
        sizeBytes: blob.size
      };
    }
  }

  // Fallback to synchronous toDataURL
  let mimeType = 'image/webp';
  let dataUrl = canvas.toDataURL(mimeType, quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    mimeType = 'image/jpeg';
    dataUrl = canvas.toDataURL(mimeType, quality);
  }
  const base64 = dataUrl.split(',')[1] || '';
  return {
    base64,
    dataUrl,
    mimeType,
    sizeBytes: getBase64ByteSize(dataUrl)
  };
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob || null), mimeType, quality);
    } catch (_e) {
      resolve(null);
    }
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read compressed image blob.'));
    reader.readAsDataURL(blob);
  });
}

function getBase64ByteSize(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
