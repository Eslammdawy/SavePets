import { getGovernorateName, hasValidCoords } from './governorates';

export const DICT = {
  ar: {
    appName: 'Street Pets',
    appTagline: 'أنقذ وتبنَّ حيوانات الشارع في مصر',
    langToggle: 'English',
    tabShare: 'بلّغ عن حيوان',
    tabAdopt: 'أنقذ وتبنَّ',

    // Share View
    shareTitle: 'بلّغ عن حيوان يحتاج للإنقاذ',
    shareSubtitle: 'التقط صورة وحدد الموقع لمساعدة المنقذين والمتبنين في الوصول إليه بسرعة.',
    step1Title: 'الصورة والموقع',
    step2Title: 'حالة الحيوان وتفاصيله',
    step3Title: 'وسيلة التواصل (اختياري)',
    photoLabel: 'صورة الحيوان *',
    photoBtn: 'التقط صورة بالكاميرا أو ارفع من المعرض',
    photoCameraBtn: 'التقط صورة بالكاميرا',
    photoGalleryBtn: 'اختر صورة من المعرض',
    photoHint: 'صورة واضحة للحيوان والمكان المحيط تساعد المنقذين كثيراً',
    photoChangeBtn: 'تغيير الصورة',
    photoRetakeCameraBtn: 'الكاميرا',
    photoRetakeGalleryBtn: 'المعرض',
    photoCompressing: 'جاري ضغط وتحسين الصورة...',
    photoCompressedSize: 'حجم مثالي للرفع:',
    locationLabel: 'الموقع الجغرافي (GPS) — اختياري',
    useMyLocation: 'تحديد موقعي الحالي بالـ GPS (اختياري)',
    locationOptionalHint: 'يمكنك تثبيت إحداثيات الـ GPS لملء المحافظة والمنطقة تلقائياً، أو اختيار المحافظة وكتابة المدينة/المنطقة يدوياً بالأسفل.',
    locating: 'جاري تحديد الموقع...',
    locationCaptured: 'تم تثبيت الإحداثيات بنجاح',
    locationUpdate: 'تحديث',
    locationClear: 'إلغاء',
    locationDeniedError:
      'تعذر الوصول للـ GPS أو تم رفض الإذن. لا مشكلة! يمكنك اختيار المحافظة وكتابة المدينة أو المنطقة يدوياً بالأسفل.',
    locationRequiredError: 'يرجى اختيار المحافظة قبل الإرسال.',
    govLabel: 'المحافظة *',
    govPlaceholder: 'اختر المحافظة...',
    cityLabel: 'المدينة / المنطقة / الحي',
    cityPlaceholder: 'اكتب المدينة أو الحي يدوياً (مثال: المعادي، سموحة، الدقي)...',
    detectingAddress: 'جاري قراءة المحافظة والمنطقة تلقائياً...',
    typeLabel: 'نوع الحيوان *',
    condLabel: 'الحالة الصحية *',
    descLabel: 'وصف إضافي أو علامة مميزة للمكان',
    descPlaceholder: 'اكتب تفاصيل المكان أو حالة الحيوان لمساعدة المنقذين في العثور عليه...',
    descFollowUpHint: 'يمكن للمنقذين والمتبنين إضافة متابعات وتعليقات للموقع وحالة الحيوان لاحقاً لمتابعة الإنقاذ.',
    contactLabel: 'رقم واتساب للتواصل (اختياري)',
    contactPlaceholder: '010xxxxxxxx أو 2010xxxxxxxx',
    contactPrivacyNote:
      'خصوصيتك محمية: رقمك لا يظهر أبداً للجمهور، بل يظهر فقط زر يفتح محادثة واتساب مباشرة.',
    submitBtn: 'نشر البلاغ الآن',
    submittingBtn: 'جاري نشر البلاغ...',
    submitSuccess: 'تم نشر البلاغ بنجاح! شكراً لمبادرتك في إنقاذ روح.',
    pinIssuedTitle: 'احتفظ برقم البلاغ السري (PIN)',
    pinIssuedNote: (pin) =>
      `الرقم السري لبلاغك هو ${pin}. احتفظ به لإغلاق البلاغ عند إنقاذ الحيوان أو تبنيه (تم حفظه تلقائياً على هذا الجهاز).`,
    validationRequired: 'يرجى إضافة صورة الحيوان واختيار المحافظة.',
    validationContact: 'يرجى إدخال رقم واتساب صحيح مع كود الدولة (8 إلى 15 رقماً).',
    photoLoadError: 'تعذر تحميل الصورة. قد تكون صيغة الملف غير مدعومة أو تالفة. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.',
    photoHeicError: 'تعذر تحويل صورة HEIC تلقائياً. يرجى اختيار صورة بصيغة JPG أو PNG، أو إيقاف ميزة High Efficiency في إعدادات الكاميرا.',
    photoInvalidError: 'ملف غير صالح. يرجى اختيار ملف صورة.',
    photoTooLargeError: 'حجم الصورة بعد الضغط يتجاوز الحد الأقصى المسموح به (300 كيلوبايت).',

    // Animal types
    types: {
      dog: 'كلب',
      cat: 'قطة'
    },

    // Conditions
    conditions: {
      injured: 'مصاب',
      sick: 'مريض',
      pregnant: 'حامل / مع صغار',
      healthy: 'سليم للتبني',
      unsure: 'غير متأكد'
    },

    // Adopt View
    adoptTitle: 'أنقذ وتبنَّ حيواناً أليفاً',
    adoptSubtitle: 'تصفح البلاغات في محافظتك وساهم في إنقاذ أو تبني حيوانات الشارع.',
    quickGovLabel: 'تصفح سريع للمحافظات الأكثر نشاطاً:',
    filterGovLabel: 'المحافظة',
    filterCityLabel: 'المنطقة أو الحي',
    filterCityPlaceholder: 'ابحث باسم الحي أو المنطقة...',
    filterTypeLabel: 'النوع والحالة',
    filterAllTypes: 'الكل',
    filterUrgentOnly: 'حالات حرجة فقط',
    filterStatusNeedsRescue: 'في حاجة للإنقاذ',
    filterStatusAdopted: 'تم إنقاذها 🎉',
    filterStatusAll: 'جميع الحالات',
    searchBtn: 'تحديث النتائج',
    searchingBtn: 'جاري التحميل...',
    selectGovPromptTitle: 'ابدأ باختيار المحافظة',
    selectGovPrompt: 'اختر المحافظة من القائمة أو اضغط على إحدى المحافظات بالأسفل لعرض الحيوانات التي تحتاج للمساعدة.',
    emptyStateTitle: 'لا توجد بلاغات مطابقة حالياً',
    emptyState: 'لم يتم العثور على بلاغات في هذه المنطقة بهذه الفلاتر. جرب تغيير الفلتر أو بلّغ عن حيوان.',
    resetFiltersBtn: 'إعادة ضبط الفلاتر',
    loadMoreBtn: 'عرض المزيد من البلاغات',
    showingCount: (shown, total) => `عرض ${shown} من أصل ${total} بلاغ`,
    adoptedMilestone: (count) =>
      `🎉 تم بحمد الله إنقاذ وتبني ${count} ${count === 1 ? 'حالة' : 'حالات'} في هذه المنطقة!`,

    // Pet Card
    cardTitleNeedsHelp: (type) => `${type} يحتاج للمساعدة والإنقاذ`,
    cardTitleAdopt: (type) => `${type} أليف متاح للتبني`,
    noDescFallback: 'تم تحديد الموقع عبر الـ GPS — افتح الخريطة للوصول للمكان مباشرة.',
    noDescNoGpsFallback: 'لم يتم كتابة وصف إضافي — راجع منطقة البلاغ أو تواصل مع المبلّغ لمعرفة المكان بالتفصيل.',
    whatsappAvailable: 'متاح تواصل واتساب',
    readMore: 'اقرأ المزيد',
    readLess: 'عرض أقل',
    openMapsBtn: 'الموقع على الخريطة',
    openWhatsAppBtn: 'تواصل واتساب',
    openWhatsAppLoading: 'جاري التحميل...',
    whatsappFetchError: 'تعذر جلب رقم التواصل حالياً. حاول مرة أخرى.',
    markAdoptedBtn: 'تم الإنقاذ أو التبني بفضل الله',
    confirmAdoptedPrompt: 'تأكيد أنه تم إنقاذه أو تبنيه؟',
    reportAdoptedBtn: 'إبلاغ أنه تم الإنقاذ / التبني',
    confirmReportAdoptedPrompt: 'إرسال إشعار للمشرفين بأنه تم إنقاذه أو تبنيه؟',
    reportAdoptedSuccess: 'تم إرسال الإشعار للمراجعة. شكراً لمساعدتك!',
    actionFailedError: 'تعذر تنفيذ العملية حالياً. يرجى المحاولة لاحقاً.',
    confirmYes: 'نعم، تأكيد',
    confirmCancel: 'إلغاء',
    adoptedBadge: 'تم الإنقاذ والتبني 🎉',
    adoptedCaseClosed: 'تم إنقاذ هذه الحالة وإغلاق البلاغ بنجاح 🎉',

    // Pet Card Comments & Follow-ups
    commentsTitle: 'المتابعات والتعليقات على المكان',
    commentsSubtitle: 'شارك آخر المستجدات عن مكان وحالة الحيوان لمساعدة المنقذين.',
    commentsCountLabel: (count) => (count === 1 ? 'متابعة' : count === 2 ? 'متابعتان' : 'متابعات'),
    addFollowUpBtn: 'إضافة متابعة / تعليق',
    hideFollowUpsBtn: 'إخفاء المتابعات',
    noCommentsYet: 'لا توجد تعليقات أو متابعات بعد. هل قمت بتفقد الحيوان أو لديك علامة أوضح؟ أضف تحديثك بالأسفل.',
    loadingComments: 'جاري تحميل المتابعات...',
    commentAuthorLabel: 'الاسم أو الصفة (اختياري)',
    commentAuthorPlaceholder: 'اسمك أو صفتك (مثال: أحمد - متطوع، فاعل خير)...',
    commentTextLabel: 'اكتب متابعة أو علامة إضافية',
    commentTextPlaceholder: 'اكتب مستجدات الحيوان، هل تم تفقده، هل تم إطعامه، مكانه بالتحديد الآن...',
    postCommentBtn: 'نشر المتابعة',
    postingCommentBtn: 'جاري النشر...',
    commentPostedSuccess: 'تمت إضافة المتابعة بنجاح! شكراً لاهتمامك.',
    commentValidationRequired: 'يرجى كتابة نص المتابعة أو التعليق قبل الإرسال.',
    quickPresetTitle: 'تحديثات سريعة:',
    quickPresets: [
      '🐾 تفقدت الحيوان وما زال موجوداً',
      '🍲 تم تقديم طعام وماء نظيف',
      '🩺 جاري التنسيق مع عيادة بيطرية لنقله',
      '📍 تحديث للعلامة المميزة للمكان'
    ],

    // 1. Near Me & Distance Sorting
    nearMeBtn: 'الأقرب إليّ الآن',
    nearMeActiveBtn: 'مرتب حسب الأقرب إليك',
    nearMeLocating: 'جاري تحديد موقعك...',
    detectMyGovBtn: 'اكتشف محافظتي واعرض الأقرب إليّ بالـ GPS',
    radiusAll: 'كل المسافات',
    radiusWithin: (km) => `في نطاق ${km} كم`,

    // 2. Social Share & Rescue Poster
    shareCaseBtn: 'مشاركة الحالة',
    posterBtn: 'بوستر إنقاذ',
    shareCopiedToast: 'تم نسخ تفاصيل البلاغ والرابط!',
    posterModalTitle: 'بطاقة إنقاذ جاهزة للنشر',
    posterModalSubtitle: 'شارك هذه البطاقة في جروبات الإنقاذ على فيسبوك أو حالات واتساب وإنستجرام لإنقاذه أسرع.',
    downloadPosterBtn: 'تحميل صورة البوستر (PNG)',
    sharePosterNativeBtn: 'مشاركة البطاقة مباشرة',
    copyShareTextBtn: 'نسخ نص البلاغ للمشاركة',
    closeModalBtn: 'إغلاق',

    // 3. Interactive Map View Toggle
    viewListBtn: 'القائمة',
    viewMapBtn: 'الخريطة التفاعلية',
    mapLegendUrgent: 'حالة حرجة (مصاب/مريض)',
    mapLegendPregnant: 'حامل / مع صغار',
    mapLegendHealthy: 'سليم للتبني',
    mapLegendYou: 'موقعك الحالي',
    mapClickPinHint: 'اضغط على أي علامة على الخريطة لعرض تفاصيل الحيوان والتواصل.',
    mapLoadError: 'تعذر تحميل الخريطة التفاعلية حالياً (تأكد من الاتصال بالإنترنت). يمكنك استعراض الحالات بالأسفل.',
    errorBoundaryTitle: 'حدث خطأ غير متوقع في عرض هذا الجزء',
    errorBoundaryText: 'يرجى المحاولة مرة أخرى.',
    errorBoundaryRetryBtn: 'إعادة المحاولة',

    // 4. Emergency First-Aid & Shelter Directory
    firstAidHeaderBtn: 'الإسعافات والملاجئ',
    firstAidBannerTitle: 'إرشادات إسعافات أولية سريعة (قبل وصول المساعدة)',
    firstAidBannerSub: 'خطوات بسيطة وآمنة قد تنقذ حياة الحيوان المصاب أو المريض الآن:',
    openShelterDirBtn: 'دليل ملاجئ وجمعيات الإنقاذ وأرقام الطوارئ',
    firstAidModalTitle: 'دليل الإسعافات الأولية وملاجئ الإنقاذ في مصر',
    firstAidModalSubtitle: 'كيف تتعامل بأمان مع حيوان مصاب في الشارع وأبرز جهات الإنقاذ',
    firstAidTabGuide: 'الإسعافات الأولية',
    firstAidTabShelters: 'الملاجئ والجمعيات',

    // 5. Saved / Bookmarked Cases
    saveCaseBtn: 'حفظ للمتابعة',
    savedCaseBtn: 'محفوظ',
    filterSavedOnly: (count) => `المحفوظات (${count})`,
    emptySavedTitle: 'لا توجد حالات محفوظة حالياً',
    emptySavedText: 'اضغط على زر "حفظ" في أي بلاغ لمتابعته لاحقاً أو التنسيق مع أصدقائك لإنقاذه.',

    // 6. Offline Queue & PWA
    offlineBannerTitle: 'أنت غير متصل بالإنترنت حالياً',
    offlineQueueCount: (count) =>
      count === 1
        ? 'لديك بلاغ واحد محفوظ على جهازك في انتظار الاتصال بالإنترنت.'
        : `لديك ${count} بلاغات محفوظة على جهازك في انتظار الاتصال بالإنترنت.`,
    syncNowBtn: 'إرسال البلاغات المعلقة الآن',
    syncingBtn: 'جاري الإرسال...',
    savedOfflineSuccess:
      'لا يوجد اتصال بالإنترنت حالياً — تم حفظ البلاغ والصورة بأمان على جهازك وسيتم نشره تلقائياً فور عودة الاتصال!',
    offlineStorageFullError:
      'مساحة التخزين ممتلئة أو تم الوصول للحد الأقصى للبلاغات المعلقة. يرجى توفير مساحة أو الإرسال عند الاتصال بالإنترنت.',
    offlineFailedTitle: 'تعذر نشر بلاغ محفوظ بسبب خطأ دائم:',
    discardFailedBtn: 'تجاهل وحذف',
    syncCompleteToast: (count) => `تم نشر ${count} بلاغ محفوظ بنجاح!`,
    installAppBtn: 'تثبيت التطبيق'
  },

  en: {
    appName: 'Street Pets',
    appTagline: 'Rescue & adopt street animals in Egypt',
    langToggle: 'العربية',
    tabShare: 'Report a Pet',
    tabAdopt: 'Rescue & Adopt',

    // Share View
    shareTitle: 'Report a pet in need',
    shareSubtitle: 'Snap a photo and pin the location so nearby rescuers and adopters can reach it.',
    step1Title: 'Photo & Location',
    step2Title: 'Animal Details & Condition',
    step3Title: 'Contact Info (Optional)',
    photoLabel: 'Pet Photo *',
    photoBtn: 'Take a Photo or Choose from Gallery',
    photoCameraBtn: 'Take a Photo',
    photoGalleryBtn: 'Choose from Gallery',
    photoHint: 'A clear photo showing the animal and surroundings helps rescuers find it faster',
    photoChangeBtn: 'Change Photo',
    photoRetakeCameraBtn: 'Camera',
    photoRetakeGalleryBtn: 'Gallery',
    photoCompressing: 'Optimizing photo...',
    photoCompressedSize: 'Optimized size:',
    locationLabel: 'GPS Location (Optional)',
    useMyLocation: 'Pin my current GPS location (Optional)',
    locationOptionalHint: 'You can pin your GPS coordinates to auto-fill the area, or simply select the governorate and enter the city/area manually below.',
    locating: 'Getting GPS coordinates...',
    locationCaptured: 'GPS coordinates pinned',
    locationUpdate: 'Update',
    locationClear: 'Remove',
    locationDeniedError:
      'Could not access GPS location. No worries — you can select the governorate and enter the city/area manually below.',
    locationRequiredError: 'Please select a governorate before submitting.',
    govLabel: 'Governorate *',
    govPlaceholder: 'Select governorate...',
    cityLabel: 'City / Area / Neighborhood',
    cityPlaceholder: 'Enter city or neighborhood manually (e.g. Maadi, Smouha, Dokki)...',
    detectingAddress: 'Auto-detecting governorate & area...',
    typeLabel: 'Animal Type *',
    condLabel: 'Health Condition *',
    descLabel: 'Description & Nearby Landmarks',
    descPlaceholder: 'Describe the animal or nearby landmarks to help rescuers locate it...',
    descFollowUpHint: 'Rescuers and adopters can post follow-up comments and location updates on this case later.',
    contactLabel: 'WhatsApp Number (optional)',
    contactPlaceholder: '010xxxxxxxx or 2010xxxxxxxx',
    contactPrivacyNote:
      'Privacy protected: Your number is never shown publicly. Adopters only get a direct WhatsApp chat button.',
    submitBtn: 'Publish Rescue Report',
    submittingBtn: 'Publishing report...',
    submitSuccess: 'Pet report shared successfully! Thank you for helping save a life.',
    pinIssuedTitle: 'Save your 4-digit reporter PIN',
    pinIssuedNote: (pin) =>
      `Your report PIN is ${pin}. Save this code to close the case once rescued (also saved on this device).`,
    validationRequired: 'Photo and governorate are required.',
    validationContact: 'Please enter a valid WhatsApp number with country code (8–15 digits).',
    photoLoadError: 'Failed to load image. The photo format might not be supported or the file is corrupted. Please choose a JPG, PNG, or WebP photo.',
    photoHeicError: 'Could not convert HEIC photo automatically. Please select a JPG or PNG photo, or disable "High Efficiency" mode in your camera settings.',
    photoInvalidError: 'Invalid image file. Please choose an image.',
    photoTooLargeError: 'Photo exceeds maximum allowed size (300 KB).',

    // Animal types
    types: {
      dog: 'Dog',
      cat: 'Cat'
    },

    // Conditions
    conditions: {
      injured: 'Injured',
      sick: 'Sick',
      pregnant: 'Pregnant / With Young',
      healthy: 'Healthy / For Adoption',
      unsure: 'Not sure'
    },

    // Adopt View
    adoptTitle: 'Rescue & adopt a street pet',
    adoptSubtitle: 'Browse reports in your governorate to rescue an animal in distress or give it a home.',
    quickGovLabel: 'Quick-select popular governorates:',
    filterGovLabel: 'Governorate',
    filterCityLabel: 'Area / Neighborhood',
    filterCityPlaceholder: 'Filter by neighborhood or city...',
    filterTypeLabel: 'Quick Filters',
    filterAllTypes: 'All Pets',
    filterUrgentOnly: 'Urgent Cases Only',
    filterStatusNeedsRescue: 'Needs Rescue',
    filterStatusAdopted: 'Rescued 🎉',
    filterStatusAll: 'All Cases',
    searchBtn: 'Refresh Results',
    searchingBtn: 'Loading...',
    selectGovPromptTitle: 'Select a governorate to start',
    selectGovPrompt: 'Choose a governorate above or tap one of the quick shortcuts below to see animals nearby.',
    emptyStateTitle: 'No matching reports found',
    emptyState: 'No pets matched these filters in this area yet. Try clearing filters or report a pet in need.',
    resetFiltersBtn: 'Reset filters',
    loadMoreBtn: 'Load more pets',
    showingCount: (shown, total) => `Showing ${shown} of ${total} reports`,
    adoptedMilestone: (count) =>
      count === 1
        ? '🎉 1 street pet successfully rescued and adopted in this area!'
        : `🎉 ${count} street pets successfully rescued and adopted in this area!`,

    // Pet Card
    cardTitleNeedsHelp: (type) => `${type} needs rescue & care`,
    cardTitleAdopt: (type) => `${type} available for adoption`,
    noDescFallback: 'Exact GPS coordinates pinned — open Google Maps to navigate to the spot.',
    noDescNoGpsFallback: 'No extra landmark notes provided — check the area name or contact the reporter for details.',
    whatsappAvailable: 'WhatsApp contact available',
    readMore: 'Read more',
    readLess: 'Show less',
    openMapsBtn: 'View on Maps',
    openWhatsAppBtn: 'WhatsApp Chat',
    openWhatsAppLoading: 'Loading...',
    whatsappFetchError: 'Could not load contact number right now. Please try again.',
    markAdoptedBtn: 'Mark as Rescued / Adopted',
    confirmAdoptedPrompt: 'Confirm this pet was rescued/adopted?',
    reportAdoptedBtn: 'Report as Rescued / Adopted',
    confirmReportAdoptedPrompt: 'Notify moderators that this pet was rescued or adopted?',
    reportAdoptedSuccess: 'Reported for moderator review. Thank you!',
    actionFailedError: 'Action could not be completed. Please try again.',
    confirmYes: 'Yes, confirm',
    confirmCancel: 'Cancel',
    adoptedBadge: 'Rescued & Adopted 🎉',
    adoptedCaseClosed: 'This pet was successfully rescued & adopted! 🎉',

    // Pet Card Comments & Follow-ups
    commentsTitle: 'Follow-ups & Landmark Comments',
    commentsSubtitle: 'Share recent updates on the animal condition or exact spot to help rescuers.',
    commentsCountLabel: (count) => (count === 1 ? 'Follow-up' : 'Follow-ups'),
    addFollowUpBtn: 'Add follow-up / comment',
    hideFollowUpsBtn: 'Hide follow-ups',
    noCommentsYet: 'No follow-up updates yet. Checked on this pet or know a clearer landmark? Post an update below.',
    loadingComments: 'Loading follow-ups...',
    commentAuthorLabel: 'Your name or role (optional)',
    commentAuthorPlaceholder: 'Your name / role (e.g. Sarah - Rescuer, Neighbor)...',
    commentTextLabel: 'Write a follow-up or landmark note',
    commentTextPlaceholder: 'Write an update: pet condition, fed, exact spot right now...',
    postCommentBtn: 'Post Update',
    postingCommentBtn: 'Posting...',
    commentPostedSuccess: 'Follow-up posted successfully! Thank you.',
    commentValidationRequired: 'Please enter a comment or follow-up note before posting.',
    quickPresetTitle: 'Quick updates:',
    quickPresets: [
      '🐾 Checked on pet, still at the spot',
      '🍲 Provided food and clean water',
      '🩺 Coordinating vet care / rescue transfer',
      '📍 Updated nearby landmark info'
    ],

    // 1. Near Me & Distance Sorting
    nearMeBtn: 'Sort by Closest to Me',
    nearMeActiveBtn: 'Sorted by Closest',
    nearMeLocating: 'Locating you...',
    detectMyGovBtn: 'Auto-Detect My Area & Nearest Pets via GPS',
    radiusAll: 'Any distance',
    radiusWithin: (km) => `Within ${km} km`,

    // 2. Social Share & Rescue Poster
    shareCaseBtn: 'Share Case',
    posterBtn: 'Rescue Poster',
    shareCopiedToast: 'Rescue summary & map link copied!',
    posterModalTitle: 'Ready-to-Share Rescue Poster',
    posterModalSubtitle: 'Download or share this card to Facebook rescue groups, WhatsApp Status, or Instagram Stories.',
    downloadPosterBtn: 'Download Poster Image (PNG)',
    sharePosterNativeBtn: 'Share Poster Image',
    copyShareTextBtn: 'Copy Rescue Text & Link',
    closeModalBtn: 'Close',

    // 3. Interactive Map View Toggle
    viewListBtn: 'List View',
    viewMapBtn: 'Map View',
    mapLegendUrgent: 'Urgent (Injured/Sick)',
    mapLegendPregnant: 'Pregnant / With Young',
    mapLegendHealthy: 'Healthy / For Adoption',
    mapLegendYou: 'Your Location',
    mapClickPinHint: 'Tap any pin on the map to inspect the animal and get directions.',
    mapLoadError: 'Could not load the interactive map (check your connection). You can still browse cases below.',
    errorBoundaryTitle: 'Something went wrong displaying this section',
    errorBoundaryText: 'Please try again.',
    errorBoundaryRetryBtn: 'Try again',

    // 4. Emergency First-Aid & Shelter Directory
    firstAidHeaderBtn: 'First-Aid & Shelters',
    firstAidBannerTitle: 'Urgent Street First-Aid Tips (While Waiting for Help)',
    firstAidBannerSub: 'Safe, practical steps that can save an injured or sick animal right now:',
    openShelterDirBtn: 'Egypt Rescue Shelters & Emergency Directory',
    firstAidModalTitle: 'Street Animal First-Aid & Egypt Rescue Directory',
    firstAidModalSubtitle: 'How to safely stabilize an animal in distress and reach local shelters',
    firstAidTabGuide: 'First-Aid Guide',
    firstAidTabShelters: 'Shelters & Hotlines',

    // 5. Saved / Bookmarked Cases
    saveCaseBtn: 'Save Case',
    savedCaseBtn: 'Saved',
    filterSavedOnly: (count) => `Saved (${count})`,
    emptySavedTitle: 'No saved cases yet',
    emptySavedText: 'Tap "Save Case" on any report to bookmark it and coordinate a rescue or adoption.',

    // 6. Offline Queue & PWA
    offlineBannerTitle: 'You are currently offline',
    offlineQueueCount: (count) =>
      count === 1
        ? '1 pet report is safely queued on your device and will publish when online.'
        : `${count} pet reports are safely queued on your device and will publish when online.`,
    syncNowBtn: 'Sync Queued Reports Now',
    syncingBtn: 'Syncing...',
    savedOfflineSuccess:
      'No internet connection right now — your report & photo were saved offline and will publish automatically once you reconnect!',
    offlineStorageFullError:
      'Storage is full, free some space or submit when online.',
    offlineFailedTitle: 'A queued report failed permanently:',
    discardFailedBtn: 'Discard',
    syncCompleteToast: (count) => `Successfully published ${count} queued report(s)!`,
    installAppBtn: 'Install App'
  }
};

/**
 * Format epoch seconds into a human-readable relative time string.
 */
export function formatTimeAgo(epochSec, lang = 'ar') {
  const nowSec = Math.floor(Date.now() / 1000);
  let raw = Number(epochSec || nowSec);
  if (!Number.isFinite(raw)) {
    const parsedMs = Date.parse(String(epochSec));
    raw = Number.isFinite(parsedMs) ? parsedMs : nowSec;
  }
  const targetSec = raw > 1e11 ? Math.floor(raw / 1000) : raw;
  const diffSec = Math.max(0, nowSec - targetSec);
  const mins = Math.floor(diffSec / 60);
  const hours = Math.floor(diffSec / 3600);
  const days = Math.floor(diffSec / 86400);

  if (lang === 'ar') {
    if (mins < 2) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours < 24) return `منذ ${hours} ساعات`;
    if (days === 1) return 'منذ يوم';
    if (days === 2) return 'منذ يومين';
    return `منذ ${days} أيام`;
  }

  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Build the auto-generated summary line required by the spec:
 * e.g. "Injured dog spotted in Maadi, Cairo, 2 days ago. Needs help. Contact via WhatsApp."
 */
export function buildAutoSummary(pet, lang = 'ar') {
  const t = DICT[lang] || DICT.en;
  const govName = getGovernorateName(pet.gov, lang);
  const cityText = String(pet.city || '').trim();
  const hasDistinctCity =
    cityText && cityText.toLowerCase() !== govName.toLowerCase();
  const typeLabel = (t.types[pet.type] || pet.type || '').toLowerCase();
  const condLabel = t.conditions[pet.cond] || pet.cond || '';
  const timeAgo = formatTimeAgo(pet.t, lang);
  const hasContact = Boolean(pet.hc || pet.contact);

  if (lang === 'ar') {
    const locText = hasDistinctCity ? `${cityText}، ${govName}` : govName;
    const actionPart =
      pet.cond === 'healthy' ? 'متاح للتبني والإنقاذ.' : 'يحتاج للمساعدة.';
    const contactPart = hasContact ? ' تواصل عبر واتساب.' : '';
    return `${t.types[pet.type] || pet.type} (${condLabel}) شوهد في ${locText}، ${timeAgo}. ${actionPart}${contactPart}`;
  }

  const locText = hasDistinctCity ? `${cityText}, ${govName}` : govName;
  const actionPart =
    pet.cond === 'healthy' ? 'Looking for a home.' : 'Needs help.';
  const contactPart = hasContact ? ' Contact via WhatsApp.' : '';
  return `${condLabel} ${typeLabel} spotted in ${locText}, ${timeAgo}. ${actionPart}${contactPart}`;
}

/**
 * Build prefilled WhatsApp message mentioning the pet's city and animal type.
 * Phone digits are passed explicitly after an on-demand fetch so they never live on the pet object.
 */
export function buildWhatsAppUrl(pet, lang = 'ar', contactDigits = '') {
  const raw = contactDigits || (pet && pet.contact) || '';
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return '';

  const t = DICT[lang] || DICT.en;
  const govName = getGovernorateName(pet.gov, lang);
  const cityText = String(pet.city || '').trim();
  const hasDistinctCity =
    cityText && cityText.toLowerCase() !== govName.toLowerCase();
  const typeLabel = t.types[pet.type] || pet.type;

  const message =
    lang === 'ar'
      ? `مرحباً، رأيت بلاغك على تطبيق Street Pets بخصوص ${typeLabel} في ${hasDistinctCity ? `${cityText} (${govName})` : govName} وأود المساعدة في إنقاذه/تبنيه.`
      : `Hello! I saw your Street Pets report about the ${typeLabel.toLowerCase()} in ${hasDistinctCity ? `${cityText} (${govName})` : govName} and would like to help rescue/adopt it.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Build Google Maps search/pin URL for a pet (uses exact lat,lng when available, or city + governorate query).
 */
export function buildPetMapsUrl(pet, lang = 'ar') {
  if (!pet) return '';
  if (hasValidCoords(pet)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${pet.lat},${pet.lng}`)}`;
  }
  const govName = getGovernorateName(pet.gov, lang);
  const cityText = String(pet.city || '').trim();
  const hasDistinctCity =
    cityText && cityText.toLowerCase() !== govName.toLowerCase();
  const query = [
    hasDistinctCity ? cityText : '',
    govName,
    lang === 'ar' ? 'مصر' : 'Egypt'
  ]
    .filter(Boolean)
    .join(', ');
  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}` : '';
}

/**
 * Build shareable text summary + Google Maps link for a pet report.
 */
export function buildShareText(pet, lang = 'ar') {
  const summary = buildAutoSummary(pet, lang);
  const mapsUrl = buildPetMapsUrl(pet, lang);
  const desc = String(pet.desc || '').trim();

  if (lang === 'ar') {
    return [
      `🐾 نداء إنقاذ عبر تطبيق Street Pets Egypt`,
      summary,
      desc ? `📝 التفاصيل: ${desc}` : '',
      mapsUrl ? `📍 الموقع على الخريطة: ${mapsUrl}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `🐾 Street Pets Egypt — Rescue Alert`,
    summary,
    desc ? `📝 Details: ${desc}` : '',
    mapsUrl ? `📍 Location on Maps: ${mapsUrl}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Trigger native Web Share API or copy to clipboard as fallback.
 */
export async function sharePetCaseNative(pet, lang = 'ar') {
  const text = buildShareText(pet, lang);
  const mapsUrl = buildPetMapsUrl(pet, lang);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'Street Pets Egypt',
        text,
        ...(mapsUrl ? { url: mapsUrl } : {})
      });
      return { shared: true, copied: false };
    } catch (_err) {
      // User cancelled or share failed; fall back to clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return { shared: false, copied: true };
  }

  return { shared: false, copied: false };
}
