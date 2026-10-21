// All 27 Egyptian Governorates (Arabic + English + ISO 3166-2 + Center coords + Aliases)
export const GOVERNORATES = [
  { id: 'cairo', iso: 'EG-C', ar: 'القاهرة', en: 'Cairo', lat: 30.0444, lng: 31.2357, aliases: ['cairo', 'القاهرة', 'القاهره'] },
  { id: 'giza', iso: 'EG-GZ', ar: 'الجيزة', en: 'Giza', lat: 30.0131, lng: 31.2089, aliases: ['giza', 'الجيزة', 'الجيزه'] },
  { id: 'alexandria', iso: 'EG-ALX', ar: 'الإسكندرية', en: 'Alexandria', lat: 31.2001, lng: 29.9187, aliases: ['alexandria', 'الإسكندرية', 'الاسكندرية', 'الاسكندريه'] },
  { id: 'qalyubia', iso: 'EG-KB', ar: 'القليوبية', en: 'Qalyubia', lat: 30.41, lng: 31.21, aliases: ['qalyubia', 'qalyubiya', 'kalyobiya', 'القليوبية', 'القليوبيه'] },
  { id: 'dakahlia', iso: 'EG-DK', ar: 'الدقهلية', en: 'Dakahlia', lat: 31.0409, lng: 31.3785, aliases: ['dakahlia', 'dakahliya', 'الدقهلية', 'الدقهليه'] },
  { id: 'sharkia', iso: 'EG-SHR', ar: 'الشرقية', en: 'Sharkia', lat: 30.5877, lng: 31.502, aliases: ['sharkia', 'sharqia', 'ash sharqiyah', 'الشرقية', 'الشرقيه'] },
  { id: 'gharbia', iso: 'EG-GH', ar: 'الغربية', en: 'Gharbia', lat: 30.7865, lng: 31.0004, aliases: ['gharbia', 'gharbiya', 'الغربية', 'الغربيه'] },
  { id: 'menofia', iso: 'EG-MNF', ar: 'المنوفية', en: 'Menofia', lat: 30.5972, lng: 30.9876, aliases: ['menofia', 'monufia', 'menoufia', 'المنوفية', 'المنوفيه'] },
  { id: 'beheira', iso: 'EG-BH', ar: 'البحيرة', en: 'Beheira', lat: 31.0364, lng: 30.4682, aliases: ['beheira', 'behira', 'el beheira', 'البحيرة', 'البحيره'] },
  { id: 'kafr_el_sheikh', iso: 'EG-KFS', ar: 'كفر الشيخ', en: 'Kafr El Sheikh', lat: 31.1107, lng: 30.9388, aliases: ['kafr el sheikh', 'kafr el-sheikh', 'كفر الشيخ'] },
  { id: 'damietta', iso: 'EG-DT', ar: 'دمياط', en: 'Damietta', lat: 31.4175, lng: 31.8144, aliases: ['damietta', 'dumyat', 'دمياط'] },
  { id: 'port_said', iso: 'EG-PTS', ar: 'بورسعيد', en: 'Port Said', lat: 31.2653, lng: 32.3019, aliases: ['port said', 'بور سعيد', 'بورسعيد'] },
  { id: 'ismailia', iso: 'EG-IS', ar: 'الإسماعيلية', en: 'Ismailia', lat: 30.5965, lng: 32.2715, aliases: ['ismailia', 'الإسماعيلية', 'الاسماعيلية', 'الاسماعيليه'] },
  { id: 'suez', iso: 'EG-SUZ', ar: 'السويس', en: 'Suez', lat: 29.9668, lng: 32.5498, aliases: ['suez', 'السويس'] },
  { id: 'fayoum', iso: 'EG-FYM', ar: 'الفيوم', en: 'Fayoum', lat: 29.3084, lng: 30.8428, aliases: ['fayoum', 'faiyum', 'el fayoum', 'الفيوم'] },
  { id: 'beni_suef', iso: 'EG-BNS', ar: 'بني سويف', en: 'Beni Suef', lat: 29.0661, lng: 31.0994, aliases: ['beni suef', 'bani suwayf', 'بني سويف', 'بنى سويف'] },
  { id: 'minya', iso: 'EG-MN', ar: 'المنيا', en: 'Minya', lat: 28.1099, lng: 30.7503, aliases: ['minya', 'el minya', 'المنيا'] },
  { id: 'assiut', iso: 'EG-AST', ar: 'أسيوط', en: 'Assiut', lat: 27.181, lng: 31.1837, aliases: ['assiut', 'asyut', 'أسيوط', 'اسيوط'] },
  { id: 'sohag', iso: 'EG-SHG', ar: 'سوهاج', en: 'Sohag', lat: 26.5591, lng: 31.6957, aliases: ['sohag', 'suhag', 'سوهاج'] },
  { id: 'qena', iso: 'EG-KN', ar: 'قنا', en: 'Qena', lat: 26.1551, lng: 32.716, aliases: ['qena', 'قنا'] },
  { id: 'luxor', iso: 'EG-LX', ar: 'الأقصر', en: 'Luxor', lat: 25.6872, lng: 32.6396, aliases: ['luxor', 'الأقصر', 'الاقصر'] },
  { id: 'aswan', iso: 'EG-ASN', ar: 'أسوان', en: 'Aswan', lat: 24.0889, lng: 32.8998, aliases: ['aswan', 'أسوان', 'اسوان'] },
  { id: 'red_sea', iso: 'EG-BA', ar: 'البحر الأحمر', en: 'Red Sea', lat: 27.2579, lng: 33.8116, aliases: ['red sea', 'البحر الأحمر', 'البحر الاحمر'] },
  { id: 'new_valley', iso: 'EG-WAD', ar: 'الوادي الجديد', en: 'New Valley', lat: 25.4514, lng: 30.5463, aliases: ['new valley', 'el wadi el gedid', 'الوادي الجديد', 'الوادى الجديد'] },
  { id: 'matrouh', iso: 'EG-MT', ar: 'مطروح', en: 'Matrouh', lat: 31.3543, lng: 27.2373, aliases: ['matrouh', 'matruh', 'marsa matruh', 'مطروح', 'مرسى مطروح'] },
  { id: 'north_sinai', iso: 'EG-SIN', ar: 'شمال سيناء', en: 'North Sinai', lat: 31.1321, lng: 33.8033, aliases: ['north sinai', 'شمال سيناء'] },
  { id: 'south_sinai', iso: 'EG-JS', ar: 'جنوب سيناء', en: 'South Sinai', lat: 28.2417, lng: 33.6222, aliases: ['south sinai', 'جنوب سيناء'] }
];

export function getGovernorateName(govId, lang = 'ar') {
  const found = GOVERNORATES.find((g) => g.id === govId);
  if (!found) return govId || '';
  return lang === 'ar' ? found.ar : found.en;
}

/**
 * Match a raw state/province string or ISO code to one of the 27 governorate IDs.
 */
export function matchGovernorateId(rawTextOrIso) {
  if (!rawTextOrIso) return '';
  const upper = String(rawTextOrIso).trim().toUpperCase();
  const byIso = GOVERNORATES.find((g) => g.iso === upper);
  if (byIso) return byIso.id;

  const normalized = String(rawTextOrIso)
    .toLowerCase()
    .replace(/governorate|محافظة|محافظه/gi, '')
    .trim();

  if (!normalized) return '';

  for (const g of GOVERNORATES) {
    if (g.id === normalized || g.en.toLowerCase() === normalized || g.ar === normalized) {
      return g.id;
    }
    if (g.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return g.id;
    }
  }
  return '';
}

/**
 * Find the closest Egyptian governorate by coordinates as a fallback.
 */
export function findNearestGovernorateId(lat, lng) {
  // Basic bounding box check around Egypt
  if (lat < 21.5 || lat > 32.0 || lng < 24.5 || lng > 37.0) {
    return '';
  }
  let bestId = '';
  let bestDist = Infinity;
  for (const g of GOVERNORATES) {
    const dLat = lat - g.lat;
    const dLng = lng - g.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = g.id;
    }
  }
  return bestId;
}

/**
 * Check whether an object or coordinate pair has valid non-zero GPS coordinates within Egypt's region.
 */
export function hasValidCoords(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.lat === null || obj.lat === undefined || obj.lat === '') return false;
  if (obj.lng === null || obj.lng === undefined || obj.lng === '') return false;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 21.5 && lat <= 32.0 && lng >= 24.5 && lng <= 37.0;
}

/**
 * Calculate great-circle distance in kilometers between two GPS points using the Haversine formula.
 */
export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lat1 === '' ||
    lng1 === null ||
    lng1 === undefined ||
    lng1 === '' ||
    lat2 === null ||
    lat2 === undefined ||
    lat2 === '' ||
    lng2 === null ||
    lng2 === undefined ||
    lng2 === ''
  ) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLng1 = Number(lng1);
  const nLat2 = Number(lat2);
  const nLng2 = Number(lng2);
  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLng1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLng2) ||
    (nLat1 === 0 && nLng1 === 0) ||
    (nLat2 === 0 && nLng2 === 0)
  ) {
    return null;
  }

  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(nLat2 - nLat1);
  const dLng = toRad(nLng2 - nLng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) *
      Math.cos(toRad(nLat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance in km for display in Arabic or English.
 */
export function formatDistance(km, lang = 'ar') {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return lang === 'ar' ? `على بُعد ${meters} متر` : `${meters}m away`;
  }
  const rounded = km < 10 ? km.toFixed(1) : Math.round(km);
  return lang === 'ar' ? `على بُعد ${rounded} كم` : `${rounded} km away`;
}

/**
 * Clean up a reverse-geocoded area/city name so it doesn't just repeat "Governorate" or administrative prefixes.
 */
function cleanAreaName(raw, matchedGovId) {
  if (!raw) return '';
  const cleaned = String(raw)
    .replace(/^(قسم|مركز|حي|حى|مدينة|مدينه)\s+/i, '')
    .trim();
  if (!cleaned) return '';

  if (matchedGovId) {
    const gov = GOVERNORATES.find((g) => g.id === matchedGovId);
    if (gov) {
      const lower = cleaned.toLowerCase();
      if (lower === gov.en.toLowerCase() || cleaned === gov.ar) {
        return cleaned;
      }
    }
  }
  return cleaned.slice(0, 100);
}

/**
 * Reverse-geocode (lat, lng) to { gov, city } using OpenStreetMap Nominatim
 * with BigDataCloud and nearest-coordinate fallbacks.
 */
export async function reverseGeocodeLocation(lat, lng, lang = 'ar') {
  const acceptLang = lang === 'ar' ? 'ar,en;q=0.8' : 'en,ar;q=0.8';

  // 1. Primary: OpenStreetMap Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&accept-language=${encodeURIComponent(acceptLang)}&zoom=16`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = (data && data.address) || {};

      const govId =
        matchGovernorateId(addr['ISO3166-2-lvl4']) ||
        matchGovernorateId(addr.state) ||
        matchGovernorateId(addr.province) ||
        matchGovernorateId(addr.region) ||
        matchGovernorateId(addr.county) ||
        matchGovernorateId(addr.city) ||
        findNearestGovernorateId(lat, lng);

      const rawArea =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.city_district ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.city ||
        addr.county ||
        '';

      return {
        gov: govId,
        city: cleanAreaName(rawArea, govId)
      };
    }
  } catch (_err) {
    // Fall through to secondary provider
  }

  // 2. Fallback: BigDataCloud client-side reverse geocoder
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lng)}&localityLanguage=${encodeURIComponent(lang)}`;
    const res = await fetch(bdcUrl, {
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const govId =
        matchGovernorateId(data.principalSubdivisionCode) ||
        matchGovernorateId(data.principalSubdivision) ||
        matchGovernorateId(data.city) ||
        findNearestGovernorateId(lat, lng);

      const rawArea = data.locality || data.city || '';
      return {
        gov: govId,
        city: cleanAreaName(rawArea, govId)
      };
    }
  } catch (_err) {
    // Fall through to coordinate fallback
  }

  return {
    gov: findNearestGovernorateId(lat, lng),
    city: ''
  };
}
