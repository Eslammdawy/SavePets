import React, { useEffect, useRef, useState } from 'react';
import { getDrivePhotoUrl } from './api';
import { getGovernorateName } from './governorates';
import { DICT, buildAutoSummary, formatTimeAgo } from './i18n';

const COND_COLORS = {
  injured: { bg: '#dc2626', soft: '#fef2f2', text: '#991b1b', emoji: '🩹' },
  sick: { bg: '#d97706', soft: '#fffbeb', text: '#92400e', emoji: '🤒' },
  pregnant: { bg: '#db2777', soft: '#fdf2f8', text: '#9d174d', emoji: '🍼' },
  healthy: { bg: '#16a34a', soft: '#f0fdf4', text: '#166534', emoji: '💚' },
  unsure: { bg: '#57534e', soft: '#f5f5f4', text: '#44403c', emoji: '🐾' }
};

/**
 * Build shareable text summary + Google Maps link for a pet report.
 */
export function buildShareText(pet, lang = 'ar') {
  const summary = buildAutoSummary(pet, lang);
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${pet.lat},${pet.lng}`)}`;
  const desc = String(pet.desc || '').trim();

  if (lang === 'ar') {
    return [
      `🐾 نداء إنقاذ عبر تطبيق Street Pets Egypt`,
      summary,
      desc ? `📝 التفاصيل: ${desc}` : '',
      `📍 الموقع على الخريطة: ${mapsUrl}`
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `🐾 Street Pets Egypt — Rescue Alert`,
    summary,
    desc ? `📝 Details: ${desc}` : '',
    `📍 Exact GPS Location: ${mapsUrl}`
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Trigger native Web Share API or copy to clipboard as fallback.
 */
export async function sharePetCaseNative(pet, lang = 'ar') {
  const text = buildShareText(pet, lang);
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${pet.lat},${pet.lng}`)}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Street Pets Egypt',
        text,
        url: mapsUrl
      });
      return { shared: true, copied: false };
    } catch (_err) {
      // User cancelled or share failed; fall back to clipboard
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return { shared: false, copied: true };
  }

  return { shared: false, copied: false };
}

/**
 * Wrap multiline text onto canvas context.
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let currentY = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      lineCount += 1;
      if (lineCount >= maxLines) {
        ctx.fillText(line + '…', x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export default function RescuePosterModal({ pet, lang, onClose }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const t = DICT[lang] || DICT.en;

  useEffect(() => {
    if (!pet || !canvasRef.current) return;
    let cancelled = false;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = 1080;
    const H = 1280;
    canvas.width = W;
    canvas.height = H;

    const condKey = pet.cond || 'unsure';
    const palette = COND_COLORS[condKey] || COND_COLORS.unsure;
    const govName = getGovernorateName(pet.gov, lang);
    const cityText = String(pet.city || '').trim();
    const hasDistinctCity =
      cityText && cityText.toLowerCase() !== govName.toLowerCase();
    const locationLabel = hasDistinctCity
      ? lang === 'ar'
        ? `${cityText}، ${govName}`
        : `${cityText}, ${govName}`
      : govName;
    const typeLabel = t.types[pet.type] || pet.type;
    const condLabel = t.conditions[condKey] || condKey;
    const typeEmoji = pet.type === 'cat' ? '🐈' : '🐕';
    const timeAgo = formatTimeAgo(pet.t, lang);

    function renderCard(loadedImg = null) {
      if (cancelled) return;

      // 1. Warm Cream Background
      ctx.fillStyle = '#faf6f0';
      ctx.fillRect(0, 0, W, H);

      // 2. Top Urgent Header Banner
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, W, 150);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '800 44px "Cairo", "Plus Jakarta Sans", sans-serif';
      const bannerTitle =
        condKey === 'healthy'
          ? lang === 'ar'
            ? '🏡 حيوان أليف يبحث عن متبنٍّ'
            : '🏡 STREET PET FOR ADOPTION'
          : lang === 'ar'
            ? '🚨 نداء إنقاذ عاجل — Street Pets'
            : '🚨 URGENT STREET RESCUE ALERT';
      ctx.fillText(bannerTitle, W / 2, 95);

      // 3. White Main Card Container
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e6dec8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(56, 190, W - 112, H - 310, 36);
      ctx.fill();
      ctx.stroke();

      // 4. Photo / Visual Hero Box inside Card
      const boxX = 96;
      const boxY = 230;
      const boxW = W - 192;
      const boxH = 440;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 28);
      ctx.clip();

      if (loadedImg) {
        // Cover fit
        const scale = Math.max(boxW / loadedImg.width, boxH / loadedImg.height);
        const drawW = loadedImg.width * scale;
        const drawH = loadedImg.height * scale;
        const drawX = boxX + (boxW - drawW) / 2;
        const drawY = boxY + (boxH - drawH) / 2;
        ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);
      } else {
        // Warm gradient hero illustration when Drive CORS blocks raw pixel access
        const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
        grad.addColorStop(0, palette.soft);
        grad.addColorStop(1, '#f3ece1');
        ctx.fillStyle = grad;
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.font = '150px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(typeEmoji, W / 2, boxY + 230);

        ctx.fillStyle = palette.text;
        ctx.font = '800 36px "Cairo", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${palette.emoji} ${condLabel} • ${typeLabel}`, W / 2, boxY + 340);

        ctx.fillStyle = '#57534e';
        ctx.font = '700 28px "Cairo", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`🕒 ${timeAgo}`, W / 2, boxY + 395);
      }
      ctx.restore();

      // 5. Location Pill & Headline
      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';
      ctx.font = '800 44px "Cairo", "Plus Jakarta Sans", sans-serif';
      const headline =
        condKey === 'healthy'
          ? t.cardTitleAdopt(typeLabel)
          : t.cardTitleNeedsHelp(typeLabel);
      ctx.fillText(headline, W / 2, 745);

      // Location Badge
      ctx.fillStyle = '#fff1ed';
      ctx.strokeStyle = '#fdbaae';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(140, 780, W - 280, 74, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e5533d';
      ctx.font = '800 34px "Cairo", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`📍 ${locationLabel}`, W / 2, 829);

      // 6. Description Box
      const descText =
        String(pet.desc || '').trim() ||
        (lang === 'ar'
          ? 'تم تحديد الموقع بدقة عبر الـ GPS. يرجى المساعدة في الإنقاذ أو المشاركة.'
          : 'Exact GPS location pinned. Please help rescue or share with local groups.');

      ctx.fillStyle = '#57534e';
      ctx.font = '600 30px "Cairo", "Plus Jakarta Sans", sans-serif';
      drawWrappedText(ctx, descText, W / 2, 915, W - 240, 44, 3);

      // 7. GPS Coordinates Footer inside Card
      ctx.fillStyle = '#78716c';
      ctx.font = '700 26px "Plus Jakarta Sans", monospace';
      ctx.fillText(`GPS: ${pet.lat}, ${pet.lng}`, W / 2, 1110);

      // 8. Bottom Branding Bar
      ctx.fillStyle = '#1c1917';
      ctx.font = '800 30px "Cairo", "Plus Jakarta Sans", sans-serif';
      ctx.fillText('🐾 Street Pets Egypt — أنقذ وتبنَّ حيوانات الشارع في مصر', W / 2, H - 52);

      setPosterReady(true);
    }

    const photoUrl = getDrivePhotoUrl(pet.photo);
    if (!photoUrl) {
      renderCard(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        renderCard(img);
        // Verify canvas is not tainted
        canvas.toDataURL('image/png');
      } catch (_e) {
        renderCard(null);
      }
    };
    img.onerror = () => {
      renderCard(null);
    };
    img.src = photoUrl;

    return () => {
      cancelled = true;
    };
  }, [pet, lang, t]);

  function handleDownloadPng() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `street-pets-rescue-${pet.gov || 'egypt'}-${pet.id || Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleSharePosterNative() {
    if (!canvasRef.current) return;
    const text = buildShareText(pet, lang);

    try {
      const blob = await new Promise((resolve) =>
        canvasRef.current.toBlob(resolve, 'image/png')
      );
      if (blob && navigator.canShare) {
        const file = new File([blob], `street-pets-rescue.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Street Pets Egypt',
            text,
            files: [file]
          });
          return;
        }
      }
    } catch (_err) {
      // Fallback to text share or download
    }

    await sharePetCaseNative(pet, lang);
  }

  async function handleCopyText() {
    const text = buildShareText(pet, lang);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="surface-card modal-box poster-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🖼️ {t.posterModalTitle}</h2>
            <p className="modal-subtitle">{t.posterModalSubtitle}</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={t.closeModalBtn}
          >
            ✕
          </button>
        </div>

        <div className="poster-canvas-wrap">
          <canvas ref={canvasRef} className="poster-canvas" />
        </div>

        {copied && (
          <div className="alert-box alert-success" style={{ marginBottom: 12 }}>
            <span aria-hidden="true">✅</span>
            <span>{t.shareCopiedToast}</span>
          </div>
        )}

        <div className="poster-actions-grid">
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadPng}
            disabled={!posterReady}
          >
            <span aria-hidden="true">⬇️</span>
            <span>{t.downloadPosterBtn}</span>
          </button>

          <div className="poster-sub-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSharePosterNative}
            >
              <span aria-hidden="true">📤</span>
              <span>{t.sharePosterNativeBtn}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyText}
            >
              <span aria-hidden="true">📋</span>
              <span>{t.copyShareTextBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
