const Config = {
  WORD_SETS: {
    "Year 3–4": ["accident","actual","address","answer","appear","arrive","believe","bicycle","breath","breathe","build","busy","business","calendar","caught","centre","century","certain","circle","complete","consider","continue","decide","describe","different","difficult","disappear","early","earth","eight","eighth","enough","exercise","experience","experiment","extreme","famous","favourite","february","forward","forwards","fruit","grammar","group","guard","guide","heard","heart","height","history","imagine","increase","important","interest","island","knowledge","learn","length","library","material","medicine","mention","minute","natural","naughty","notice","occasion","occasionally","often","opposite","ordinary","particular","peculiar","perhaps","popular","position","possess","possession","possible","potatoes","pressure","probably","promise","purpose","quarter","question","recent","regular","reign","remember","sentence","separate","special","straight","strange","strength","suppose","surprise","therefore","though","although","thought","through","various","weight","woman","women"],
    "Year 5–6": ["accommodate","accompany","according","achieve","aggressive","amateur","ancient","apparent","appreciate","attached","available","average","awkward","bargain","bruise","category","cemetery","committee","communicate","community","competition","conscience","conscious","controversy","convenience","correspond","criticise","curiosity","definite","desperate","determined","develop","dictionary","disastrous","embarrass","environment","equip","equipment","especially","exaggerate","excellent","existence","explanation","familiar","foreign","forty","frequently","government","guarantee","harass","hindrance","identity","immediate","immediately","individual","interfere","interrupt","language","leisure","lightning","marvellous","mischievous","muscle","necessary","neighbour","nuisance","occupy","occur","opportunity","parliament","persuade","physical","prejudice","privilege","profession","programme","pronunciation","queue","recognise","recommend","relevant","restaurant","rhyme","rhythm","sacrifice","secretary","shoulder","signature","sincere","sincerely","soldier","stomach","sufficient","suggest","symbol","system","temperature","thorough","twelfth","variety","vegetable","vehicle","yacht"]
  },
  THEME_DEFS: {
    volcano: { name: 'Volcano', unlockText: 'Starter theme', requirement: () => true },
    space: { name: 'Space', unlockText: 'Streak of 5', requirement: (m) => m.bestStreak >= 5 },
    lightning: { name: 'Lightning', unlockText: '10 secure words', requirement: (m) => m.secureWords >= 10 },
    robot: { name: 'Robot Lab', unlockText: 'Complete 5 rounds', requirement: (m) => m.rounds >= 5 },
    ice: { name: 'Ice Cave', unlockText: '90%+ exact in one round', requirement: (m) => m.bestExact >= 90 },
    gold: { name: 'Gold Mode', unlockText: 'Perfect Boss Battle', requirement: (m) => m.perfectBossBattle }
  },
  DEFAULT_DATA: {
    progress: { George: [], Ben: [], Lucy: [], James: [] },
    themes: {
      George: { unlocked: ['volcano'], selected: 'volcano' },
      Ben: { unlocked: ['volcano'], selected: 'volcano' },
      Lucy: { unlocked: ['volcano'], selected: 'volcano' },
      James: { unlocked: ['volcano'], selected: 'volcano' }
    },
    updatedAt: null
  },
  AUTO_SYNC: true,
  FAMILY_SPACE_ID: 'balham-spelltest',
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyDJdUdL_kcAFt0NthL8LlrR0xCnyBgBwWg",
    authDomain: "balham-spelltest.firebaseapp.com",
    projectId: "balham-spelltest",
    storageBucket: "balham-spelltest.firebasestorage.app",
    messagingSenderId: "37115750695",
    appId: "1:37115750695:web:2af6a6287640bae991e102"
  }
};

let State = {
  activeUser: 'George',
  activeList: 'Year 3–4',
  wordsPerRound: 10,
  autoSpeak: true,
  sessionWords: [],
  currentIndex: 0,
  results: [],
  focusMode: false,
  recognition: null,
  listening: false,
  appData: null,
  syncEnabled: false,
  firebaseReady: false,
  firebaseRef: null,
  currentStreak: 0,
  bestRoundStreak: 0,
  lastHeatmapStates: {},
};

// --- DOM Selectors & Utility Functions ---
const $ = id => document.getElementById(id);
const userButtons = document.querySelectorAll('.user-btn');
const yearButtons = document.querySelectorAll('.year-btn');
const countButtons = document.querySelectorAll('.count-btn');

function loadLocalData() {
  const stored = localStorage.getItem('simple-spelling-app-data');
  return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(Config.DEFAULT_DATA));
}

function renderAll() {
  userButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.user === State.activeUser));
  yearButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.year === State.activeList));
  countButtons.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.count) === State.wordsPerRound));
  
  if ($('activeUserName')) $('activeUserName').textContent = State.activeUser;
  if ($('activeListName')) $('activeListName').textContent = State.activeList;
  if ($('activeCount')) $('activeCount').textContent = State.wordsPerRound;
}

function show(viewId) {
  ['startView', 'practiceView', 'resultsView'].forEach(id => {
    if ($(id)) $(id).classList.add('hidden');
  });
  if ($(viewId)) $(viewId).classList.remove('hidden');
}

function updateSyncUI(msg) {
  if ($('syncStatus')) $('syncStatus').textContent = msg;
}

// Function stubs for core game logic
function startPractice(isBossBattle) { show('practiceView'); console.log('Starting practice. Boss Battle:', isBossBattle); }
function submitAnswer() { console.log('Answer submitted'); }
function speakWord(word) { console.log('Speaking word:', word); }
function renderHeatmap() { console.log('Rendering heatmap'); }
function ensureShape(data) { return data || Config.DEFAULT_DATA; }
function initSpeech() { console.log('Speech initialized'); }

State.appData = loadLocalData();

// Refactor all variable references to use State and Config
// Utility function to replace all old variable references
function getPool() { return Config.WORD_SETS[State.activeList] || []; }
function getThemeState(user) { return State.appData.themes[user] || { unlocked: ['volcano'], selected: 'volcano' }; }
function saveLocalData() { localStorage.setItem('simple-spelling-app-data', JSON.stringify(State.appData)); }
function savePreferredUser() { localStorage.setItem('simple-spelling-active-user', State.activeUser); }
function loadPreferredUser() {
  const stored = localStorage.getItem('simple-spelling-active-user');
  if (stored && ['George','Ben','Lucy','James'].includes(stored)) State.activeUser = stored;
}
function getProgressForUser(user) { return Array.isArray(State.appData.progress[user]) ? State.appData.progress[user] : []; }
function persistData() {
  State.appData.updatedAt = new Date().toISOString();
  saveLocalData();
  renderAll();
  if (State.syncEnabled && State.firebaseRef) {
    State.firebaseRef.set(State.appData, { merge: true }).catch(err => updateSyncUI('Sync write failed: ' + err.message));
  }
}

// Update event listeners to use State object
userButtons.forEach(btn => btn.addEventListener('click', () => { State.activeUser = btn.dataset.user; savePreferredUser(); renderAll(); show('startView'); }));
yearButtons.forEach(btn => btn.addEventListener('click', () => { State.activeList = btn.dataset.year; renderAll(); show('startView'); }));
countButtons.forEach(btn => btn.addEventListener('click', () => { State.wordsPerRound = Number(btn.dataset.count); renderAll(); }));
$('toggleAutoSpeak').addEventListener('click', () => { State.autoSpeak = !State.autoSpeak; renderAll(); });
$('newRoundBtn').addEventListener('click', () => startPractice(false));
$('focusRoundBtn').addEventListener('click', () => startPractice(true));
$('startBtn').addEventListener('click', () => startPractice(false));
$('retryBtn').addEventListener('click', () => startPractice(false));
$('checkBtn').addEventListener('click', submitAnswer);
$('sayWordBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
$('hearAgainBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
$('refreshHeatmapBtn').addEventListener('click', renderHeatmap);
$('answerInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); } });
$('answerForm').addEventListener('submit', (e) => { e.preventDefault(); submitAnswer(); });
$('speakAnswerBtn').addEventListener('click', () => { if (State.recognition && !State.listening) State.recognition.start(); });

async function setupFirebaseSync() {
  try {
    const s1 = document.createElement('script'); s1.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
    const s2 = document.createElement('script'); s2.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js';
    await new Promise((resolve, reject) => { s1.onload = resolve; s1.onerror = reject; document.head.appendChild(s1); });
    await new Promise((resolve, reject) => { s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2); });
    State.firebaseReady = !!window.firebase;
    if (!State.firebaseReady) throw new Error('Firebase SDK did not load');
    const appName = 'spelling-app';
    let app;
    try { app = window.firebase.app(appName); } catch (e) { app = window.firebase.initializeApp(Config.FIREBASE_CONFIG, appName); }
    const firebaseDb = window.firebase.firestore(app);
    State.firebaseRef = firebaseDb.collection('familySpaces').doc(Config.FAMILY_SPACE_ID);
    const first = await State.firebaseRef.get();
    if (first.exists) { State.appData = ensureShape(first.data()); saveLocalData(); }
    else { await State.firebaseRef.set(State.appData, { merge: true }); }
    State.firebaseRef.onSnapshot((snapshot) => {
      if (snapshot.exists) { State.appData = ensureShape(snapshot.data()); saveLocalData(); renderAll(); }
    });
    State.syncEnabled = true;
    updateSyncUI('Connected across devices for Family Space ID: ' + Config.FAMILY_SPACE_ID + '.');
  } catch (err) {
    State.syncEnabled = false;
    updateSyncUI('Running locally. Sync not connected: ' + err.message);
  }
}

// Initialize App
loadPreferredUser();
initSpeech();
show('startView');
renderAll();
updateSyncUI('Local app ready.');
if (Config.AUTO_SYNC) setupFirebaseSync();