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

export async function isHeicFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    return true;
  }
  // Check magic bytes in header for ftyp heic / heix / hevc / hevx / mif1 / msf1
  if (typeof file.slice === 'function') {
    try {
      const slice = file.slice(0, 64);
      const buffer = await slice.arrayBuffer();
      if (buffer.byteLength >= 12) {
        const bytes = new Uint8Array(buffer);
        const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
        if (ftyp === 'ftyp') {
          const brandString = String.fromCharCode(...bytes.subarray(8)).toLowerCase();
          const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'];
          return heicBrands.some((b) => brandString.includes(b));
        }
      }
    } catch (_e) {
      // Ignore reading failure
    }
  }
  return false;
}

export async function convertHeicToJpeg(file) {
  if (typeof window === 'undefined') {
    const err = new Error('HEIC conversion is only supported in browser environments.');
    err.code = 'ERR_HEIC_CONVERT';
    throw err;
  }
  try {
    const mod = await import('heic2any');
    const heic2any = mod.default || mod;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const originalName = file.name || 'photo.heic';
    const newName = originalName.replace(/\.(heic|heif)$/i, '') + '.jpg';
    if (typeof File === 'function') {
      try {
        return new File([blob], newName, {
          type: 'image/jpeg',
          lastModified: file.lastModified || Date.now()
        });
      } catch (_e) {
        // Fallback to blob if File constructor is not fully supported
      }
    }
    blob.name = newName;
    return blob;
  } catch (err) {
    console.warn('HEIC conversion failed:', err);
    const customErr = new Error(
      'Could not convert HEIC photo. Please select a JPG or PNG photo, or disable "High Efficiency" mode in your camera settings.'
    );
    customErr.code = 'ERR_HEIC_CONVERT';
    throw customErr;
  }
}

export async function compressImageFile(file) {
  if (!file) {
    const err = new Error('Invalid image file.');
    err.code = 'ERR_INVALID_FILE';
    throw err;
  }
  const hasImageMime = Boolean(file.type && file.type.startsWith('image/'));
  const hasImageExt = Boolean(
    file.name && /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name)
  );
  const isHeic = await isHeicFile(file);
  if (!hasImageMime && !hasImageExt && !isHeic) {
    const err = new Error('Invalid image file. Please choose an image.');
    err.code = 'ERR_INVALID_FILE';
    throw err;
  }

  let source = null;
  let decodedFile = file;

  try {
    source = await decodeImageSource(decodedFile);
  } catch (_initialError) {
    // If decoding failed, check if the file is HEIC/HEIF and convert
    if (isHeic || (await isHeicFile(file))) {
      decodedFile = await convertHeicToJpeg(file);
      source = await decodeImageSource(decodedFile);
    } else {
      const err = new Error(
        'Failed to load image. The photo format might not be supported or the file is corrupted. Please choose a JPG, PNG, or WebP photo.'
      );
      err.code = 'ERR_IMAGE_LOAD';
      throw err;
    }
  }

  try {
    const origW = source.width || source.naturalWidth;
    const origH = source.height || source.naturalHeight;

    if (!origW || !origH) {
      const err = new Error('Could not read image dimensions.');
      err.code = 'ERR_IMAGE_LOAD';
      throw err;
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
      const err = new Error('Photo exceeds maximum allowed size (300 KB).');
      err.code = 'ERR_TOO_LARGE';
      throw err;
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

export function computeScaledDimensions(origW, origH, maxDim) {
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
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_e1) {
      try {
        return await createImageBitmap(file);
      } catch (_e2) {
        // Fall back to HTMLImageElement if createImageBitmap fails
      }
    }
  }
  return loadImageElement(file);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    let objectUrl = null;

    function cleanup() {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_e) {
          // Ignore
        }
        objectUrl = null;
      }
    }

    function tryWithFileReader() {
      if (typeof FileReader === 'undefined') {
        const err = new Error('Failed to load image.');
        err.code = 'ERR_IMAGE_LOAD';
        reject(err);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          const err = new Error('Failed to load image.');
          err.code = 'ERR_IMAGE_LOAD';
          reject(err);
        };
        img.src = reader.result;
      };
      reader.onerror = () => {
        const err = new Error('Failed to load image.');
        err.code = 'ERR_IMAGE_LOAD';
        reject(err);
      };
      reader.readAsDataURL(file);
    }

    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        cleanup();
        resolve(img);
      };
      img.onerror = () => {
        cleanup();
        tryWithFileReader();
      };
      img.src = objectUrl;
    } catch (_e) {
      tryWithFileReader();
    }
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
