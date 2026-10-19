import React, { useState } from 'react';
import { DICT } from './i18n';

export const FIRST_AID_TOPICS = [
  {
    id: 'injured',
    icon: '🩹',
    titleAr: 'حادث سير أو نزيف أو كسور',
    titleEn: 'Road Accident, Bleeding, or Fractures',
    stepsAr: [
      'اقترب بهدوء وتحدث بصوت منخفض؛ الحيوان المتألم قد يعض بدافع الخوف.',
      'استخدم بطانية أو جاكيت سميك للفّ الحيوان برفق أو نقله كـ "نقالة" مسطحة دون ثني العمود الفقري.',
      'لإيقاف النزيف: اضغط بقطعة قماش نظيفة أو شاش بشكل مباشر وثابت على الجرح لمدة 3–5 دقائق.',
      'لا تعطِ أي مسكنات بشرية (مثل الباراسيتامول أو الإيبوبروفين) لأنها سامة وقاتلة للقطط والكلاب.'
    ],
    stepsEn: [
      'Approach slowly and speak softly; a terrified, injured animal may bite out of pain.',
      'Slide a thick towel, blanket, or cardboard sheet under the animal to act as a flat stretcher—keep the spine straight.',
      'To stop bleeding: press firmly with a clean cloth or gauze pad directly on the wound for 3–5 minutes.',
      'NEVER give human painkillers (Paracetamol/Ibuprofen/Panadol)—they are fatally toxic to cats and dogs.'
    ]
  },
  {
    id: 'poison',
    icon: '⚠️',
    titleAr: 'اشتباه تسمم (رعشة أو سيلان لعاب شديد)',
    titleEn: 'Suspected Poisoning (Tremors, Foaming, Seizures)',
    stepsAr: [
      'أبعد الحيوان فوراً عن أي بقايا طعام مشبوهة في المكان وصوّر المادة إن وجدت لمعرفة نوع السم.',
      'حافظ على هدوء الحيوان في مكان مظلل وجيد التهوية، ولا تحاول إجباره على التقيؤ إذا كان يعاني من تشنجات.',
      'تواصل فوراً مع أقرب عيادة بيطرية (مضادات التسمم مثل الأتروبين والفحم النشط والمحاليل الوريدية تنقذ حياته إذا أُعطيت سريعاً).'
    ],
    stepsEn: [
      'Move the animal away from any suspected bait/food immediately and remove remaining bait so other animals do not eat it.',
      'Keep the animal quiet in a shaded, cool spot. Do NOT force vomiting if it is convulsing or unconscious.',
      'Rush to the nearest vet immediately for IV fluids, activated charcoal, or atropine.'
    ]
  },
  {
    id: 'heat',
    icon: '☀️',
    titleAr: 'ضربة شمس أو جفاف وإعياء شديد',
    titleEn: 'Heatstroke & Severe Dehydration',
    stepsAr: [
      'انقل الحيوان فوراً إلى الظل أو مكان مكيف، وضع تحته فوطة مبللة بماء فاتر (وليس ثلجاً لتجنب صدمة الأوعية الدموية).',
      'بلّل كفوف الأقدام والأذنين ومنطقة البطن بالماء الفاتر تدريجياً.',
      'قدّم ماءً للشرب بكميات صغيرة، ولا تجبره على البلع بالسرنجة إذا كان غير واعٍ.'
    ],
    stepsEn: [
      'Move the animal into shade immediately and place a cool, damp towel under its body.',
      'Wet the paw pads, ears, and belly with cool (NOT ice-cold) water to bring body temperature down safely.',
      'Offer small amounts of fresh water—never force water into the mouth of an unconscious animal.'
    ]
  },
  {
    id: 'pregnant',
    icon: '🍼',
    titleAr: 'أم حامل أو صغار رضع بدون أم',
    titleEn: 'Pregnant Mother or Orphaned Kittens/Puppies',
    stepsAr: [
      'إذا وجدت صغاراً بمفردهم: راقب من بعيد لمدة ساعتين؛ غالباً تكون الأم تبحث عن طعام وستعود إليهم.',
      'إذا كانت الصغار باردة: التدفئة أهم من الطعام! ضعهم قرب زجاجة ماء دافئ ملفوفة بفوطة.',
      'تحذير هام: لا تعطِ اللبن البقري العادي للرضع لأنه يسبب إسهالاً وجفافاً قاتلاً؛ استخدم بديل لبن مخصص للقطط/الكلاب أو لبن خالي اللاكتوز مؤقتاً.'
    ],
    stepsEn: [
      'If you find young puppies/kittens alone: wait and observe from a distance for 1–2 hours—the mother is often just searching for food.',
      'If orphans feel cold: warm them first with a towel-wrapped warm water bottle before feeding.',
      'NEVER feed regular cow milk to newborns (it causes fatal diarrhea/dehydration); use kitten/puppy milk replacer or lactose-free formula.'
    ]
  }
];

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
 * Inline collapsible First-Aid banner rendered inside ShareView when reporting an injured/sick/pregnant pet.
 */
export function FirstAidInlineCard({ condition, lang, onOpenFullModal }) {
  const t = DICT[lang] || DICT.en;
  const activeTopic =
    FIRST_AID_TOPICS.find((item) => item.id === condition) ||
    (condition === 'sick' ? FIRST_AID_TOPICS[1] : FIRST_AID_TOPICS[0]);

  const title = lang === 'ar' ? activeTopic.titleAr : activeTopic.titleEn;
  const steps = lang === 'ar' ? activeTopic.stepsAr : activeTopic.stepsEn;

  return (
    <div className="first-aid-inline-card">
      <div className="first-aid-inline-header">
        <span className="first-aid-badge-icon" aria-hidden="true">
          {activeTopic.icon}
        </span>
        <div>
          <h3 className="first-aid-inline-title">{t.firstAidBannerTitle}</h3>
          <p className="first-aid-inline-sub">
            {title} — {t.firstAidBannerSub}
          </p>
        </div>
      </div>

      <ul className="first-aid-steps-list">
        {steps.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-secondary btn-shelter-dir"
        onClick={onOpenFullModal}
      >
        <span aria-hidden="true">🏥</span>
        <span>{t.openShelterDirBtn}</span>
      </button>
    </div>
  );
}

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
