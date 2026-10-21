import React, { useState } from 'react';
import { DICT } from './i18n';
import { FIRST_AID_TOPICS, FirstAidInlineCard } from './FirstAidInlineCard';

export { FIRST_AID_TOPICS, FirstAidInlineCard };

export const EGYPT_SHELTERS = [
  {
    nameAr: 'الجمعية المصرية لحماية حقوق الحيوان (ESMA)',
    nameEn: 'Egyptian Society for Mercy to Animals (ESMA)',
    regionAr: 'القاهرة والجيزة (سقارة / الهرم)',
    regionEn: 'Cairo & Giza (Saqqara / Haram)',
    focusAr: 'إنقاذ وإيواء الكلاب والقطط المصابة في القاهرة الكبرى',
    focusEn: 'Rescue & shelter for injured street dogs and cats in Greater Cairo',
    link: 'https://www.facebook.com/esma.egypt'
  },
  {
    nameAr: 'مؤسسة هوب للإنقاذ والتأهيل (HOPE)',
    nameEn: 'HOPE Egyptian Baladi Rescue & Rehabilitation',
    regionAr: 'القاهرة الكبرى',
    regionEn: 'Greater Cairo',
    focusAr: 'تأهيل الكلاب البلدي المصابة وعلاج الحالات الحرجة والتبني',
    focusEn: 'Medical rehabilitation and adoption for injured Baladi street pets',
    link: 'https://www.facebook.com/HopeRescueEgypt'
  },
  {
    nameAr: 'جمعية SPARE لحماية الحيوان في مصر',
    nameEn: 'Society for the Protection of Animal Rights in Egypt (SPARE)',
    regionAr: 'الجيزة (شبرامنت)',
    regionEn: 'Giza (Shabrament)',
    focusAr: 'عيادة ومأوى لعلاج حيوانات الشارع والتوعية',
    focusEn: 'Shelter, clinic, and emergency medical care for street animals',
    link: 'https://www.facebook.com/SPAREgypt'
  },
  {
    nameAr: 'مؤسسة Animal Care in Egypt (ACE)',
    nameEn: 'Animal Care in Egypt (ACE)',
    regionAr: 'الأقصر وصعيد مصر',
    regionEn: 'Luxor & Upper Egypt',
    focusAr: 'مستشفى بيطري مجاني لعلاج الحيوانات المصابة في الأقصر',
    focusEn: 'Free veterinary hospital and emergency treatment in Luxor',
    link: 'https://www.ace-egypt.org.uk/'
  },
  {
    nameAr: 'جمعية Bluemoon لحماية الحيوان',
    nameEn: 'Bluemoon Animal Center',
    regionAr: 'الغردقة والبحر الأحمر',
    regionEn: 'Hurghada & Red Sea',
    focusAr: 'إنقاذ ورعاية القطط والكلاب في محافظة البحر الأحمر',
    focusEn: 'Street animal rescue, neutering, and care in the Red Sea region',
    link: 'https://www.facebook.com/BluemoonHurghada'
  },
  {
    nameAr: 'الخط الساخن للهيئة العامة للخدمات البيطرية',
    nameEn: 'General Organization for Veterinary Services Hotline',
    regionAr: 'جميع المحافظات (الخط الساخن: 19561)',
    regionEn: 'All Governorates (Hotline: 19561)',
    focusAr: 'البلاغات البيطرية الرسمية والوحدات البيطرية الحكومية بالمحافظات',
    focusEn: 'Official veterinary directorates and public clinics across Egypt',
    link: 'tel:19561'
  }
];

/**
 * Full First-Aid & Shelter Directory Modal.
 */
export default function FirstAidModal({ lang, onClose }) {
  const [tab, setTab] = useState('guide'); // 'guide' | 'shelters'
  const t = DICT[lang] || DICT.en;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="surface-card modal-box first-aid-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🩺 {t.firstAidModalTitle}</h2>
            <p className="modal-subtitle">{t.firstAidModalSubtitle}</p>
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

        <div className="modal-tabs-bar">
          <button
            type="button"
            className={`modal-tab-btn ${tab === 'guide' ? 'is-active' : ''}`}
            onClick={() => setTab('guide')}
          >
            🩹 {t.firstAidTabGuide}
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${tab === 'shelters' ? 'is-active' : ''}`}
            onClick={() => setTab('shelters')}
          >
            🏥 {t.firstAidTabShelters}
          </button>
        </div>

        <div className="modal-scroll-body">
          {tab === 'guide' ? (
            <div className="first-aid-topics-stack">
              {FIRST_AID_TOPICS.map((topic) => (
                <div key={topic.id} className="first-aid-topic-card">
                  <div className="first-aid-topic-header">
                    <span className="first-aid-topic-emoji" aria-hidden="true">
                      {topic.icon}
                    </span>
                    <h3 className="first-aid-topic-title">
                      {lang === 'ar' ? topic.titleAr : topic.titleEn}
                    </h3>
                  </div>
                  <ul className="first-aid-steps-list">
                    {(lang === 'ar' ? topic.stepsAr : topic.stepsEn).map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="shelters-grid">
              {EGYPT_SHELTERS.map((sh, idx) => (
                <div key={idx} className="shelter-card">
                  <div className="shelter-card-top">
                    <h3 className="shelter-name">
                      {lang === 'ar' ? sh.nameAr : sh.nameEn}
                    </h3>
                    <span className="shelter-region-pill">
                      📍 {lang === 'ar' ? sh.regionAr : sh.regionEn}
                    </span>
                  </div>
                  <p className="shelter-focus">
                    {lang === 'ar' ? sh.focusAr : sh.focusEn}
                  </p>
                  <a
                    href={sh.link}
                    target={sh.link.startsWith('tel:') ? '_self' : '_blank'}
                    rel="noopener noreferrer"
                    className="shelter-link-btn"
                  >
                    {sh.link.startsWith('tel:')
                      ? lang === 'ar'
                        ? '📞 اتصال مباشر (19561)'
                        : '📞 Call Hotline (19561)'
                      : lang === 'ar'
                        ? '🌐 فتح الصفحة الرسمية للتواصل'
                        : '🌐 Open Official Page'}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
