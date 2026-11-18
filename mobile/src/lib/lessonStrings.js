// UI copy for the interactive lesson pieces (tables, dialogues, quick checks,
// vocab match). The English course is taken by Swahili speakers, so its
// controls are labelled in Swahili. Keep in sync with frontend/src/lib/lessonStrings.js.

const EN = {
  showAll: 'Show all',
  hide: (col) => `Hide ${col}`,
  tapToReveal: 'Tap to reveal',
  tableHint: 'Say each hidden one aloud, then tap to check.',
  listen: '▶ Listen',
  stop: '■ Stop',
  hideTranslations: 'Hide translations',
  showTranslations: 'Show translations',
  playRole: 'Play a role:',
  yourLine: 'Your line — say it, then tap to check',
  quickCheck: 'Quick check',
  correct: 'Correct!',
  tryAgain: 'Not quite — try again',
  next: 'Next →',
  finish: 'Finish',
  checkDone: (n, total) => `${n} of ${total} right first time`,
  again: 'Try again',
  matchTitle: 'Match the words',
  matchIntro: 'Tap a word, then tap its meaning.',
  matchDone: 'All matched!',
  matchMisses: (n) => (n === 0 ? 'No mistakes.' : n === 1 ? '1 slip.' : `${n} slips.`),
  newRound: 'New round',

  // Conversation practice (spoken role-play)
  cvTitle: 'Conversation practice',
  cvGoal: 'Your goal:',
  cvStart: '▶ Start the conversation',
  cvSpeak: '🎤 Answer',
  cvStop: '■ Done speaking',
  cvThinking: 'Listening…',
  cvListening: 'Recording — tap again when you have finished',
  cvOrType: '…or type your answer',
  cvType: 'Type your answer',
  cvSend: 'Send',
  cvTypeOnly: 'Voice input is off right now, so type your answers. You will still hear the replies.',
  cvRedo: "That's not what I said — try again",
  cvReplay: 'Hear it again',
  cvUnclear: "I didn't catch that. Try again, a little closer to the mic.",
  cvError: "Couldn't reach your conversation partner. Try again.",
  cvUnavailable: 'Conversation practice is not switched on yet. You can still play both roles of the dialogue above.',
  cvNoTurns: "That's all the conversation practice for today. Come back tomorrow!",
  cvDone: (n) => `You held a real conversation — ${n} ${n === 1 ? 'turn' : 'turns'}.`,
  cvAgain: 'Start again',
  cvHideHelp: 'Hide translations and hints',
  cvShowHelp: 'Show translations and hints',
  cvMicDenied: 'Microphone permission is needed to answer out loud. You can type instead.',
  cvMicFailed: 'Could not start recording on this device. You can type instead.',
};

const SW = {
  showAll: 'Onyesha zote',
  hide: (col) => `Ficha ${col}`,
  tapToReveal: 'Gusa kuona',
  tableHint: 'Sema kila lililofichwa kwa sauti, kisha gusa kuhakiki.',
  listen: '▶ Sikiliza',
  stop: '■ Simamisha',
  hideTranslations: 'Ficha tafsiri',
  showTranslations: 'Onyesha tafsiri',
  playRole: 'Igiza kama:',
  yourLine: 'Zamu yako — sema, kisha gusa kuhakiki',
  quickCheck: 'Jipime Haraka',
  correct: 'Sahihi!',
  tryAgain: 'Si sahihi — jaribu tena',
  next: 'Endelea →',
  finish: 'Maliza',
  checkDone: (n, total) => `${n} kati ya ${total} sahihi mara ya kwanza`,
  again: 'Jaribu tena',
  matchTitle: 'Oanisha maneno',
  matchIntro: 'Gusa neno, kisha gusa maana yake.',
  matchDone: 'Umeoanisha yote!',
  matchMisses: (n) => (n === 0 ? 'Bila kosa.' : n === 1 ? 'Kosa 1.' : `Makosa ${n}.`),
  newRound: 'Mzunguko mpya',

  // Conversation practice (spoken role-play)
  cvTitle: 'Mazoezi ya mazungumzo',
  cvGoal: 'Lengo lako:',
  cvStart: '▶ Anza mazungumzo',
  cvSpeak: '🎤 Jibu',
  cvStop: '■ Nimemaliza kusema',
  cvThinking: 'Ninasikiliza…',
  cvListening: 'Inarekodi — gusa tena ukimaliza',
  cvOrType: '…au andika jibu lako',
  cvType: 'Andika jibu lako',
  cvSend: 'Tuma',
  cvTypeOnly: 'Kipaza sauti hakipatikani sasa, kwa hiyo andika majibu yako. Bado utasikia majibu.',
  cvRedo: 'Sikusema hivyo — jaribu tena',
  cvReplay: 'Sikiliza tena',
  cvUnclear: 'Sikusikia vizuri. Jaribu tena, karibu zaidi na kipaza sauti.',
  cvError: 'Imeshindikana kumpata mwenzako wa mazungumzo. Jaribu tena.',
  cvUnavailable: 'Mazoezi ya mazungumzo bado hayajawashwa. Bado unaweza kuigiza mazungumzo yaliyo hapo juu.',
  cvNoTurns: 'Mazoezi ya mazungumzo ya leo yameisha. Rudi kesho!',
  cvDone: (n) => `Umefanya mazungumzo halisi — zamu ${n}.`,
  cvAgain: 'Anza tena',
  cvHideHelp: 'Ficha tafsiri na vidokezo',
  cvShowHelp: 'Onyesha tafsiri na vidokezo',
  cvMicDenied: 'Ruhusa ya kipaza sauti inahitajika ili ujibu kwa sauti. Unaweza kuandika.',
  cvMicFailed: 'Imeshindikana kuanza kurekodi kwenye kifaa hiki. Unaweza kuandika.',
};

// course: the account's course ({ targetLanguage: 'sw' | 'en' }).
export function lessonStrings(course) {
  return course?.targetLanguage === 'en' ? SW : EN;
}

// Lesson tables are recognised by their column headers.
//  speak  — columns written in the language being learned: each cell gets a 🔊
//  target / known — the pair the self-test hides and reveals (the thing to
//           recall, and the cue it is recalled from)
// A header missing from these lists just leaves that table plain.
const TABLE_COLUMNS = {
  sw: {
    speak: /^(swahili|stem|example)$/i,
    target: /^(swahili|stem|prefix|infix)$/i,
    known: /^(english|number|meaning)$/i,
  },
  en: {
    speak: /^(kiingereza|mfano|sentensi|kauli|swali|sasa|uliopita|wingi|chakula|kazi|sauti moja|sauti nyingine)$/i,
    target: /^(kiingereza|mfano|chakula|kazi|uliopita)$/i,
    known: /^(kiswahili|sasa)$/i,
  },
};

// Returns the self-test pair (-1 for either when the table has no such pair)
// and the set of columns that get audio.
export function tableLanguageColumns(headers = [], course) {
  const cols = TABLE_COLUMNS[course?.targetLanguage === 'en' ? 'en' : 'sw'];
  const names = headers.map((h) => h.trim());
  return {
    targetCol: names.findIndex((h) => cols.target.test(h)),
    knownCol: names.findIndex((h) => cols.known.test(h)),
    speakCols: new Set(names.map((h, i) => (cols.speak.test(h) ? i : -1)).filter((i) => i >= 0)),
  };
}

// Text handed to text-to-speech for a table cell: drops bracketed asides and
// the hyphens on stems ("-soma"), and reads "mtu / watu" as two items.
export function speakable(cell = '') {
  return cell
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*\/\s*/g, ', ')
    .replace(/(^|\s)-+|-+(?=\s|,|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
