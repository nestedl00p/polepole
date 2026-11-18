// Copy for the marketing landing page, in each language a visitor can read it
// in. Each language pitches the course taught in it: English and Spanish readers
// are offered Swahili, Swahili readers are offered English (see
// context/LocaleContext.jsx).
//
// Swahili phrases that are the brand's voice ("pole pole", "Anza leo") stay in
// Swahili in every locale.

const en = {
  nav: { course: 'Course', curriculum: 'Curriculum', how: 'How it works', pricing: 'Pricing' },
  login: 'Log in',
  getStarted: 'Get started',
  myDashboard: 'My dashboard',
  goToDashboard: 'Go to my dashboard',
  tryNow: 'Try 3 words now',

  eyebrow: '🐢 Learn Swahili, the steady way',
  heroTitle: 'Learn Swahili,',
  heroLead: [
    'A complete, guided Swahili course that takes you from your first greeting to real conversations — one bite-sized lesson at a time. ',
    ': slowly but surely is the way.',
  ],
  seeCurriculum: 'See the curriculum',
  trust: '30 seconds · No account needed',

  stats: ['Guided lessons', 'Weekly themes', 'Words & phrases', 'Beginner to talking'],

  featuresTitle: 'Everything you need to actually learn',
  featuresLead: 'Not just word lists — a full system designed to build a real habit and real fluency.',
  features: [
    { title: 'A guided 0-to-conversational path', body: 'A structured curriculum that takes you from your first “Jambo” to holding real conversations — no guessing what to study next.' },
    { title: 'Pole pole — at your own pace', body: 'Pick a 30, 60 or 90-day plan. Lessons unlock on schedule so you build a steady habit instead of burning out.' },
    { title: 'Flashcards & spaced practice', body: 'Lock in vocabulary with flip-card drills and quick practice quizzes built from every lesson you complete.' },
    { title: 'Quizzes that actually check you', body: 'Multiple-choice and free-typing questions with hints and instant feedback after each lesson.' },
    { title: 'Streaks, XP & progress', body: 'Earn XP, keep your daily streak alive, and watch your course-completion bar fill as you go.' },
    { title: 'Real dialogues & culture', body: 'Learn the Swahili people actually speak — greetings, markets, travel, and the culture behind the words.' },
  ],

  howTitle: 'How PolePole works',
  howLead: 'Three simple steps. Show up a little each day, and it adds up fast.',
  steps: [
    { title: 'Try three words first', body: 'No sign-up. If you want to keep going, an account saves what you just did.' },
    { title: 'Learn a lesson a day', body: 'Read, listen, and absorb bite-sized lessons that unlock on schedule.' },
    { title: 'Practice & prove it', body: 'Drill flashcards and pass the quiz to unlock the next lesson.' },
  ],

  curriculumTitle: 'A curriculum with a clear path',
  curriculumLead: 'Four themed weeks that build on each other — from foundations to fluent-sounding conversation.',
  week: (n) => `Week ${n}`,
  weeks: [
    { title: 'Foundations', body: 'Greetings, pronunciation, pronouns, and your very first sentences.' },
    { title: 'Noun Classes, Numbers & Time', body: 'The famous Swahili noun classes, counting, and telling the time.' },
    { title: 'Tenses & Daily Life', body: 'Past, present and future tenses through everyday situations.' },
    { title: 'Complex Sentences & Culture', body: 'Connectors, fuller conversations, and cultural context to sound natural.' },
  ],

  pricingTitle: 'Simple pricing',
  pricingLead: 'The whole course, free while PolePole is in beta.',
  priceTag: 'Free',
  pricePeriod: '/ during beta',
  priceList: [
    'Full 31-lesson Swahili course',
    'Flashcards & practice quizzes',
    'Streaks, XP & progress tracking',
    'Web & mobile access',
    'Learn at your own pace',
  ],

  faqTitle: 'Questions, answered',
  faqs: [
    { q: 'Do I need any prior Swahili?', a: 'None at all. PolePole starts from absolute zero — your first lesson is greetings and pronunciation.' },
    { q: 'How long does the course take?', a: 'That’s up to you. Choose a 30-day intensive sprint or a relaxed 90-day plan — you can change your pace anytime.' },
    { q: 'How much does it cost?', a: 'PolePole is free while in beta. Create an account and start the full course today.', pricing: true },
    { q: 'Is there a mobile app?', a: 'Yes — PolePole also runs as a mobile app, so you can keep learning on your phone wherever you are.' },
  ],

  ctaTitle: 'Anza leo — start today.',
  ctaBody: 'Your first Swahili conversation is closer than you think. Pole pole, hatua kwa hatua.',

  footerTagline: 'Learn Swahili, pole pole. The steady, guided way to go from zero to conversational.',
  footerMade: 'Made with 🐢 and pole pole patience.',
};

const es = {
  nav: { course: 'Curso', curriculum: 'Temario', how: 'Cómo funciona', pricing: 'Precios' },
  login: 'Entrar',
  getStarted: 'Empezar',
  myDashboard: 'Mi panel',
  goToDashboard: 'Ir a mi panel',
  tryNow: 'Prueba 3 palabras ahora',

  eyebrow: '🐢 Aprende suajili, con paso firme',
  heroTitle: 'Aprende suajili,',
  heroLead: [
    'Un curso de suajili completo y guiado que te lleva de tu primer saludo a conversaciones reales, una lección breve cada vez. ',
    ': despacio pero seguro se llega lejos.',
  ],
  seeCurriculum: 'Ver el temario',
  trust: '30 segundos · Sin crear una cuenta',

  stats: ['Lecciones guiadas', 'Temas semanales', 'Palabras y frases', 'De principiante a conversar'],

  featuresTitle: 'Todo lo que necesitas para aprender de verdad',
  featuresLead: 'No solo listas de palabras: un sistema completo pensado para crear un hábito real y una fluidez real.',
  features: [
    { title: 'Un camino guiado de cero a conversar', body: 'Un temario estructurado que te lleva de tu primer «Jambo» a mantener conversaciones reales, sin tener que adivinar qué estudiar después.' },
    { title: 'Pole pole — a tu ritmo', body: 'Elige un plan de 30, 60 o 90 días. Las lecciones se desbloquean según el calendario, para que crees un hábito constante en lugar de agotarte.' },
    { title: 'Tarjetas y práctica espaciada', body: 'Fija el vocabulario con tarjetas de repaso y cuestionarios rápidos creados a partir de cada lección que completas.' },
    { title: 'Cuestionarios que de verdad te ponen a prueba', body: 'Preguntas de opción múltiple y de respuesta escrita, con pistas y corrección al instante después de cada lección.' },
    { title: 'Rachas, XP y progreso', body: 'Gana XP, mantén viva tu racha diaria y mira cómo se llena la barra de progreso del curso.' },
    { title: 'Diálogos reales y cultura', body: 'Aprende el suajili que la gente habla de verdad: saludos, mercados, viajes y la cultura que hay detrás de las palabras.' },
  ],

  howTitle: 'Cómo funciona PolePole',
  howLead: 'Tres pasos sencillos. Dedícale un poco cada día y verás cómo suma.',
  steps: [
    { title: 'Primero prueba tres palabras', body: 'Sin registrarte. Si quieres seguir, una cuenta guarda lo que acabas de hacer.' },
    { title: 'Aprende una lección al día', body: 'Lee, escucha y asimila lecciones breves que se desbloquean según el calendario.' },
    { title: 'Practica y demuéstralo', body: 'Repasa las tarjetas y aprueba el cuestionario para desbloquear la siguiente lección.' },
  ],

  curriculumTitle: 'Un temario con un camino claro',
  curriculumLead: 'Cuatro semanas temáticas que se apoyan unas en otras: de las bases a una conversación que suena natural.',
  week: (n) => `Semana ${n}`,
  weeks: [
    { title: 'Las bases', body: 'Saludos, pronunciación, pronombres y tus primeras frases.' },
    { title: 'Clases nominales, números y la hora', body: 'Las famosas clases nominales del suajili, contar y decir la hora.' },
    { title: 'Tiempos verbales y vida diaria', body: 'Pasado, presente y futuro a través de situaciones cotidianas.' },
    { title: 'Frases complejas y cultura', body: 'Conectores, conversaciones más completas y contexto cultural para sonar natural.' },
  ],

  pricingTitle: 'Precios sencillos',
  pricingLead: 'El curso completo, gratis mientras PolePole esté en beta.',
  priceTag: 'Gratis',
  pricePeriod: '/ durante la beta',
  priceList: [
    'Curso completo de suajili de 31 lecciones',
    'Tarjetas y cuestionarios de práctica',
    'Rachas, XP y seguimiento del progreso',
    'Acceso web y móvil',
    'Aprende a tu ritmo',
  ],

  faqTitle: 'Preguntas y respuestas',
  faqs: [
    { q: '¿Necesito saber algo de suajili?', a: 'Nada en absoluto. PolePole empieza desde cero: tu primera lección trata de saludos y pronunciación.' },
    { q: '¿Cuánto dura el curso?', a: 'Depende de ti. Elige un plan intensivo de 30 días o uno relajado de 90: puedes cambiar de ritmo cuando quieras.' },
    { q: '¿Cuánto cuesta?', a: 'PolePole es gratis mientras esté en beta. Crea una cuenta y empieza hoy el curso completo.', pricing: true },
    { q: '¿Hay una aplicación móvil?', a: 'Sí. PolePole también funciona como aplicación móvil, así que puedes seguir aprendiendo en tu teléfono estés donde estés.' },
  ],

  ctaTitle: 'Anza leo — empieza hoy.',
  ctaBody: 'Tu primera conversación en suajili está más cerca de lo que crees. Pole pole, hatua kwa hatua.',

  footerTagline: 'Aprende suajili, pole pole. La forma constante y guiada de pasar de cero a conversar.',
  footerMade: 'Hecho con 🐢 y paciencia pole pole.',
};

// Swahili readers are offered the English course: a course is taught in its
// reader's language, and the one taught in Swahili teaches English.
const sw = {
  nav: { course: 'Kozi', curriculum: 'Mtaala', how: 'Jinsi inavyofanya kazi', pricing: 'Bei' },
  login: 'Ingia',
  getStarted: 'Anza',
  myDashboard: 'Dashibodi yangu',
  goToDashboard: 'Nenda kwenye dashibodi yangu',
  tryNow: 'Jaribu maneno 3 sasa',

  eyebrow: '🐢 Jifunze Kiingereza, hatua kwa hatua',
  heroTitle: 'Jifunze Kiingereza,',
  heroLead: [
    'Kozi kamili ya Kiingereza iliyoandikwa kwa Kiswahili, inayokuchukua kutoka salamu yako ya kwanza hadi mazungumzo halisi — somo fupi moja kwa wakati. ',
    '.',
  ],
  seeCurriculum: 'Tazama mtaala',
  trust: 'Sekunde 30 · Huhitaji akaunti',

  statNumbers: ['31', '4', '240+', '0→💬'],
  stats: ['Masomo yenye mwongozo', 'Mada za kila wiki', 'Maneno na misemo', 'Kutoka mwanzo hadi kuongea'],

  featuresTitle: 'Kila kitu unachohitaji ili kujifunza kweli',
  featuresLead: 'Si orodha za maneno tu — ni mfumo kamili uliobuniwa kujenga mazoea ya kweli na ufasaha wa kweli.',
  features: [
    { title: 'Njia yenye mwongozo kutoka sifuri hadi mazungumzo', body: 'Mtaala uliopangwa unaokuchukua kutoka “Hello” yako ya kwanza hadi mazungumzo halisi — bila kubahatisha cha kusoma baadaye.' },
    { title: 'Pole pole — kwa kasi yako', body: 'Chagua mpango wa siku 30, 60 au 90. Masomo hufunguka kwa ratiba ili ujenge mazoea thabiti badala ya kuchoka.' },
    { title: 'Kadi za maneno na mazoezi ya marudio', body: 'Kariri msamiati kwa kadi za kugeuza na majaribio mafupi yanayotokana na kila somo unalomaliza.' },
    { title: 'Majaribio yanayokupima kweli', body: 'Maswali ya kuchagua jibu na ya kuandika, yenye vidokezo na majibu ya papo hapo baada ya kila somo.' },
    { title: 'Mfululizo, XP na maendeleo', body: 'Pata XP, dumisha mfululizo wako wa kila siku, na uone upau wa maendeleo ya kozi ukijaa.' },
    { title: 'Kiingereza cha maisha halisi', body: 'Jifunze Kiingereza ambacho watu hukiongea kweli — salamu, sokoni, mgahawani, safarini na kazini.' },
  ],

  howTitle: 'Jinsi PolePole inavyofanya kazi',
  howLead: 'Hatua tatu rahisi. Jitokeze kidogo kila siku, na matokeo hujilimbikiza haraka.',
  steps: [
    { title: 'Jaribu maneno matatu kwanza', body: 'Bila kujisajili. Ukitaka kuendelea, akaunti huhifadhi ulichokifanya.' },
    { title: 'Jifunze somo moja kwa siku', body: 'Soma, sikiliza, na uelewe masomo mafupi yanayofunguka kwa ratiba.' },
    { title: 'Fanya mazoezi na uthibitishe', body: 'Fanya mazoezi ya kadi na ufaulu jaribio ili kufungua somo linalofuata.' },
  ],

  curriculumTitle: 'Mtaala wenye njia iliyo wazi',
  curriculumLead: 'Wiki nne zenye mada zinazojengana — kutoka misingi hadi Kiingereza cha matumizi ya kila siku.',
  week: (n) => `Wiki ya ${n}`,
  weeks: [
    { title: 'Misingi', body: 'Sauti na alfabeti, salamu, kujitambulisha, “a, an, the”, na kitenzi “to be”.' },
    { title: 'Wakati Uliopo, Maswali na Namba', body: 'Wakati uliopo, kukanusha, kuuliza maswali, vivumishi, namba, na saa na siku.' },
    { title: 'Wakati Uliopita na Ujao', body: 'Wakati uliopita, “will” na “going to”, “can” na “could”, “have” na “has”.' },
    { title: 'Kiingereza cha Matumizi', body: 'Sokoni, mgahawani, safarini, kazini na afya — Kiingereza utakachokitumia kweli.' },
  ],

  pricingTitle: 'Bei rahisi',
  pricingLead: 'Kozi nzima, bila malipo wakati PolePole iko kwenye beta.',
  priceTag: 'Bure',
  pricePeriod: '/ wakati wa beta',
  priceList: [
    'Kozi kamili ya Kiingereza yenye masomo 31',
    'Kadi za maneno na majaribio ya mazoezi',
    'Mfululizo, XP na ufuatiliaji wa maendeleo',
    'Inapatikana kwenye wavuti na simu',
    'Jifunze kwa kasi yako',
  ],

  faqTitle: 'Maswali na majibu',
  faqs: [
    { q: 'Je, nahitaji kujua Kiingereza chochote kabla?', a: 'Hapana kabisa. PolePole huanza kutoka sifuri — somo lako la kwanza ni sauti na alfabeti, na kila kitu kinaelezwa kwa Kiswahili.' },
    { q: 'Kozi huchukua muda gani?', a: 'Ni juu yako. Chagua mpango wa kasi wa siku 30 au mpango tulivu wa siku 90 — unaweza kubadilisha kasi yako wakati wowote.' },
    { q: 'Inagharimu kiasi gani?', a: 'PolePole ni bure wakati iko kwenye beta. Fungua akaunti na uanze kozi kamili leo.', pricing: true },
    { q: 'Je, kuna programu ya simu?', a: 'Ndiyo — PolePole pia inapatikana kama programu ya simu, kwa hivyo unaweza kuendelea kujifunza kwenye simu yako popote ulipo.' },
  ],

  ctaTitle: 'Anza leo.',
  ctaBody: 'Mazungumzo yako ya kwanza ya Kiingereza yako karibu kuliko unavyodhani. Pole pole, hatua kwa hatua.',

  footerTagline: 'Jifunze Kiingereza, pole pole. Njia thabiti yenye mwongozo ya kutoka sifuri hadi mazungumzo.',
  footerMade: 'Imetengenezwa kwa 🐢 na subira ya pole pole.',
};

export const LANDING_STRINGS = { en, es, sw };
