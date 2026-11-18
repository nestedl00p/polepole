// Copy for the Swahili grammar widgets (verb / possessive / adjective /
// question builders, noun sorter, sentence builder, pronunciation drill).
//
// The widgets were written for the English-taught course, so their English
// text doubles as the lookup key: t.g('Which verb?') returns the same string
// for an English reader and its Spanish wording for the Spanish-taught course.
// A string with no entry falls back to English rather than rendering blank.
//
// Spanish also needs things English gets for free from word order — verb
// conjugation, and gender/number agreement on possessives and adjectives — so
// the Spanish table carries its own small sentence builders (verbLine,
// possessive, described, pluralPair). Components use them when present.
//
// Keep in sync with mobile/src/lib/builderStrings.js.

const ES = {
  // ---- shared controls ----
  'Hear it — pole pole': 'Escúchalo — pole pole',
  'Not quite — try again': 'Casi — inténtalo de nuevo',
  'Try again': 'Intentar de nuevo',
  'Next →': 'Siguiente →',

  // ---- verb builder ----
  'Build a Swahili word': 'Construye una palabra en suajili',
  '1 · Who is doing it?': '1 · ¿Quién lo hace?',
  '1 · Who is NOT doing it?': '1 · ¿Quién NO lo hace?',
  '2 · Which verb?': '2 · ¿Qué verbo?',
  '3 · Which verb?': '3 · ¿Qué verbo?',
  '2 · Who receives it?': '2 · ¿Quién lo recibe?',
  I: 'Yo',
  You: 'Tú',
  'He / She': 'Él / Ella',
  We: 'Nosotros',
  'You all': 'Ustedes',
  They: 'Ellos',
  me: 'me',
  you: 'te',
  'him / her': 'lo / la',
  us: 'nos',
  them: 'los',
  read: 'leer',
  like: 'amar / gustar',
  eat: 'comer',
  drink: 'beber',
  go: 'ir',
  speak: 'hablar',
  want: 'querer',
  know: 'saber',
  see: 'ver',
  do: 'hacer',
  write: 'escribir',
  travel: 'viajar',
  not: 'no',
  who: 'quién',
  subject: 'sujeto',
  object: 'objeto',
  verb: 'verbo',
  action: 'acción',
  'verb · -a→-i': 'verbo · -a→-i',
  'verb · -a→-e': 'verbo · -a→-e',
  now: 'ahora',
  then: 'antes',
  will: 'futuro',
  done: 'hecho',

  // ---- nouns (possessive / adjective builders, noun sorter) ----
  child: 'niño',
  children: 'niños',
  tree: 'árbol',
  trees: 'árboles',
  book: 'libro',
  books: 'libros',
  car: 'carro',
  cars: 'carros',
  friend: 'amigo',
  house: 'casa',
  bananas: 'plátanos',
  face: 'cara',
  person: 'persona',
  people: 'personas',
  door: 'puerta',
  chair: 'silla',
  phone: 'teléfono',

  // ---- possessive builder ----
  'Build a possessive: NOUN + link + stem': 'Construye un posesivo: SUSTANTIVO + enlace + raíz',
  'A possessive has two parts: a stem that says whose it is, and a “link” that must agree with the noun’s class. The stem never changes — only the link does. Pick a noun and an owner and watch the link adjust.':
    'Un posesivo tiene dos partes: una raíz que dice de quién es y un “enlace” que debe concordar con la clase del sustantivo. La raíz nunca cambia: solo cambia el enlace. Elige un sustantivo y un dueño y mira cómo se ajusta el enlace.',
  'A possessive has two parts: a stem that says whose it is, and a “link” that agrees with the noun’s class. The stem never changes — only the link does.':
    'Un posesivo tiene dos partes: una raíz que dice de quién es y un “enlace” que concuerda con la clase del sustantivo. La raíz nunca cambia: solo cambia el enlace.',
  '1 · Which thing?': '1 · ¿Qué cosa?',
  '2 · Whose is it?': '2 · ¿De quién es?',
  my: 'mi',
  your: 'tu',
  'his / her': 'su (de él / ella)',
  our: 'nuestro',
  'your (pl)': 'su (de ustedes)',
  their: 'su (de ellos)',
  noun: 'sustantivo',
  link: 'enlace',
  whose: 'de quién',

  // ---- adjective builder ----
  'Build a description: NOUN + prefix + adjective': 'Construye una descripción: SUSTANTIVO + prefijo + adjetivo',
  'The adjective comes after the noun and echoes its class prefix. Pick a noun and an adjective — watch the gold prefix copy the noun’s class. (N-class nouns blend the sound a little.)':
    'El adjetivo va después del sustantivo, como en español, y repite el prefijo de su clase. Elige un sustantivo y un adjetivo, y mira cómo el prefijo dorado copia la clase del sustantivo. (Con los sustantivos de la clase N el sonido se funde un poco.)',
  '2 · Describe it': '2 · Descríbela',
  nice: 'bonito',
  big: 'grande',
  small: 'pequeño',
  tall: 'alto',
  bad: 'malo',
  heavy: 'pesado',
  agree: 'concuerda',
  describe: 'describe',

  // ---- question builder ----
  'Ask a question': 'Haz una pregunta',
  'Tap a question word': 'Toca una palabra interrogativa',
  what: 'qué',
  where: 'dónde',
  when: 'cuándo',
  why: 'por qué',
  'how many': 'cuántos',
  which: 'cuál',
  'Who is coming?': '¿Quién viene?',
  'What do you want?': '¿Qué quieres?',
  'Where do you live?': '¿Dónde vives?',
  'When will you travel?': '¿Cuándo viajarás?',
  'Why are you crying?': '¿Por qué lloras?',
  'How many books do you have?': '¿Cuántos libros tienes?',
  'Which tea do you like?': '¿Qué té te gusta?',
  'subject — starts the sentence': 'sujeto: abre la oración',
  'goes at the end': 'va al final',
  'starts the sentence': 'abre la oración',
  'takes a class prefix (vi-ngapi)': 'lleva un prefijo de clase (vi-ngapi)',
  'follows the noun': 'va después del sustantivo',

  // ---- noun sorter ----
  'Sort the noun': 'Clasifica el sustantivo',
  'Tap a noun': 'Toca un sustantivo',
  'plants & things': 'plantas y cosas',
  things: 'cosas',
  'same sing & plural': 'igual en singular y plural',
  'a person plays · people play': 'una persona juega · las personas juegan',
  'a child sleeps · children sleep': 'un niño duerme · los niños duermen',
  'a tree falls · trees fall': 'un árbol cae · los árboles caen',
  'a door opens · doors open': 'una puerta se abre · las puertas se abren',
  'a book is read · books are read': 'un libro se lee · los libros se leen',
  'a chair is broken · chairs are broken': 'una silla está rota · las sillas están rotas',
  'a house is built · houses are built': 'una casa se construye · las casas se construyen',
  'a phone rings · phones ring': 'un teléfono suena · los teléfonos suenan',

  // ---- sentence builder ----
  'Build the sentence': 'Arma la oración',
  'Drag the words into the right order, then tap Check. Get it right to hear it spoken.':
    'Arrastra las palabras al orden correcto y toca Comprobar. Si aciertas, la escucharás en voz alta.',
  'Tap the words into the right order, then Check. Get it right to hear it spoken.':
    'Toca las palabras en el orden correcto y luego Comprobar. Si aciertas, la escucharás en voz alta.',
  'Say:': 'Di:',
  'Drag a word, or tap it and then tap where it belongs.': 'Arrastra una palabra, o tócala y luego toca dónde va.',
  'Now tap the word whose place it should take.': 'Ahora toca la palabra cuyo lugar debe ocupar.',
  'Tap words below…': 'Toca las palabras de abajo…',
  'Check ✓': 'Comprobar ✓',
  Shuffle: 'Mezclar',
  'Hongera! — Well done!': 'Hongera! — ¡Bien hecho!',
  'Build them again': 'Armarlas otra vez',
  'This is my friend': 'Este es mi amigo',
  'She has two children': 'Ella tiene dos hijos',
  'Her name is Asha': 'Su nombre es Asha',
  'Her children are small': 'Sus hijos son pequeños',
  'My friend is a teacher': 'Mi amigo es maestro',

  // ---- pronunciation drill ----
  'Say it out loud': 'Dilo en voz alta',
  "Tap 🔊 to hear it, then press the mic and say the phrase. We'll check what you said.":
    'Toca 🔊 para escucharla, luego presiona el micrófono y di la frase. Revisaremos lo que dijiste.',
  "Mic recording isn't supported in this browser — you can still tap 🔊 to hear the phrase.":
    'Este navegador no permite grabar con el micrófono; aun así puedes tocar 🔊 para escuchar la frase.',
  'Microphone permission is needed to practice speaking.': 'Se necesita permiso del micrófono para practicar la pronunciación.',
  'Could not start recording on this device.': 'No se pudo iniciar la grabación en este dispositivo.',
  "Couldn't reach the pronunciation service. Try again.": 'No se pudo conectar con el servicio de pronunciación. Inténtalo de nuevo.',
  'Speak-and-check needs the pronunciation service running. You can still tap 🔊 to hear the phrase.':
    'La revisión de pronunciación no está disponible en este momento. Aun así puedes tocar 🔊 para escuchar la frase.',
  '■ Stop': '■ Detener',
  'Checking…': 'Revisando…',
  '🎤 Speak': '🎤 Hablar',
  '● Listening…': '● Escuchando…',
  'Transcribing…': 'Transcribiendo…',
  match: 'coincidencia',
  'You said:': 'Dijiste:',
  'of words': 'de las palabras',
  clarity: 'claridad',
  wpm: 'ppm',
  'Start over': 'Empezar de nuevo',
  "Couldn't reach the pronunciation service.": 'No se pudo conectar con el servicio de pronunciación.',
};

// ---- Spanish sentence building -------------------------------------------

// Five forms per tense: yo, tú, él/ella, nosotros, ellos. "Ustedes" (the
// Swahili m- prefix) conjugates like "ellos", hence the index map.
const PERSON = [0, 1, 2, 3, 4, 4];
const ES_PRONOUNS = ['Yo', 'Tú', 'Él / Ella', 'Nosotros', 'Ustedes', 'Ellos'];
const ES_OBJECTS = ['me', 'te', 'lo / la', 'nos', 'los'];
const HABER = ['he', 'has', 'ha', 'hemos', 'han'];
const ESTAR = ['estoy', 'estás', 'está', 'estamos', 'están'];
const FUTURE_ENDINGS = ['é', 'ás', 'á', 'emos', 'án'];

// Keyed by the Swahili stem, like the builder's own STEM_LIB.
const ES_VERBS = {
  soma: {
    pres: ['leo', 'lees', 'lee', 'leemos', 'leen'], pret: ['leí', 'leíste', 'leyó', 'leímos', 'leyeron'],
    fut: 'leer', pp: 'leído', ger: 'leyendo', subj: ['lea', 'leas', 'lea', 'leamos', 'lean'],
  },
  penda: {
    pres: ['amo', 'amas', 'ama', 'amamos', 'aman'], pret: ['amé', 'amaste', 'amó', 'amamos', 'amaron'],
    fut: 'amar', pp: 'amado', ger: 'amando', subj: ['ame', 'ames', 'ame', 'amemos', 'amen'],
  },
  kula: {
    pres: ['como', 'comes', 'come', 'comemos', 'comen'], pret: ['comí', 'comiste', 'comió', 'comimos', 'comieron'],
    fut: 'comer', pp: 'comido', ger: 'comiendo', subj: ['coma', 'comas', 'coma', 'comamos', 'coman'],
  },
  kunywa: {
    pres: ['bebo', 'bebes', 'bebe', 'bebemos', 'beben'], pret: ['bebí', 'bebiste', 'bebió', 'bebimos', 'bebieron'],
    fut: 'beber', pp: 'bebido', ger: 'bebiendo', subj: ['beba', 'bebas', 'beba', 'bebamos', 'beban'],
  },
  enda: {
    pres: ['voy', 'vas', 'va', 'vamos', 'van'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    fut: 'ir', pp: 'ido', ger: 'yendo', subj: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayan'],
  },
  sema: {
    pres: ['hablo', 'hablas', 'habla', 'hablamos', 'hablan'], pret: ['hablé', 'hablaste', 'habló', 'hablamos', 'hablaron'],
    fut: 'hablar', pp: 'hablado', ger: 'hablando', subj: ['hable', 'hables', 'hable', 'hablemos', 'hablen'],
  },
  taka: {
    pres: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'], pret: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisieron'],
    fut: 'querr', pp: 'querido', ger: 'queriendo', subj: ['quiera', 'quieras', 'quiera', 'queramos', 'quieran'],
  },
  jua: {
    pres: ['sé', 'sabes', 'sabe', 'sabemos', 'saben'], pret: ['supe', 'supiste', 'supo', 'supimos', 'supieron'],
    fut: 'sabr', pp: 'sabido', ger: 'sabiendo', subj: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepan'],
  },
  ona: {
    pres: ['veo', 'ves', 've', 'vemos', 'ven'], pret: ['vi', 'viste', 'vio', 'vimos', 'vieron'],
    fut: 'ver', pp: 'visto', ger: 'viendo', subj: ['vea', 'veas', 'vea', 'veamos', 'vean'],
  },
  fanya: {
    pres: ['hago', 'haces', 'hace', 'hacemos', 'hacen'], pret: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron'],
    fut: 'har', pp: 'hecho', ger: 'haciendo', subj: ['haga', 'hagas', 'haga', 'hagamos', 'hagan'],
  },
  andika: {
    pres: ['escribo', 'escribes', 'escribe', 'escribimos', 'escriben'], pret: ['escribí', 'escribiste', 'escribió', 'escribimos', 'escribieron'],
    fut: 'escribir', pp: 'escrito', ger: 'escribiendo', subj: ['escriba', 'escribas', 'escriba', 'escribamos', 'escriban'],
  },
  safiri: {
    pres: ['viajo', 'viajas', 'viaja', 'viajamos', 'viajan'], pret: ['viajé', 'viajaste', 'viajó', 'viajamos', 'viajaron'],
    fut: 'viajar', pp: 'viajado', ger: 'viajando', subj: ['viaje', 'viajes', 'viaje', 'viajemos', 'viajen'],
  },
};

function conjugate(v, tense, p) {
  if (tense === 'past') return v.pret[p];
  if (tense === 'future') return v.fut + FUTURE_ENDINGS[p];
  if (tense === 'perfect') return `${HABER[p]} ${v.pp}`;
  return v.pres[p];
}

// The translation under the verb builder's result.
//   person — index into the builder's subject list (ni, u, a, tu, m, wa)
//   object — index into its object list (ni, ku, m, tu, wa); object mode only
// Returns null for a verb it has no forms for, so the caller keeps its own text.
function verbLine({ mode, tense, person, stem, object }) {
  const v = ES_VERBS[stem];
  if (!v) return null;
  const p = PERSON[person] ?? 0;
  const who = ES_PRONOUNS[person];

  if (mode === 'negative') return { main: `${who} no ${v.pres[p]}`, alt: null };
  if (mode === 'subjunctive') {
    // tu- on its own is the "let's …" form; the rest read as "que yo lea".
    return { main: person === 3 ? `¡${v.subj[p]}!` : `que ${who.toLowerCase()} ${v.subj[p]}`, alt: null };
  }
  if (mode === 'object') {
    // Spanish puts the object before the verb, where Swahili puts its infix.
    const main = tense === 'perfect'
      ? `${who} ${ES_OBJECTS[object]} ${HABER[p]} ${v.pp}`
      : `${who} ${ES_OBJECTS[object]} ${conjugate(v, tense, p)}`;
    return { main, alt: null };
  }
  return {
    main: `${who} ${conjugate(v, tense, p)}`,
    // -na- covers both "leo" and "estoy leyendo".
    alt: tense === 'present' ? `${who} ${ESTAR[p]} ${v.ger}` : null,
  };
}

// Gender and number of the Spanish nouns, keyed by the builders' English gloss.
const ES_NOUNS = {
  child: { w: 'niño' }, children: { w: 'niños', pl: true },
  tree: { w: 'árbol' }, trees: { w: 'árboles', pl: true },
  book: { w: 'libro' }, books: { w: 'libros', pl: true },
  car: { w: 'carro' }, cars: { w: 'carros', pl: true },
  friend: { w: 'amigo' },
  house: { w: 'casa', f: true },
  bananas: { w: 'plátanos', pl: true },
  face: { w: 'cara', f: true },
  person: { w: 'persona', f: true }, people: { w: 'personas', f: true, pl: true },
};

// "mi libro", "nuestras casas", "su libro (de ellos)". possessor is the index
// into the builder's list: my, your, his/her, our, your (pl), their.
function possessive(possessor, nounEn) {
  const n = ES_NOUNS[nounEn];
  if (!n) return null;
  const s = n.pl ? 's' : '';
  switch (possessor) {
    case 0: return `mi${s} ${n.w}`;
    case 1: return `tu${s} ${n.w}`;
    case 2: return `su${s} ${n.w} (de él / ella)`;
    case 3: return `nuestr${n.f ? 'a' : 'o'}${s} ${n.w}`;
    case 4: return `su${s} ${n.w} (de ustedes)`;
    case 5: return `su${s} ${n.w} (de ellos)`;
    default: return null;
  }
}

// Masculine singular; -o adjectives take gender, all take a plural.
const ES_ADJECTIVES = { nice: 'bonito', big: 'grande', small: 'pequeño', tall: 'alto', bad: 'malo', heavy: 'pesado' };

// "libro bonito", "casas grandes" — noun first, as in Swahili.
function described(adjEn, nounEn) {
  const n = ES_NOUNS[nounEn];
  let a = ES_ADJECTIVES[adjEn];
  if (!n || !a) return null;
  if (n.f && a.endsWith('o')) a = `${a.slice(0, -1)}a`;
  if (n.pl) a += 's';
  return `${n.w} ${a}`;
}

const ES_PLURALS = {
  person: 'persona → personas', child: 'niño → niños', tree: 'árbol → árboles', door: 'puerta → puertas',
  book: 'libro → libros', chair: 'silla → sillas', house: 'casa → casas', phone: 'teléfono → teléfonos',
};

const EN_STRINGS = {
  g: (s) => s,
  hear: (word) => `Hear ${word} spoken`,
  builtAll: (n) => `You built all ${n} sentences.`,
};

const ES_STRINGS = {
  g: (s) => ES[s] ?? s,
  hear: (word) => `Escuchar ${word}`,
  builtAll: (n) => `Armaste las ${n} oraciones.`,
  verbLine,
  possessive,
  described,
  pluralPair: (nounEn) => ES_PLURALS[nounEn] ?? null,
};

// course: the account's course. Only the Spanish-taught course has its own
// wording so far; every other course reads these widgets in English.
export function builderStrings(course) {
  return course?.sourceLanguage === 'es' ? ES_STRINGS : EN_STRINGS;
}
