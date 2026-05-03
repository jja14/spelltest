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
    metrics: {
      George: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      Ben: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      Lucy: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      James: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false }
    },
    updatedAt: null
  },
  AUTO_SYNC: true,
  FAMILY_SPACE_ID: 'balham-spelltest',
  FIREBASE_CONFIG: {
    // ⚠️ SECURITY: These are public credentials - consider moving to environment variables or a backend service
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

const AVATARS = { George: '🦖', Ben: '🤖', Lucy: '🦄', James: '🧙‍♂️' };

// --- Game Audio System ---
const AudioSys = {
  ctx: null,
  init() { 
    try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { console.warn("Audio API not supported", e); }
  },
  play(type) {
    try {
      if (!this.ctx) this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      const now = this.ctx.currentTime;
      
      if (type === 'correct') {
        // Mario Coin Sound
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.1); // E6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      } else if (type === 'incorrect') {
        // Mario Bump/Damage Sound
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'tada') {
        // Mario Level Clear Arpeggio
        osc.type = 'square';
        osc.frequency.setValueAtTime(392.00, now); // G4
        osc.frequency.setValueAtTime(523.25, now + 0.15); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.3); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.45); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.6); // C6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
      }
    } catch (e) { console.warn("Audio playback error", e); }
  }
};

function ensureShape(data) { 
  if (!data || typeof data !== 'object') data = JSON.parse(JSON.stringify(Config.DEFAULT_DATA));
  if (!data.progress) data.progress = {};
  if (!data.themes) data.themes = {};
  if (!data.metrics) data.metrics = {};
  const users = ['George', 'Ben', 'Lucy', 'James'];
  users.forEach(u => {
    if (!Array.isArray(data.progress[u])) data.progress[u] = [];
    if (!data.themes[u]) data.themes[u] = { unlocked: ['volcano'], selected: 'volcano' };
    if (!data.metrics[u]) data.metrics[u] = { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false };
  });
  return data; 
}

function loadLocalData() {
  let data = null;
  try {
    const stored = localStorage.getItem('simple-spelling-app-data');
    if (stored) data = JSON.parse(stored);
  } catch (e) {}
  return ensureShape(data);
}

function renderAll() {
  userButtons.forEach(btn => {
    const u = btn.dataset.user;
    btn.innerHTML = `${AVATARS[u] || '👤'} ${u}`;
    btn.classList.toggle('active', u === State.activeUser);
  });
  yearButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.year === State.activeList));
  countButtons.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.count) === State.wordsPerRound));
  
  if ($('activeUserName')) $('activeUserName').textContent = State.activeUser;
  if ($('activeListName')) $('activeListName').textContent = State.activeList;
  if ($('activeCount')) $('activeCount').textContent = State.wordsPerRound;
  
  // Render Family Goal Banner
  let familyBanner = $('familyBanner');
  if (!familyBanner) {
    familyBanner = document.createElement('div');
    familyBanner.id = 'familyBanner';
    familyBanner.className = 'banner';
    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.insertBefore(familyBanner, wrap.firstChild);
  }
  if (familyBanner && State.appData) {
    let total = 0;
      for (const u in State.appData.progress) { if (Array.isArray(State.appData.progress[u])) total += State.appData.progress[u].length; }
    const goal = 500;
    const pct = Math.min(100, (total / goal) * 100);
    familyBanner.innerHTML = `<strong>Family Goal: Pizza Night! 🍕</strong> ${total} / ${goal} words spelled correctly.
    <div class="progress"><div class="progress-bar" style="width: ${pct}%"></div></div>`;
  }

  if ($('progressSummary')) {
    const userProgress = getProgressForUser(State.activeUser);
    $('progressSummary').textContent = `${State.activeUser} has correctly spelled ${userProgress.length} total words.`;
  }

  renderHeatmap();
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

function updatePracticeUI() {
  if ($('wordPosition')) $('wordPosition').textContent = `Word ${State.currentIndex + 1} of ${State.sessionWords.length}`;
  if ($('answeredCount')) $('answeredCount').textContent = `${State.currentIndex} answered`;
  if ($('progressBar')) {
    const pct = (State.currentIndex / State.sessionWords.length) * 100;
    $('progressBar').style.width = `${pct}%`;
  }
}

function showFeedback(msg, type) {
  const fb = $('feedbackMessage');
  if (!fb) return;
  fb.textContent = msg;
  fb.style.color = type === 'good' ? '#00a800' : '#e52521'; // Mario green and red
  setTimeout(() => { if (fb.textContent === msg) fb.textContent = ''; }, 3000);
}

// Proper Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Function stubs for core game logic
function startPractice(isBossBattle) { 
  const pool = getPool();
  if (!pool || pool.length === 0) return;
  let shuffled = shuffleArray(pool);
  State.sessionWords = shuffled.slice(0, State.wordsPerRound);
  State.currentIndex = 0;
  State.results = [];
  State.currentStreak = 0;
  
  show('practiceView');
  updatePracticeUI();
  const answerInput = $('answerInput');
  if (answerInput) {
    answerInput.value = '';
    answerInput.focus();
  }
  setTimeout(() => { if (State.autoSpeak) speakWord(State.sessionWords[0]); }, 300);
}

function submitAnswer() { 
  const input = $('answerInput');
  if (!input || State.currentIndex >= State.sessionWords.length) return;
  
  const answer = input.value.trim().toLowerCase();
  const word = State.sessionWords[State.currentIndex].toLowerCase();
  const isCorrect = answer === word;
  
  State.results.push({ word, answer, isCorrect });
  
  // UX Fix: Clear immediately so the screen never gets stuck!
  input.value = '';
  State.currentIndex++;

  if (isCorrect) {
    State.currentStreak++;
    State.bestRoundStreak = Math.max(State.bestRoundStreak, State.currentStreak);
    AudioSys.play('correct');
    triggerCelebration(Math.random() > 0.8 ? 'mastered' : 'mini'); // Throw mastered blast sometimes for fun
    if (!State.appData.progress) State.appData.progress = {};
    if (!State.appData.progress[State.activeUser]) State.appData.progress[State.activeUser] = [];
    State.appData.progress[State.activeUser].push(word);
    try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
    showFeedback('Correct! 🍄', 'good');
  } else {
    State.currentStreak = 0;
    AudioSys.play('incorrect');
    showFeedback(`Not quite! The word was: ${word}`, 'warn');
  }
  
  if (State.currentIndex < State.sessionWords.length) {
    updatePracticeUI();
    if (State.autoSpeak) setTimeout(() => speakWord(State.sessionWords[State.currentIndex]), 300);
    input.focus();
  } else {
    AudioSys.play('tada');
    
    // --- Populate Results View ---
    const correctCount = State.results.filter(r => r.isCorrect).length;
    const total = State.results.length;
    const accuracy = Math.round((correctCount / total) * 100) || 0;
    
    // --- Update Metrics & Check for Unlocks ---
    const userMetrics = State.appData.metrics[State.activeUser];
    if (userMetrics) {
        userMetrics.bestStreak = Math.max(userMetrics.bestStreak || 0, State.bestRoundStreak);
    }

    const userThemes = State.appData.themes[State.activeUser];
    if (userMetrics && userThemes) {
        Object.keys(Config.THEME_DEFS).forEach(themeId => {
            if (!userThemes.unlocked.includes(themeId)) {
                const themeDef = Config.THEME_DEFS[themeId];
                if (themeDef.requirement(userMetrics)) {
                    userThemes.unlocked.push(themeId);
                }
            }
        });
    }
    
    persistData(); // Save new metrics and potential new themes
    
    if ($('exactScore')) $('exactScore').textContent = `${correctCount}/${total}`;
    if ($('averageAccuracy')) $('averageAccuracy').textContent = `${accuracy}%`;
    if ($('roundRating')) $('roundRating').textContent = accuracy === 100 ? 'Perfect! 🌟' : accuracy >= 80 ? 'Great job! ✨' : 'Good effort! 👍';
    
    const listElem = $('resultsList');
    if (listElem) {
      listElem.innerHTML = State.results.map(r => {
        const userAnswer = r.answer && r.answer.trim() ? r.answer : '(left blank)';
        return `<div style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${r.word}</strong>: ${r.isCorrect ? '✅' : `❌ (you typed: <em>${userAnswer}</em>)`}</div>`;
      }).join('');
    }

    show('resultsView');
  }
}

let synth = null;
let preferredVoice = null;

function initSpeech() { 
  if (window.speechSynthesis) {
    synth = window.speechSynthesis; 
    const loadVoices = () => {
      const voices = synth.getVoices();
      // Seek out higher quality natural voices (Google, Premium macOS, etc.)
      preferredVoice = voices.find(v => v.name.includes('Google UK English Female'))
                    || voices.find(v => v.name.includes('Google UK English Male'))
                    || voices.find(v => v.name.includes('Premium') && v.lang === 'en-GB')
                    || voices.find(v => v.name.includes('Daniel') && v.lang === 'en-GB')
                    || voices.find(v => v.lang === 'en-GB')
                    || voices[0];
    };
    loadVoices(); // Load immediately
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices; // Update when ready
  } 
}

function speakWord(word) { 
  if (!synth) return;
  if (synth.speaking) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  if (preferredVoice) utterance.voice = preferredVoice;
  synth.speak(utterance);
}

async function speakWithContext(word) {
  if (!synth) return;
  speakWord(word); // Instantly say the word to prevent waiting on the API
  
  let sentence = `The word is ${word}.`;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (res.ok) {
      const data = await res.json();
      for (const m of data[0]?.meanings || []) {
        const def = (m.definitions || []).find(d => d.example);
        if (def) { sentence = def.example.replace(/<[^>]*>?/gm, ''); break; }
      }
    }
  } catch (e) { console.warn("Could not fetch dictionary context", e); }

  // Queue the sentence, then the word again
  setTimeout(() => {
    const uSentence = new SpeechSynthesisUtterance(sentence);
    const uWord = new SpeechSynthesisUtterance(word);
    [uSentence, uWord].forEach(u => {
      u.lang = 'en-GB'; u.rate = 0.85; 
      if (preferredVoice) u.voice = preferredVoice;
      synth.speak(u);
    });
  }, 500); // Small delay to allow the instant playback to finish
}

function renderHeatmap() { 
  const grid = $('heatmapGrid');
  const summary = $('heatmapSummary');
  if (!grid || !summary) return;

  const pool = getPool();
  const progress = getProgressForUser(State.activeUser);
  const counts = {};
  
  progress.forEach(w => { 
    if (w && typeof w === 'string') counts[w.toLowerCase()] = (counts[w.toLowerCase()] || 0) + 1; 
  });

  grid.innerHTML = '';
  let secure = 0, improving = 0, notTried = 0;

  pool.forEach(word => {
    const count = counts[word.toLowerCase()] || 0;
    const cell = document.createElement('div');
    cell.textContent = word;
    // Styling the cell directly to match the app's heatmap requirements
    cell.style.cssText = 'padding: 4px 8px; margin: 2px; display: inline-block; border-radius: 4px; font-size: 0.8rem; color: #333;';
    
    if (count >= 2) { cell.style.backgroundColor = 'var(--green-soft, #a5d6a7)'; secure++; }
    else if (count === 1) { cell.style.backgroundColor = 'var(--amber, #ffe082)'; improving++; }
    else { cell.style.backgroundColor = 'var(--grey, #eeeeee)'; notTried++; }
    
    grid.appendChild(cell);
  });

  summary.textContent = `Secure: ${secure} | Improving: ${improving} | Not tried: ${notTried}`;
}

// --- Fun Visual Rewards ---
function triggerCelebration(type = 'mini') {
  const layer = $('celebrationLayer');
  if (!layer) return;
  
  const particle = document.createElement('div');
  // Choose emojis based on the type of achievement
  particle.textContent = type === 'mastered' ? '⭐' : '🪙';
  particle.style.position = 'absolute';
  particle.style.left = Math.random() * 80 + 10 + '%';
  particle.style.top = Math.random() * 50 + 25 + '%';
  particle.style.fontSize = type === 'mastered' ? '4rem' : '2rem';
  particle.style.transition = 'all 1s ease-out';
  particle.style.pointerEvents = 'none';
  
  layer.appendChild(particle);
  
  // Animate upwards and fade out
  requestAnimationFrame(() => {
    particle.style.transform = `translateY(-100px) scale(${type === 'mastered' ? 1.5 : 1})`;
    particle.style.opacity = '0';
  });
  
  setTimeout(() => particle.remove(), 1000);
}

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
if ($('toggleAutoSpeak')) $('toggleAutoSpeak').addEventListener('click', () => { State.autoSpeak = !State.autoSpeak; renderAll(); });
if ($('newRoundBtn')) $('newRoundBtn').addEventListener('click', () => startPractice(false));
if ($('focusRoundBtn')) $('focusRoundBtn').addEventListener('click', () => startPractice(true));
if ($('startBtn')) $('startBtn').addEventListener('click', () => startPractice(false));
if ($('retryBtn')) $('retryBtn').addEventListener('click', () => startPractice(false));
if ($('checkBtn')) $('checkBtn').addEventListener('click', submitAnswer);
if ($('sayWordBtn')) $('sayWordBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
if ($('hearAgainBtn')) $('hearAgainBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
if ($('contextBtn')) $('contextBtn').addEventListener('click', () => speakWithContext(State.sessionWords[State.currentIndex]));
if ($('refreshHeatmapBtn')) $('refreshHeatmapBtn').addEventListener('click', renderHeatmap);
if ($('answerInput')) $('answerInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); } });
if ($('answerForm')) $('answerForm').addEventListener('submit', (e) => { e.preventDefault(); submitAnswer(); });
if ($('speakAnswerBtn')) $('speakAnswerBtn').addEventListener('click', () => { if (State.recognition && !State.listening) State.recognition.start(); });

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