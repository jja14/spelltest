const Config = {
  WORD_SETS: (window.WordDatabase && window.WordDatabase.WORD_SETS) ? window.WordDatabase.WORD_SETS : {
    "All Words": [],
    "Quest (11+)": [],
    "Year 5–6": [],
    "Year 3–4": []
  },
  WORD_METADATA: (window.WordDatabase && window.WordDatabase.WORD_METADATA) ? window.WordDatabase.WORD_METADATA : {},
  THEME_DEFS: {
    onepiece: { name: 'Straw Hat Crew', unlockText: 'Default theme', requirement: () => true },
    volcano: { name: 'Volcano', unlockText: 'Starter theme', requirement: () => true },
    space: { name: 'Space', unlockText: 'Streak of 5', requirement: (m) => m.bestStreak >= 5 },
    lightning: { name: 'Lightning', unlockText: '10 secure words', requirement: (m) => m.secureWords >= 10 },
    robot: { name: 'Robot Lab', unlockText: 'Complete 5 rounds', requirement: (m) => m.rounds >= 5 },
    ice: { name: 'Ice Cave', unlockText: '90%+ exact in one round', requirement: (m) => m.bestExact >= 90 },
    gold: { name: 'Gold Mode', unlockText: 'Perfect Boss Battle', requirement: (m) => m.perfectBossBattle }
  },
  USER_STANDARD_LISTS: {
    George: 'All Words',
    Ben: 'All Words',
    Lucy: 'All Words',
    James: 'All Words'
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
    survivalHighScores: { George: 0, Ben: 0, Lucy: 0, James: 0 },
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
  activeList: 'All Words',
  wordsPerRound: 10,
  autoSpeak: true,
  sessionWords: [],
  currentIndex: 0,
  results: [],
  focusMode: false,
  survivalMode: false,
  lives: 3,
  survivalRun: 0,
  recognition: null,
  listening: false,
  appData: null,
  syncEnabled: false,
  firebaseReady: false,
  firebaseRef: null,
  currentStreak: 0,
  bestRoundStreak: 0,
  lastHeatmapStates: {},
  heatmapListFilter: 'all',
  heatmapSearchQuery: '',
};

// --- DOM Selectors & Utility Functions ---
const $ = id => document.getElementById(id);
const userButtons = document.querySelectorAll('.user-btn');
const yearButtons = document.querySelectorAll('.year-btn');
const countButtons = document.querySelectorAll('.count-btn');

const AVATARS = { George: '🦖', Ben: '🤖', Lucy: '🦄', James: '🧙‍♂️' };

function getWordTagsHTML(word) {
  if (!word) return '';
  const meta = Config.WORD_METADATA[word.toLowerCase()];
  if (!meta || !meta.lists || meta.lists.length === 0) return '';
  return meta.lists.map(listName => {
    let cls = 'tag-quest';
    let label = 'Quest';
    if (listName === 'Year 5–6') {
      cls = 'tag-y56';
      label = 'Y5–6';
    } else if (listName === 'Year 3–4') {
      cls = 'tag-y34';
      label = 'Y3–4';
    } else if (listName.includes('Quest')) {
      cls = 'tag-quest';
      label = 'Quest 11+';
    }
    return `<span class="word-tag ${cls}">${label}</span>`;
  }).join(' ');
}

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
      } else if (type === 'life-lost') {
        // Dramatic low buzz/heartbreak
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (type === 'gameover') {
        // Minor descending game over sequence
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(415.3, now + 0.2);
        osc.frequency.setValueAtTime(392, now + 0.4);
        osc.frequency.setValueAtTime(349.2, now + 0.6);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.2);
        osc.start(now); osc.stop(now + 1.2);
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
  if (!data.survivalHighScores) data.survivalHighScores = {};
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
    if (typeof data.survivalHighScores[u] !== 'number') data.survivalHighScores[u] = 0;
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
  
  if (State.appData) {
    const userMetrics = State.appData.metrics[State.activeUser] || { bestStreak: 0 };
    const bestStreak = userMetrics.bestStreak || 0;
    if ($('streakPill')) $('streakPill').textContent = `Streak: ${bestStreak} 🔥`;
    
    const userProgress = getProgressForUser(State.activeUser);
    const masteredCount = userProgress.length;
    let title = 'Spelling Recruit';
    if (masteredCount >= 50) title = 'Spelling Pirate King 👑';
    else if (masteredCount >= 35) title = 'Spelling Captain 🏴‍☠️';
    else if (masteredCount >= 20) title = 'Spelling First Mate ⚔️';
    else if (masteredCount >= 10) title = 'Spelling Swashbuckler 🗡️';
    else if (masteredCount >= 5) title = 'Spelling Apprentice ⚓';
    
    if ($('titlePill')) $('titlePill').textContent = title;
  }
  
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
  renderSurvivalLeaderboard('survivalLeaderboardList');

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
  if (State.survivalMode) {
    if ($('standardPracticeHeader')) $('standardPracticeHeader').classList.add('hidden');
    if ($('survivalPracticeHeader')) $('survivalPracticeHeader').classList.remove('hidden');
    if ($('bossTag')) $('bossTag').classList.add('hidden');
    if ($('survivalTag')) $('survivalTag').classList.remove('hidden');

    if ($('livesContainer')) {
      const hearts = ['🖤', '🖤', '🖤'];
      for (let i = 0; i < Math.max(0, State.lives); i++) {
        hearts[i] = '❤️';
      }
      $('livesContainer').textContent = hearts.join('');
    }
    if ($('survivalRunPill')) {
      $('survivalRunPill').textContent = `Run: ${State.survivalRun} words 🔥`;
    }
    if ($('progressBar')) {
      const step = State.survivalRun % 5;
      const pct = Math.max(12, (step / 5) * 100);
      $('progressBar').style.width = `${pct}%`;
    }
  } else {
    if ($('standardPracticeHeader')) $('standardPracticeHeader').classList.remove('hidden');
    if ($('survivalPracticeHeader')) $('survivalPracticeHeader').classList.add('hidden');
    if ($('bossTag')) $('bossTag').classList.toggle('hidden', !State.focusMode);
    if ($('survivalTag')) $('survivalTag').classList.add('hidden');

    if ($('wordPosition')) $('wordPosition').textContent = `Word ${State.currentIndex + 1} of ${State.sessionWords.length}`;
    if ($('answeredCount')) $('answeredCount').textContent = `${State.currentIndex} answered`;
    if ($('progressBar')) {
      const pct = (State.currentIndex / State.sessionWords.length) * 100;
      $('progressBar').style.width = `${pct}%`;
    }
  }

  const currentWord = State.sessionWords[State.currentIndex];
  if ($('wordMetaTags')) {
    $('wordMetaTags').innerHTML = currentWord ? getWordTagsHTML(currentWord) : '';
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

function startPractice(isBossBattle, isSurvival = false) { 
  State.survivalMode = !!isSurvival;
  State.focusMode = !isSurvival && !!isBossBattle;
  State.lives = 3;
  State.survivalRun = 0;
  
  const bossTag = $('bossTag');
  if (bossTag) {
    bossTag.classList.toggle('hidden', !State.focusMode);
  }
  const survivalTag = $('survivalTag');
  if (survivalTag) {
    survivalTag.classList.toggle('hidden', !State.survivalMode);
  }
  
  const pool = State.focusMode ? getBossBattlePool() : getPool();
  if (!pool || pool.length === 0) return;
  
  if (State.survivalMode) {
    State.sessionWords = shuffleArray(pool);
  } else {
    let selectedWords = State.focusMode ? pool.slice(0, State.wordsPerRound) : shuffleArray(pool).slice(0, State.wordsPerRound);
    State.sessionWords = shuffleArray(selectedWords);
  }

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

  if (State.survivalMode) {
    if (isCorrect) {
      State.survivalRun++;
      State.currentStreak++;
      State.bestRoundStreak = Math.max(State.bestRoundStreak, State.survivalRun);
      att.correct++;

      let earned = 5;
      let feedbackMsg = `Correct! +${earned} ฿ | Run: ${State.survivalRun} words! 🔥`;
      if (State.survivalRun % 5 === 0) {
        earned += 10;
        feedbackMsg = `Milestone: ${State.survivalRun} words! +${earned} ฿ 🔥👑`;
      }

      State.appData.bounty[State.activeUser] = (State.appData.bounty[State.activeUser] || 0) + earned;
      AudioSys.play('correct');
      triggerCelebration(State.survivalRun % 5 === 0 ? 'mastered' : 'mini');

      if (!State.appData.progress) State.appData.progress = {};
      if (!State.appData.progress[State.activeUser]) State.appData.progress[State.activeUser] = [];
      if (!State.appData.progress[State.activeUser].includes(word)) {
        State.appData.progress[State.activeUser].push(word);
      }
      try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
      showFeedback(feedbackMsg, 'good');

      const prevBest = State.appData.survivalHighScores[State.activeUser] || 0;
      if (State.survivalRun > prevBest) {
        State.appData.survivalHighScores[State.activeUser] = State.survivalRun;
      }
    } else {
      State.lives--;
      State.currentStreak = 0;
      att.incorrect++;

      const livesBox = $('livesContainer');
      if (livesBox) {
        livesBox.classList.remove('life-lost-anim');
        void livesBox.offsetWidth;
        livesBox.classList.add('life-lost-anim');
      }

      if (State.lives > 0) {
        AudioSys.play('life-lost');
        try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
        showFeedback(`Life lost! (Word was: ${word}). ${State.lives} ${State.lives === 1 ? 'life' : 'lives'} left! 💔`, 'warn');
      } else {
        AudioSys.play('gameover');
        try { persistData(); } catch (e) { console.warn("Could not save progress", e); }
        showFeedback(`GAME OVER! Final run: ${State.survivalRun} words.`, 'warn');
      }
    }

    if (State.lives <= 0) {
      endSurvivalRun();
      return;
    }

    if (State.currentIndex >= State.sessionWords.length) {
      State.sessionWords.push(...shuffleArray(getPool()));
    }

    updatePracticeUI();
    if (State.autoSpeak) setTimeout(() => speakWord(State.sessionWords[State.currentIndex]), 300);
    input.focus();
    return;
  }

  if (isCorrect) {
    State.currentStreak++;
    State.bestRoundStreak = Math.max(State.bestRoundStreak, State.currentStreak);
    att.correct++;
    
    const standardList = Config.USER_STANDARD_LISTS[State.activeUser] || 'All Words';
    let earned = 5;
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
    
    if ($('resultsHeading')) $('resultsHeading').textContent = 'Round complete';
    if ($('resultsSubheading')) $('resultsSubheading').textContent = 'A clear summary with exact score and overall spelling accuracy.';
    if ($('scoreLabel')) $('scoreLabel').textContent = 'Exact score';
    if ($('exactScore')) $('exactScore').textContent = `${correctCount}/${total}`;
    if ($('accuracyLabel')) $('accuracyLabel').textContent = 'Average accuracy';
    if ($('averageAccuracy')) $('averageAccuracy').textContent = `${accuracy}%`;
    if ($('ratingLabel')) $('ratingLabel').textContent = 'Rating';
    if ($('roundRating')) $('roundRating').textContent = accuracy === 100 ? 'Perfect! 🌟' : accuracy >= 80 ? 'Great job! ✨' : 'Good effort! 👍';
    
    if ($('resultsLeaderboardBox')) $('resultsLeaderboardBox').classList.add('hidden');
    if ($('retryBtn')) $('retryBtn').classList.remove('hidden');
    if ($('retrySurvivalBtn')) $('retrySurvivalBtn').classList.add('hidden');
    
    const listElem = $('resultsList');
    if (listElem) {
      listElem.innerHTML = State.results.map(r => {
        const userAnswer = r.answer && r.answer.trim() ? r.answer : '(left blank)';
        const tags = getWordTagsHTML(r.word);
        return `<div style="padding: 10px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div><strong>${r.word}</strong>: ${r.isCorrect ? '✅' : `❌ (you typed: <em>${userAnswer}</em>)`}</div>
          <div class="heatmap-tags" style="margin: 0;">${tags}</div>
        </div>`;
      }).join('');
    }

    show('resultsView');
  }
}

function endSurvivalRun() {
  const currentRun = State.survivalRun;
  const prevBest = State.appData.survivalHighScores[State.activeUser] || 0;
  const isNewRecord = currentRun > prevBest;
  if (isNewRecord) {
    State.appData.survivalHighScores[State.activeUser] = currentRun;
    triggerCelebration('mastered');
  }

  const userMetrics = State.appData.metrics[State.activeUser];
  if (userMetrics) {
    userMetrics.bestStreak = Math.max(userMetrics.bestStreak || 0, currentRun);
    userMetrics.rounds = (userMetrics.rounds || 0) + 1;
  }

  persistData();

  if ($('resultsHeading')) $('resultsHeading').textContent = isNewRecord ? '👑 New Survival Record!' : '💀 Survival Run Over';
  if ($('resultsSubheading')) {
    $('resultsSubheading').textContent = isNewRecord 
      ? `Incredible job, ${State.activeUser}! You set a brand new personal best run of ${currentRun} words!`
      : `You spelled ${currentRun} words correctly before running out of lives!`;
  }
  if ($('scoreLabel')) $('scoreLabel').textContent = 'Words Spelled';
  if ($('exactScore')) $('exactScore').textContent = currentRun;
  if ($('accuracyLabel')) $('accuracyLabel').textContent = 'Personal Best';
  if ($('averageAccuracy')) $('averageAccuracy').textContent = `${State.appData.survivalHighScores[State.activeUser]} words`;
  if ($('ratingLabel')) $('ratingLabel').textContent = 'Run Rank';
  if ($('roundRating')) $('roundRating').textContent = isNewRecord ? 'NEW RECORD! 👑' : currentRun >= 15 ? 'Pirate Legend! 🔥' : currentRun >= 8 ? 'Warrior! ⚔️' : 'Nice Attempt! 👍';

  if ($('resultsLeaderboardBox')) {
    $('resultsLeaderboardBox').classList.remove('hidden');
    if ($('resultsPersonalBestNote')) {
      $('resultsPersonalBestNote').textContent = `${State.activeUser}'s Record: ${State.appData.survivalHighScores[State.activeUser]} words`;
    }
    renderSurvivalLeaderboard('resultsLeaderboardList');
  }

  if ($('retryBtn')) $('retryBtn').classList.add('hidden');
  if ($('retrySurvivalBtn')) $('retrySurvivalBtn').classList.remove('hidden');

  const listElem = $('resultsList');
  if (listElem) {
    listElem.innerHTML = State.results.map((r, i) => {
      const userAnswer = r.answer && r.answer.trim() ? r.answer : '(left blank)';
      const tags = getWordTagsHTML(r.word);
      return `<div style="padding: 10px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div><strong>#${i + 1} ${r.word}</strong>: ${r.isCorrect ? '✅' : `❌ (you typed: <em>${userAnswer}</em>)`}</div>
        <div class="heatmap-tags" style="margin: 0;">${tags}</div>
      </div>`;
    }).join('');
  }

  show('resultsView');
}

function renderSurvivalLeaderboard(targetId = 'survivalLeaderboardList') {
  const container = $(targetId);
  if (!container || !State.appData) return;

  const users = ['George', 'Ben', 'Lucy', 'James'];
  const scores = State.appData.survivalHighScores || {};
  
  const sorted = [...users].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  const medals = ['👑 1st', '🥈 2nd', '🥉 3rd', '4th'];

  container.innerHTML = sorted.map((user, idx) => {
    const score = scores[user] || 0;
    const isCurrentUser = user === State.activeUser;
    const isLeader = idx === 0 && score > 0;
    return `
      <div class="leaderboard-card ${isCurrentUser ? 'active-user' : ''} ${isLeader ? 'gold-leader' : ''}">
        <div class="leaderboard-rank">${medals[idx]}</div>
        <div class="leaderboard-avatar">${AVATARS[user] || '👤'}</div>
        <div class="leaderboard-name"><strong>${user}</strong></div>
        <div class="leaderboard-score">${score} <span class="tiny muted" style="font-size:0.75rem;">words</span></div>
      </div>
    `;
  }).join('');
}

// --- Speech & Audio System with ChromeOS / Chromebook Compatibility ---
let synth = null;
let preferredVoice = null;
let availableVoices = [];
let voiceRetries = 0;
window.activeUtterances = []; // Prevents Chromium V8 garbage collection bug
let fallbackAudioPlayer = null;

function updateVoiceStatus(text, isError = false) {
  const elements = [$('voiceStatus'), $('voiceInitNotice')];
  elements.forEach(el => {
    if (el) {
      el.textContent = text;
      el.style.color = isError ? '#f87171' : 'var(--muted)';
    }
  });
}

function unlockAudioEngine() {
  try {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') {
      AudioSys.ctx.resume();
    }
  } catch (e) { console.warn("Audio unlock error", e); }
}
window.addEventListener('click', unlockAudioEngine);
window.addEventListener('keydown', unlockAudioEngine);
window.addEventListener('touchstart', unlockAudioEngine);

function selectBestVoice(voices) {
  if (!voices || voices.length === 0) return null;
  return voices.find(v => v.lang === 'en-GB' || v.lang === 'en_GB')
      || voices.find(v => (v.name || '').toLowerCase().includes('united kingdom') || (v.name || '').toLowerCase().includes('uk english'))
      || voices.find(v => (v.lang || '').startsWith('en'))
      || voices[0];
}

function loadVoices() {
  if (!synth) return;
  try {
    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      availableVoices = voices;
      preferredVoice = selectBestVoice(voices);
      const voiceName = preferredVoice ? preferredVoice.name : 'System default';
      updateVoiceStatus(`🔊 Voice ready (${voiceName})`);
      return true;
    }
  } catch (e) { console.warn("loadVoices error", e); }

  if (voiceRetries < 15) {
    voiceRetries++;
    setTimeout(loadVoices, 250);
  } else {
    updateVoiceStatus('🔊 Voice ready (audio fallback active)');
  }
  return false;
}

function initSpeech() { 
  if (window.speechSynthesis) {
    synth = window.speechSynthesis;
    try {
      synth.onvoiceschanged = () => {
        loadVoices();
      };
    } catch (e) {}
    loadVoices();
  } else {
    updateVoiceStatus('🔊 Voice ready (audio playback mode)');
  }
}

// Seamless Audio Fallback using Google TTS or Dictionary pronunciation
function playAudioFallback(word, onEnded) {
  try {
    if (fallbackAudioPlayer) {
      fallbackAudioPlayer.pause();
      fallbackAudioPlayer.currentTime = 0;
    }
    const cleanWord = (word || '').trim().toLowerCase();
    if (!cleanWord) return;

    // Use Google TTS web stream (reliable audio/mpeg for UK English)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;
    fallbackAudioPlayer = new Audio(ttsUrl);
    
    updateVoiceStatus(`🔊 Playing audio for "${cleanWord}"`);
    
    fallbackAudioPlayer.onended = () => {
      updateVoiceStatus('🔊 Click "Say word" to hear again');
      if (typeof onEnded === 'function') onEnded();
    };
    
    fallbackAudioPlayer.onerror = async () => {
      // Secondary fallback: Free Dictionary API MP3
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
        if (res.ok) {
          const data = await res.json();
          for (const p of data[0]?.phonetics || []) {
            if (p.audio && p.audio.trim()) {
              const dictAudio = new Audio(p.audio);
              dictAudio.play().catch(() => {});
              dictAudio.onended = () => updateVoiceStatus('🔊 Click "Say word" to hear again');
              return;
            }
          }
        }
      } catch (err) {}
      updateVoiceStatus(`Spelling word: "${cleanWord}"`, true);
    };

    const playPromise = fallbackAudioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn("Audio fallback autoplay error", err);
        updateVoiceStatus(`🔊 Press "Say word" to hear pronunciation`);
      });
    }
  } catch (err) {
    console.warn("Fallback audio initialization failed", err);
    updateVoiceStatus(`Word: "${word}"`, true);
  }
}

function speakWord(word) { 
  if (!word) return;
  const cleanWord = word.trim().toLowerCase();

  // If Web Speech API is not supported on this device, immediately use audio fallback
  if (!synth) {
    playAudioFallback(cleanWord);
    return;
  }

  unlockAudioEngine();

  // Cancel any ongoing speech
  try {
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }
  } catch (e) {}

  // A small timeout avoids Chromium's cancel/speak race condition bug
  setTimeout(() => {
    try {
      if (synth.paused) {
        synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleanWord);
      utterance.lang = 'en-GB';
      utterance.rate = 0.85;
      
      // Ensure we have the latest voices
      if (!preferredVoice && availableVoices.length > 0) {
        preferredVoice = selectBestVoice(availableVoices);
      }
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      let speechStarted = false;

      // Retain in global array to prevent Chrome V8 garbage collection bug
      window.activeUtterances.push(utterance);
      const cleanup = () => {
        const idx = window.activeUtterances.indexOf(utterance);
        if (idx !== -1) window.activeUtterances.splice(idx, 1);
      };

      utterance.onstart = () => {
        speechStarted = true;
        updateVoiceStatus(`🔊 Speaking "${cleanWord}"...`);
      };

      utterance.onend = () => {
        cleanup();
        updateVoiceStatus('🔊 Click "Say word" to hear again');
      };

      utterance.onerror = (e) => {
        cleanup();
        console.warn("SpeechSynthesis error, falling back to audio:", e);
        playAudioFallback(cleanWord);
      };

      // Watchdog timer: If Chromebook speech synthesis hangs without starting in 1.4s, use fallback
      setTimeout(() => {
        if (!speechStarted && window.activeUtterances.includes(utterance)) {
          cleanup();
          try { synth.cancel(); } catch (err) {}
          console.warn("SpeechSynthesis stalled on device, using fallback audio");
          playAudioFallback(cleanWord);
        }
      }, 1400);

      synth.speak(utterance);
    } catch (e) {
      console.warn("Failed to speak via SpeechSynthesis, using fallback audio", e);
      playAudioFallback(cleanWord);
    }
  }, 40);
}

async function speakWithContext(word) {
  if (!word) return;
  const cleanWord = word.trim().toLowerCase();
  
  // Instantly say the word first
  speakWord(cleanWord);
  
  let sentence = `The word is ${cleanWord}.`;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
    if (res.ok) {
      const data = await res.json();
      for (const m of data[0]?.meanings || []) {
        const def = (m.definitions || []).find(d => d.example);
        if (def) { sentence = def.example.replace(/<[^>]*>?/gm, ''); break; }
      }
    }
  } catch (e) { console.warn("Could not fetch dictionary context", e); }

  // Queue context sentence after a short delay
  setTimeout(() => {
    if (synth) {
      try {
        const uSentence = new SpeechSynthesisUtterance(sentence);
        uSentence.lang = 'en-GB';
        uSentence.rate = 0.85;
        if (preferredVoice) uSentence.voice = preferredVoice;
        window.activeUtterances.push(uSentence);
        uSentence.onend = () => {
          const idx = window.activeUtterances.indexOf(uSentence);
          if (idx !== -1) window.activeUtterances.splice(idx, 1);
        };
        synth.speak(uSentence);
      } catch (e) {
        console.warn("Context speech error", e);
      }
    }
  }, 1000);
}

function renderHeatmap() { 
  const grid = $('heatmapGrid');
  const summary = $('heatmapSummary');
  if (!grid || !summary) return;

  let pool = getPool();
  const attempts = State.appData.attempts[State.activeUser] || {};
  
  // Filter by list if filter is set
  if (State.heatmapListFilter && State.heatmapListFilter !== 'all') {
    pool = pool.filter(word => {
      const meta = Config.WORD_METADATA[word.toLowerCase()];
      return meta && meta.lists && meta.lists.includes(State.heatmapListFilter);
    });
  }

  // Filter by search query if present
  if (State.heatmapSearchQuery && State.heatmapSearchQuery.trim()) {
    const q = State.heatmapSearchQuery.trim().toLowerCase();
    pool = pool.filter(word => word.toLowerCase().includes(q));
  }

  // Update active state on heatmap filter buttons
  document.querySelectorAll('.heatmap-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.listFilter === (State.heatmapListFilter || 'all'));
  });

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
      <div>
        <div class="heatmap-word">${word}</div>
        <div class="heatmap-tags">${getWordTagsHTML(word)}</div>
      </div>
      <div class="heatmap-meta">${statusText} (${att.correct}✔/${att.incorrect}✘)</div>
    `;
    
    grid.appendChild(cell);
  });

  const filterLabel = State.heatmapListFilter && State.heatmapListFilter !== 'all' ? ` (${State.heatmapListFilter})` : '';
  summary.textContent = `Showing ${pool.length} words${filterLabel}: Secure: ${secure} | Improving: ${improving} | Needs work: ${needsWork} | Not tried: ${notTried}`;
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
          ${weakWords.length > 0 ? weakWords.slice(0, 5).map(w => `<li style="margin-bottom: 4px;"><strong>${w}</strong> ${getWordTagsHTML(w)}</li>`).join('') : '<li>None! Spelling Ninja! ⚔️</li>'}
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

function getPool() { return Config.WORD_SETS[State.activeList] || Config.WORD_SETS['All Words'] || []; }
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
document.querySelectorAll('.heatmap-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    State.heatmapListFilter = btn.dataset.listFilter;
    renderHeatmap();
  });
});
if ($('heatmapSearchInput')) {
  $('heatmapSearchInput').addEventListener('input', (e) => {
    State.heatmapSearchQuery = e.target.value;
    renderHeatmap();
  });
}
countButtons.forEach(btn => btn.addEventListener('click', () => { State.wordsPerRound = Number(btn.dataset.count); renderAll(); }));
if ($('toggleAutoSpeak')) $('toggleAutoSpeak').addEventListener('click', () => { State.autoSpeak = !State.autoSpeak; renderAll(); });
if ($('newRoundBtn')) $('newRoundBtn').addEventListener('click', () => startPractice(false));
if ($('focusRoundBtn')) $('focusRoundBtn').addEventListener('click', () => startPractice(true));
if ($('survivalRoundBtn')) $('survivalRoundBtn').addEventListener('click', () => startPractice(false, true));
if ($('startBtn')) $('startBtn').addEventListener('click', () => startPractice(false));
if ($('startSurvivalBtn')) $('startSurvivalBtn').addEventListener('click', () => startPractice(false, true));
if ($('retryBtn')) $('retryBtn').addEventListener('click', () => startPractice(false));
if ($('retrySurvivalBtn')) $('retrySurvivalBtn').addEventListener('click', () => startPractice(false, true));
if ($('checkBtn')) $('checkBtn').addEventListener('click', submitAnswer);
if ($('sayWordBtn')) $('sayWordBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
if ($('hearAgainBtn')) $('hearAgainBtn').addEventListener('click', () => speakWord(State.sessionWords[State.currentIndex]));
if ($('testVoiceBtn')) $('testVoiceBtn').addEventListener('click', () => speakWord('Welcome to Grand Line spelling'));
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