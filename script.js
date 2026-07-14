const Config = {
  WORD_SETS: {
    "Year 3–4": ["accident","actual","address","answer","appear","arrive","believe","bicycle","breath","breathe","build","busy","business","calendar","caught","centre","century","certain","circle","complete","consider","continue","decide","describe","different","difficult","disappear","early","earth","eight","eighth","enough","exercise","experience","experiment","extreme","famous","favourite","february","forward","forwards","fruit","grammar","group","guard","guide","heard","heart","height","history","imagine","increase","important","interest","island","knowledge","learn","length","library","material","medicine","mention","minute","natural","naughty","notice","occasion","occasionally","often","opposite","ordinary","particular","peculiar","perhaps","popular","position","possess","possession","possible","potatoes","pressure","probably","promise","purpose","quarter","question","recent","regular","reign","remember","sentence","separate","special","straight","strange","strength","suppose","surprise","therefore","though","although","thought","through","various","weight","woman","women"],
    "Year 5–6": ["accommodate","accompany","according","achieve","aggressive","amateur","ancient","apparent","appreciate","attached","available","average","awkward","bargain","bruise","category","cemetery","committee","communicate","community","competition","conscience","conscious","controversy","convenience","correspond","criticise","curiosity","definite","desperate","determined","develop","dictionary","disastrous","embarrass","environment","equip","equipment","especially","exaggerate","excellent","existence","explanation","familiar","foreign","forty","frequently","government","guarantee","harass","hindrance","identity","immediate","immediately","individual","interfere","interrupt","language","leisure","lightning","marvellous","mischievous","muscle","necessary","neighbour","nuisance","occupy","occur","opportunity","parliament","persuade","physical","prejudice","privilege","profession","programme","pronunciation","queue","recognise","recommend","relevant","restaurant","rhyme","rhythm","sacrifice","secretary","shoulder","signature","sincere","sincerely","soldier","stomach","sufficient","suggest","symbol","system","temperature","thorough","twelfth","variety","vegetable","vehicle","yacht"]
  },
  THEME_DEFS: {
    onepiece: { name: 'Straw Hat Crew', unlockText: 'Default theme', requirement: () => true },
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
      George: { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' },
      Ben: { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' },
      Lucy: { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' },
      James: { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' }
    },
    metrics: {
      George: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      Ben: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      Lucy: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false },
      James: { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false }
    },
    bounty: { George: 0, Ben: 0, Lucy: 0, James: 0 },
    attempts: { George: {}, Ben: {}, Lucy: {}, James: {} },
    redemptions: { George: [], Ben: [], Lucy: [], James: [] },
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
  if (!data.bounty) data.bounty = {};
  if (!data.attempts) data.attempts = {};
  if (!data.redemptions) data.redemptions = {};
  const users = ['George', 'Ben', 'Lucy', 'James'];
  users.forEach(u => {
    if (!Array.isArray(data.progress[u])) data.progress[u] = [];
    if (!data.themes[u]) data.themes[u] = { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' };
    if (!data.themes[u].unlocked.includes('onepiece')) data.themes[u].unlocked.unshift('onepiece');
    if (!data.metrics[u]) data.metrics[u] = { bestStreak: 0, secureWords: 0, rounds: 0, bestExact: 0, perfectBossBattle: false };
    if (typeof data.bounty[u] !== 'number') data.bounty[u] = 0;
    if (u === 'George' && data.bounty[u] < 142) data.bounty[u] = 142;
    if (!data.attempts[u]) data.attempts[u] = {};
    if (!Array.isArray(data.redemptions[u])) data.redemptions[u] = [];
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
    const userBounty = State.appData.bounty[State.activeUser] || 0;
    
    const nextMilestone = ShopItems.find(item => userBounty < item.cost) || ShopItems[ShopItems.length - 1];
    const prevMilestoneCost = ShopItems[ShopItems.indexOf(nextMilestone) - 1]?.cost || 0;
    
    const range = nextMilestone.cost - prevMilestoneCost;
    const progressInRange = userBounty - prevMilestoneCost;
    const pct = Math.min(100, Math.max(0, (progressInRange / (range || 1)) * 100));
    
    const milestonesHTML = ShopItems.map(item => {
      const isUnlocked = userBounty >= item.cost;
      return `
        <div class="milestone-step ${isUnlocked ? 'unlocked' : ''}">
          <div class="milestone-icon">${item.icon}</div>
          <div class="milestone-cost">${item.cost}฿</div>
          <div class="milestone-name">${item.name}</div>
        </div>
      `;
    }).join('');
    
    familyBanner.innerHTML = `
      <div class="bounty-header">
        <span>💰 <strong>${State.activeUser}'s Bounty:</strong> <span class="bounty-highlight">${userBounty} ฿</span></span>
        <span>Next Milestone: <strong>${nextMilestone.icon} ${nextMilestone.name}</strong> (${nextMilestone.cost} ฿)</span>
      </div>
      <div class="progress" style="height: 18px; margin-top: 10px; margin-bottom: 15px;">
        <div class="progress-bar" style="width: ${pct}%"></div>
      </div>
      <div class="milestones-row">
        ${milestonesHTML}
      </div>
    `;
  }

  if ($('progressSummary')) {
    const userProgress = getProgressForUser(State.activeUser);
    $('progressSummary').textContent = `${State.activeUser} has correctly spelled ${userProgress.length} total words.`;
  }

  renderHeatmap();
  renderThemes();
  renderBountyShop();

  const isParent = ['Lucy', 'James'].includes(State.activeUser);
  if ($('parentDashboard')) {
    $('parentDashboard').classList.toggle('hidden', !isParent);
    if (isParent) {
      renderParentDashboard();
    }
  }
}

function show(viewId) {
  ['startView', 'practiceView', 'resultsView'].forEach(id => {
    if ($(id)) $(id).classList.add('hidden');
  });
  if ($(viewId)) $(viewId).classList.remove('hidden');
}

function updateSyncUI(msg) {
  if ($('syncStatus')) $('syncStatus').textContent = msg;
  if ($('syncBanner')) $('syncBanner').innerHTML = `<strong>Sync status:</strong> ${msg}`;
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
function getBossBattlePool() {
  const pool = getPool();
  const attempts = State.appData.attempts[State.activeUser] || {};
  
  const classified = pool.map(word => {
    const w = word.toLowerCase();
    const att = attempts[w] || { correct: 0, incorrect: 0 };
    
    let status = 'grey'; // Not Tried
    if (att.correct >= 2) {
      status = 'green'; // Secure
    } else if (att.correct === 1 && att.incorrect === 0) {
      status = 'yellow'; // Improving
    } else if (att.correct < 2 && att.incorrect > 0) {
      status = 'red'; // Needs Work
    }
    return { word, status };
  });
  
  // Shuffling within status tiers
  const groups = { red: [], grey: [], yellow: [], green: [] };
  classified.forEach(item => groups[item.status].push(item.word));
  
  return [
    ...shuffleArray(groups.red),
    ...shuffleArray(groups.grey),
    ...shuffleArray(groups.yellow),
    ...shuffleArray(groups.green)
  ];
}

function startPractice(isBossBattle) { 
  State.focusMode = !!isBossBattle;
  const bossTag = $('bossTag');
  if (bossTag) {
    bossTag.classList.toggle('hidden', !State.focusMode);
  }
  
  const pool = State.focusMode ? getBossBattlePool() : getPool();
  if (!pool || pool.length === 0) return;
  
  let selectedWords = State.focusMode ? pool.slice(0, State.wordsPerRound) : shuffleArray(pool).slice(0, State.wordsPerRound);
  State.sessionWords = shuffleArray(selectedWords);
  State.currentIndex = 0;
  State.results = [];
  State.currentStreak = 0;
  State.bestRoundStreak = 0;
  
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
  
  input.value = '';
  State.currentIndex++;

  if (!State.appData.attempts[State.activeUser]) {
    State.appData.attempts[State.activeUser] = {};
  }
  if (!State.appData.attempts[State.activeUser][word]) {
    State.appData.attempts[State.activeUser][word] = { correct: 0, incorrect: 0 };
  }
  const att = State.appData.attempts[State.activeUser][word];

  if (isCorrect) {
    State.currentStreak++;
    State.bestRoundStreak = Math.max(State.bestRoundStreak, State.currentStreak);
    att.correct++;
    
    let earned = State.activeList === 'Year 5–6' ? 10 : 5;
    let feedbackMsg = `Correct! +${earned} ฿ 🪙`;
    
    if (State.currentStreak > 0 && State.currentStreak % 5 === 0) {
      earned += 5;
      feedbackMsg = `Streak of ${State.currentStreak}! +${earned} ฿ 🔥`;
    }
    
    State.appData.bounty[State.activeUser] = (State.appData.bounty[State.activeUser] || 0) + earned;
    AudioSys.play('correct');
    triggerCelebration(Math.random() > 0.8 ? 'mastered' : 'mini');
    
    if (!State.appData.progress) State.appData.progress = {};
    if (!State.appData.progress[State.activeUser]) State.appData.progress[State.activeUser] = [];
    if (!State.appData.progress[State.activeUser].includes(word)) {
      State.appData.progress[State.activeUser].push(word);
    }
    try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
    showFeedback(feedbackMsg, 'good');
  } else {
    State.currentStreak = 0;
    att.incorrect++;
    AudioSys.play('incorrect');
    try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
    showFeedback(`Not quite! The word was: ${word}`, 'warn');
  }
  
  if (State.currentIndex < State.sessionWords.length) {
    updatePracticeUI();
    if (State.autoSpeak) setTimeout(() => speakWord(State.sessionWords[State.currentIndex]), 300);
    input.focus();
  } else {
    AudioSys.play('tada');
    
    const correctCount = State.results.filter(r => r.isCorrect).length;
    const total = State.results.length;
    const accuracy = Math.round((correctCount / total) * 100) || 0;
    
    let roundBonus = 0;
    let completionMsg = '';
    
    if (correctCount === total) {
      roundBonus += 25;
      completionMsg += 'Perfect Round bonus: +25 ฿ 🌟 ';
    }
    
    if (State.focusMode && accuracy >= 80) {
      roundBonus += 25;
      completionMsg += 'Boss Battle Victory bonus: +25 ฿ ⚔️ ';
    }
    
    if (roundBonus > 0) {
      State.appData.bounty[State.activeUser] = (State.appData.bounty[State.activeUser] || 0) + roundBonus;
      showFeedback(completionMsg.trim(), 'good');
    }
    
    const userMetrics = State.appData.metrics[State.activeUser];
    if (userMetrics) {
      userMetrics.bestStreak = Math.max(userMetrics.bestStreak || 0, State.bestRoundStreak);
      userMetrics.rounds = (userMetrics.rounds || 0) + 1;
      userMetrics.bestExact = Math.max(userMetrics.bestExact || 0, accuracy);
      if (State.focusMode && correctCount === total) {
        userMetrics.perfectBossBattle = true;
      }
      
      let secureCount = 0;
      const userAtts = State.appData.attempts[State.activeUser] || {};
      Object.keys(userAtts).forEach(w => {
        if (userAtts[w].correct >= 2) secureCount++;
      });
      userMetrics.secureWords = secureCount;
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
    
    persistData();
    
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
  const attempts = State.appData.attempts[State.activeUser] || {};
  
  grid.innerHTML = '';
  let secure = 0, improving = 0, needsWork = 0, notTried = 0;

  pool.forEach(word => {
    const w = word.toLowerCase();
    const att = attempts[w] || { correct: 0, incorrect: 0 };
    
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    let statusText = '';
    let bg = '';
    
    if (att.correct >= 2) {
      bg = 'var(--green-soft)';
      statusText = 'Secure';
      secure++;
    } else if (att.correct === 1 && att.incorrect === 0) {
      bg = 'var(--amber)';
      statusText = 'Improving';
      improving++;
    } else if (att.correct < 2 && att.incorrect > 0) {
      bg = 'var(--red-soft)';
      statusText = 'Needs Work';
      needsWork++;
    } else {
      bg = 'var(--grey)';
      statusText = 'Not Tried';
      notTried++;
    }
    
    cell.style.backgroundColor = bg;
    
    cell.innerHTML = `
      <div class="heatmap-word">${word}</div>
      <div class="heatmap-meta">${statusText} (${att.correct}✔/${att.incorrect}✘)</div>
    `;
    
    grid.appendChild(cell);
  });

  summary.textContent = `Secure: ${secure} | Improving: ${improving} | Needs work: ${needsWork} | Not tried: ${notTried}`;
}

const ShopItems = [
  { id: 'fizzy', name: 'Can of Fizzy Drink', cost: 250, icon: '🥤', desc: 'A refreshing fizzy drink of choice.' },
  { id: 'screen', name: '30 Mins Screen Time', cost: 600, icon: '🎮', desc: 'Bonus gaming or video time.' },
  { id: 'icecream', name: 'Trip for Ice Cream', cost: 1000, icon: '🍦', desc: 'A trip to the local parlor for a scoop.' },
  { id: 'manga', name: 'One Piece Manga Vol', cost: 1500, icon: '📖', desc: 'A physical copy of the next manga book.' },
  { id: 'pizza', name: 'Yard Sale Pizza', cost: 2000, icon: '🍕', desc: 'Delicious Yard Sale pizza delivery night!' },
  { id: 'movie', name: 'Movie Night', cost: 2500, icon: '🎬', desc: 'Choice of movie with popcorn & treats.' },
  { id: 'trip', name: 'Family Day Trip', cost: 5000, icon: '🎡', desc: 'A fun day out (zoo, theme park, or museum).' },
  { id: 'yesday', name: 'A "Yes" Day', cost: 10000, icon: '👑', desc: 'George makes the rules for a day!' }
];

function applyTheme(themeId) {
  document.body.className = '';
  if (themeId === 'onepiece') {
    document.body.classList.add('onepiece-theme');
  } else {
    document.body.classList.add(`theme-${themeId}`);
  }
}

function renderThemes() {
  const grid = $('themeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const userThemes = getThemeState(State.activeUser);
  
  Object.keys(Config.THEME_DEFS).forEach(themeId => {
    const def = Config.THEME_DEFS[themeId];
    const isUnlocked = userThemes.unlocked.includes(themeId);
    
    const card = document.createElement('div');
    card.className = `theme-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    
    const preview = document.createElement('div');
    preview.className = `theme-preview ${themeId}`;
    card.appendChild(preview);
    
    const name = document.createElement('div');
    name.style.fontWeight = 'bold';
    name.textContent = def.name;
    card.appendChild(name);
    
    const note = document.createElement('div');
    note.className = 'unlock-note';
    note.textContent = isUnlocked ? (userThemes.selected === themeId ? 'Active' : 'Click to select') : `Locked: ${def.unlockText}`;
    card.appendChild(note);
    
    if (isUnlocked) {
      card.style.cursor = 'pointer';
      if (userThemes.selected === themeId) {
        card.style.borderColor = '#fbbf24';
        card.style.background = 'var(--soft)';
      }
      card.addEventListener('click', () => {
        userThemes.selected = themeId;
        persistData();
        applyTheme(themeId);
      });
    }
    
    grid.appendChild(card);
  });
}

function renderBountyShop() {
  const grid = $('bountyShopGrid');
  const balanceLabel = $('shopBountyBalance');
  const bountyPill = $('bountyPill');
  if (!grid) return;
  
  const userBounty = State.appData.bounty[State.activeUser] || 0;
  if (balanceLabel) balanceLabel.textContent = `${userBounty} ฿`;
  if (bountyPill) bountyPill.textContent = `Bounty: ${userBounty} ฿`;
  
  grid.innerHTML = '';
  ShopItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bounty-shop-card';
    
    card.innerHTML = `
      <div class="bounty-shop-icon">${item.icon}</div>
      <div class="bounty-shop-title">${item.name}</div>
      <div class="bounty-shop-cost">${item.cost} ฿</div>
      <div class="tiny muted" style="margin-bottom: 8px; font-size: 0.75rem;">${item.desc}</div>
    `;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bounty-shop-btn';
    btn.textContent = 'Redeem';
    
    const canAfford = userBounty >= item.cost;
    if (!canAfford) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }
    
    btn.addEventListener('click', () => {
      redeemTreat(item);
    });
    
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function redeemTreat(item) {
  const userBounty = State.appData.bounty[State.activeUser] || 0;
  if (userBounty < item.cost) return;
  
  State.appData.bounty[State.activeUser] -= item.cost;
  
  const redemption = {
    id: Math.random().toString(36).substr(2, 9),
    item: item.name,
    cost: item.cost,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  if (!State.appData.redemptions[State.activeUser]) {
    State.appData.redemptions[State.activeUser] = [];
  }
  State.appData.redemptions[State.activeUser].push(redemption);
  
  persistData();
  triggerCelebration('mastered');
  showFeedback(`Redeemed: ${item.name}! 🏴‍☠️`, 'good');
}

function renderParentDashboard() {
  const summary = $('dashboardSummary');
  const grid = $('dashboardGrid');
  const redemptionsList = $('pendingRedemptionsList');
  if (!summary || !grid || !redemptionsList) return;
  
  const children = ['George', 'Ben'];
  summary.textContent = `Parent dashboard showing spelling status and bounty shop requests for George and Ben.`;
  
  grid.innerHTML = '';
  children.forEach(child => {
    const userMetrics = State.appData.metrics[child] || {};
    const userBounty = State.appData.bounty[child] || 0;
    const userProgress = getProgressForUser(child);
    const attempts = State.appData.attempts[child] || {};
    
    const weakWords = Object.keys(attempts).filter(w => attempts[w].incorrect > 0 && attempts[w].correct < 2);
    
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.innerHTML = `
      <h4 style="margin: 0 0 8px 0; font-family: 'Cinzel', serif; color: #fef08a;">${AVATARS[child] || '👤'} ${child}</h4>
      <div class="tiny" style="line-height: 1.6;">
        <div><strong>Bounty Balance:</strong> <span style="color: #fbbf24; font-weight: 700;">${userBounty} ฿</span></div>
        <div><strong>Mastered Words:</strong> ${userProgress.length}</div>
        <div><strong>Rounds Played:</strong> ${userMetrics.rounds || 0}</div>
        <div><strong>Best Streak:</strong> ${userMetrics.bestStreak || 0}</div>
        <div style="margin-top: 10px;"><strong>Weak Words (${weakWords.length}):</strong></div>
        <ul class="weak-list" style="margin: 4px 0 0 0; padding-left: 16px;">
          ${weakWords.length > 0 ? weakWords.slice(0, 5).map(w => `<li>${w}</li>`).join('') : '<li>None! Spelling Ninja! ⚔️</li>'}
          ${weakWords.length > 5 ? '<li>...and more</li>' : ''}
        </ul>
      </div>
    `;
    grid.appendChild(card);
  });
  
  let pending = [];
  children.forEach(child => {
    const userReds = State.appData.redemptions[child] || [];
    userReds.forEach(r => {
      if (r.status === 'pending') {
        pending.push({ child, ...r });
      }
    });
  });
  
  if (pending.length === 0) {
    redemptionsList.innerHTML = '<p class="tiny muted">No pending redemptions to approve.</p>';
  } else {
    redemptionsList.innerHTML = pending.map(r => {
      const date = new Date(r.timestamp).toLocaleDateString();
      return `
        <div class="result-item" style="border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin-top: 8px;">
          <div>
            <strong>${r.child}</strong> requested <strong>${r.item}</strong> (${r.cost} ฿) on ${date}
          </div>
          <div class="controls" style="margin-top: 8px;">
            <button type="button" class="primary" style="padding: 4px 10px !important; font-size: 0.75rem !important;" onclick="approveRedemption('${r.child}', '${r.id}')">Approve & Deliver</button>
            <button type="button" class="secondary" style="padding: 4px 10px !important; font-size: 0.75rem !important;" onclick="cancelRedemption('${r.child}', '${r.id}')">Deny / Refund</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.approveRedemption = function(child, id) {
  const reds = State.appData.redemptions[child] || [];
  const idx = reds.findIndex(r => r.id === id);
  if (idx !== -1) {
    reds[idx].status = 'approved';
    persistData();
    showFeedback(`Approved redemption for ${child}!`, 'good');
  }
};

window.cancelRedemption = function(child, id) {
  const reds = State.appData.redemptions[child] || [];
  const idx = reds.findIndex(r => r.id === id);
  if (idx !== -1) {
    const item = reds[idx];
    State.appData.bounty[child] += item.cost;
    reds.splice(idx, 1);
    persistData();
    showFeedback(`Denied & refunded redemption for ${child}.`, 'warn');
  }
};

// --- Fun Visual Rewards ---
function triggerCelebration(type = 'mini') {
  const layer = $('celebrationLayer');
  if (!layer) return;
  
  const particle = document.createElement('div');
  particle.textContent = type === 'mastered' ? '⭐' : '🪙';
  particle.style.position = 'absolute';
  particle.style.left = Math.random() * 80 + 10 + '%';
  particle.style.top = Math.random() * 50 + 25 + '%';
  particle.style.fontSize = type === 'mastered' ? '4rem' : '2rem';
  particle.style.transition = 'all 1s ease-out';
  particle.style.pointerEvents = 'none';
  
  layer.appendChild(particle);
  
  requestAnimationFrame(() => {
    particle.style.transform = `translateY(-100px) scale(${type === 'mastered' ? 1.5 : 1})`;
    particle.style.opacity = '0';
  });
  
  setTimeout(() => particle.remove(), 1000);
}

State.appData = loadLocalData();

function getPool() { return Config.WORD_SETS[State.activeList] || []; }
function getThemeState(user) { return State.appData.themes[user] || { unlocked: ['onepiece', 'volcano'], selected: 'onepiece' }; }
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

userButtons.forEach(btn => btn.addEventListener('click', () => { 
  State.activeUser = btn.dataset.user; 
  savePreferredUser(); 
  const userThemes = getThemeState(State.activeUser);
  applyTheme(userThemes.selected || 'onepiece');
  renderAll(); 
  show('startView'); 
}));
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

loadPreferredUser();
initSpeech();
show('startView');
if (State.appData) {
  const userThemes = getThemeState(State.activeUser);
  applyTheme(userThemes.selected || 'onepiece');
}
renderAll();
updateSyncUI('Local app ready.');
if (Config.AUTO_SYNC) setupFirebaseSync();