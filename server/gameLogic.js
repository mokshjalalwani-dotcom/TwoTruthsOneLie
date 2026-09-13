/**
 * gameLogic.js — Room state machine for "Two Truths, One Room"
 *
 * All phase transitions are server-authoritative.
 * The `io` (Socket.io server) instance is injected so this module
 * can emit events directly when timers fire.
 */

const { generateRoomCode, generatePlayerId, shuffleWithMap, randomFrom } = require('./utils');

// ─── Constants ───────────────────────────────────────────────────────────────
const WRITING_TIMEOUT_MS = 75_000;
const VOTING_TIMEOUT_MS  = 25_000;
const REVEAL_AUTO_ADVANCE_MS = 8_000; // auto-advance to next round after reveal
const GRACE_PERIOD_MS    = 30_000;    // reconnect grace window

const LABELS = ['A', 'B', 'C'];

const CATEGORIES = [
  'Childhood',
  'Travel',
  'Food',
  'A job or school story',
  'An embarrassing moment',
  'A skill or talent',
  'A weird habit or fear',
  'Family',
  'Firsts (first job, first pet, etc.)',
  'A close call or lucky moment',
  'Sports or fitness',
  'Something you\'ve never told anyone',
  'A place you\'ve lived',
  'An unlikely friendship',
  'Money or a bad purchase',
];

/** Pick a random category, avoiding the one used last round. */
function _pickCategory(lastCategory) {
  const pool = CATEGORIES.filter(c => c !== lastCategory);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Fill-in-the-blank templates (keyed by category name) ────────────────────
const TEMPLATES = {
  'Childhood': [
    'As a kid, I once got caught ___',
    'I was obsessed with ___ growing up',
    'My biggest childhood fear was ___',
    'I broke ___ and blamed it on someone else',
    'My embarrassing childhood nickname was ___',
    'I genuinely believed ___ was true until I was way too old',
  ],
  'Travel': [
    'I once got completely lost in ___',
    'The strangest thing I ate on a trip was ___',
    "I've been to ___ but I'd never go back",
    'I once missed a flight/bus because of ___',
    'My most chaotic travel story happened in ___',
    'I traveled to ___ completely on a whim',
  ],
  'Food': [
    'I secretly hate ___, even though everyone loves it',
    'The weirdest thing I have ever eaten was ___',
    'I once ate ___ every single day for over a week',
    "I'm surprisingly good at cooking ___",
    'My unpopular food opinion is that ___ is overrated',
    'My comfort food that would surprise people is ___',
  ],
  'A job or school story': [
    'I once lied to my boss or teacher about ___',
    'My most embarrassing work or school moment was ___',
    'I got caught ___ at work or school',
    'My first ever job was ___ and I lasted ___',
    'I once accidentally sent a message about ___ to the wrong person',
    'I quit or almost quit a job or class because of ___',
  ],
  'An embarrassing moment': [
    'I once waved at someone who was not waving at me, then ___',
    'I called my ___ the wrong name at the worst possible moment',
    'I showed up to the wrong ___ and only noticed when ___',
    'I sent a message meant for ___ to the wrong person',
    'I tripped in public and the worst part was ___',
    'I accidentally said ___ out loud when I meant to think it',
  ],
  'A skill or talent': [
    'I can ___ faster than most people I know',
    "I've secretly been practising ___ for years",
    'People are always shocked I can ___',
    'I taught myself to ___ purely out of boredom',
    'My most useless hidden talent is ___',
    'I used to compete in ___ when I was younger',
  ],
  'A weird habit or fear': [
    'I cannot sleep unless ___',
    'I always ___ before leaving the house, even when late',
    "I'm irrationally terrified of ___",
    'I have a rule about ___ that confuses everyone I know',
    'I refuse to ___ no matter what',
    'Every time I ___, I have to repeat it a specific number of times',
  ],
  'Family': [
    'My family has a tradition of ___ that nobody else does',
    'The most chaotic family gathering involved ___',
    'A family rule growing up was ___, and I hated it',
    "My family's unspoken topic we never discuss is ___",
    'My family nickname is ___ and there is a whole story behind it',
    'One thing my family always argues about is ___',
  ],
  'Firsts (first job, first pet, etc.)': [
    'My first job was ___ and I lasted ___',
    'The first time I tried ___, I immediately regretted it',
    'My first pet was ___ and it ___',
    'The first time I traveled alone, I ___',
    'My first concert or big event was ___ and it was ___',
    'The very first time I drove a car, I ___',
  ],
  'A close call or lucky moment': [
    'I narrowly avoided ___ by pure accident',
    'Pure luck saved me when ___',
    'I accidentally won or got ___ without even trying',
    'I almost missed ___ because of ___',
    'I should not have survived the time I ___',
    'At the very last second, ___ saved me',
  ],
  'Sports or fitness': [
    'I once trained for ___ but quit because ___',
    'My most embarrassing sports moment was ___',
    "I'm surprisingly good at ___ despite never practising",
    'I once competed in ___ and ___',
    'I injured myself doing ___ and had to explain it to a doctor',
    'My secret fitness ritual that sounds ridiculous is ___',
  ],
  "Something you've never told anyone": [
    "I've secretly always wanted to ___",
    'Nobody knows I used to ___',
    "I've been pretending to like ___ for years",
    'I once got away with ___ and never confessed',
    'I still feel guilty about the time I ___',
    'Something I have never admitted out loud is that I ___',
  ],
  "A place you've lived": [
    'My strangest neighbour once ___',
    'The weirdest thing about living in ___ was ___',
    'I moved to ___ on a complete whim because ___',
    'My most chaotic living situation involved ___',
    'I once had a roommate who ___',
    'Living somewhere for the first time changed how I feel about ___',
  ],
  'An unlikely friendship': [
    'My closest friend and I met because of ___',
    'I became friends with someone I initially disliked over ___',
    'I befriended a complete stranger on ___ and we still talk',
    'My oddest friendship started when we bonded over ___',
    'The person I least expected to like turned out to ___',
    "I'm surprisingly close with someone my friends call ___, which confuses them",
  ],
  'Money or a bad purchase': [
    'I once spent way too much money on ___ and completely regret it',
    'My worst financial decision ever was ___',
    'I impulse-bought ___ at 2am and ___',
    "I still own ___ that I've literally never used",
    'I got scammed into buying ___ once',
    'The most money I have ever blown in one go was on ___',
  ],
};

const GENERAL_TEMPLATES = [
  "One thing I've never admitted is that I ___",
  'People always assume I ___, but it is not actually true',
  'I once got away with ___',
  'My most embarrassing moment ever involved ___',
  'Something I am secretly proud of is ___',
  "I have been pretending to enjoy ___ for years",
  'Something weird happened to me involving ___',
  'I once convinced someone that ___',
];

// ─── Hinglish Templates (keyed by same category names) ───────────────────────
const HINGLISH_TEMPLATES = {
  'Childhood': [
    'Bachpan mein ek baar main ___ karte pakda gaya tha',
    'Main ___ ka bahut bada fan tha growing up mein',
    'Mera sabse bada bachpan ka darr ___ tha',
    'Maine ___ toda aur kisi aur pe blame kar diya',
    'Mera embarrassing bachpan ka nickname ___ tha',
    'Main genuinely believe karta tha ki ___ sach hai, kaafi lambe time tak',
  ],
  'Travel': [
    'Main ek baar ___ mein completely kho gaya tha',
    'Trip pe sabse strange cheez jo maine khayi woh ___ tha',
    'Main ___ gaya hoon but wapas kabhi nahi jaaunga',
    'Ek baar maine flight/bus miss ki ___ ki wajah se',
    'Meri sabse chaotic travel story ___ mein hua tha',
    'Main ___ ekdum whim pe chala gaya tha',
  ],
  'Food': [
    'Main secretly ___ se nafrat karta hoon, chahe sabko pasand ho',
    'Sabse weird cheez jo maine kabhi khayi woh ___ tha',
    'Maine ek haafte se zyada roz ___ khaya tha',
    'Main surprisingly acha ___ bana leta hoon',
    'Mera unpopular food opinion hai ki ___ overrated hai',
    'Mera comfort food jo logo ko surprise karta hai woh ___ hai',
  ],
  'A job or school story': [
    'Maine apne boss ya teacher se ___ ke baare mein jhooth bola tha',
    'Mera sabse embarrassing kaam ya school moment ___ tha',
    'Main ___ karte kaam ya school mein pakda gaya tha',
    'Meri pehli job ___ thi aur main wahan ___ tak raha',
    'Maine galti se ___ ke baare mein message galat insaan ko bhej diya',
    'Maine job ya class ___ ki wajah se chodi ya chorne waala tha',
  ],
  'An embarrassing moment': [
    'Maine ek baar kisi ko wave kiya jo mujhe wave nahi kar raha tha, phir ___',
    'Maine apne ___ ko galat naam se bulaya bilkul galat waqt pe',
    'Main galat ___ pe pahunch gaya aur tabhi pata chala jab ___',
    'Maine ___ ke liye bheja message galat insaan ko bhej diya',
    'Main public mein gira aur sabse bura part yeh tha ki ___',
    'Maine accidentally ___ zor se bol diya jab dimaag mein rakhna tha',
  ],
  'A skill or talent': [
    'Main ___ zyaadatar logon se tez kar sakta hoon',
    'Main chhuppe se kaafi saalo se ___ practice kar raha hoon',
    'Log hamesha shock hote hain jab dekhte hain ki main ___ kar sakta hoon',
    'Maine khud se ___ sirf boredom mein seekha tha',
    'Mera sabse bekar hidden talent ___ hai',
    'Main chhota tha tab ___ mein compete karta tha',
  ],
  'A weird habit or fear': [
    'Mujhe neend nahi aati jab tak ___',
    'Main hamesha ghar se nikalne se pehle ___ karta hoon, chahe der ho jaaye',
    'Mujhe ___ se bewajaah darr lagta hai',
    'Mere paas ___ ke baare mein ek rule hai jo sabko confuse karta hai',
    'Main kuch bhi ho ___ kabhi nahi karunga',
    'Jab bhi main ___ karta hoon, ek specific baar mujhe dobarana karna padta hai',
  ],
  'Family': [
    'Mere family mein ___ ki tradition hai jo aur koi nahi karta',
    'Sabse chaotic family gathering mein ___ hua tha',
    'Bachpan mein ek family rule ___ tha, aur main use hate karta tha',
    'Hamaari family ka unspoken topic jo hum kabhi discuss nahi karte woh ___ hai',
    'Mera family nickname ___ hai aur uske peeche ek poori kahaani hai',
    'Ek cheez jiske baare mein meri family hamesha ladhti hai woh ___ hai',
  ],
  'Firsts (first job, first pet, etc.)': [
    'Meri pehli job ___ thi aur main wahan ___ tak raha',
    'Jab pehli baar maine ___ try kiya, turant pachtaya',
    'Mera pehla pet ___ tha aur usne ___',
    'Jab pehli baar main akele travel kiya, tab maine ___',
    'Mera pehla concert ya bada event ___ tha aur woh ___ tha',
    'Jab pehli baar maine gaadi chalai, maine ___',
  ],
  'A close call or lucky moment': [
    'Main ___ se bach gaya ek pure accident ki wajah se',
    'Pure luck ne meri jaan bachi jab ___',
    'Main accidentally ___ jeeta bina kuch kiye',
    'Main ___ miss karne waala tha ___ ki wajah se',
    'Mujhe us waqt survive nahi karna chahiye tha jab maine ___',
    'Aakhri second mein ___ ne mujhe bacha liya',
  ],
  'Sports or fitness': [
    'Maine ek baar ___ ki training ki lekin ___ ki wajah se chod diya',
    'Mera sabse embarrassing sports wala moment ___ tha',
    'Main surprisingly acha hoon ___ mein, bina practice ke bhi',
    'Maine ek baar ___ mein compete kiya aur ___',
    'Maine ___ karte waqt injury li aur doctor ko explain karna pada',
    'Mera secret fitness ritual jo sunne mein ridiculous lagta hai woh ___ hai',
  ],
  "Something you've never told anyone": [
    'Main chhuppe se hamesha ___ karna chahta tha',
    'Kisi ko nahi pata ki main ___ karta tha',
    'Main kaafi saalo se ___ enjoy karne ka natak kar raha hoon',
    'Maine ek baar ___ kar diya aur kabhi confess nahi kiya',
    'Mujhe abhi bhi guilt hota hai us waqt ka jab maine ___',
    'Ek cheez jo maine kabhi zor se nahi bol ki woh yeh hai ki main ___',
  ],
  "A place you've lived": [
    'Mera ek strange padosi tha jo ek baar ___',
    '___ mein rehne ki sabse weird baat ___ thi',
    'Main ___ mein ek complete whim pe shift ho gaya kyunki ___',
    'Meri sabse chaotic living situation mein ___ tha',
    'Mere ek roommate tha jo ___',
    'Pehli baar kisi jagah rehna mujhe ___ ke baare mein alag feel karatha hai',
  ],
  'An unlikely friendship': [
    'Mera sabse kareeb dost aur main ___ ki wajah se mile the',
    'Maine ek aise insaan se dosti ki jise main pehle pasand nahi karta tha, ___ ki wajah se',
    'Maine ___ pe ek dum stranger se dosti ki aur hum abhi bhi baat karte hain',
    'Meri sabse weird dosti tab shuru hui jab hum ___ ke wajah se bond hue',
    'Jis insaan se mujhe sabse kam umeed thi, woh ___',
    "Main surprisingly karib hoon ___ se jise mere dost ___ bolte hain, jo unhe confuse karta hai",
  ],
  'Money or a bad purchase': [
    'Maine ek baar bahut zyada paisa ___ pe kharch kiya aur bahut pachtaya',
    'Mera sabse bura financial decision ___ tha',
    'Maine raat 2 baje ___ impulse buy kiya aur ___',
    'Mere paas abhi bhi ___ hai jo maine literally kabhi use nahi kiya',
    'Maine ek baar ___ khareedne ke liye scam ho gaya tha',
    'Sabse zyada paisa jo maine ek baar mein udaya woh ___ pe tha',
  ],
};

const HINGLISH_GENERAL_TEMPLATES = [
  'Ek cheez jo maine kabhi admit nahi ki woh yeh hai ki main ___',
  'Log hamesha assume karte hain ki main ___, lekin yeh sach nahi hai',
  'Maine ek baar ___ karke bach gaya',
  'Mera sabse embarrassing moment ___ se related tha',
  'Ek cheez jis pe main secretly proud hoon woh ___ hai',
  'Main kaafi saalo se ___ enjoy karne ka natak kar raha hoon',
  'Mujhe ek baar ek weird situation mein ___ se involve hona pada',
  'Maine ek baar kisi ko convince kiya ki ___',
];

/** Get all templates for a given category and language. */
function _getAllTemplates(category, lang) {
  if (lang === 'hi') {
    const pool = HINGLISH_TEMPLATES[category] ?? [];
    return pool.length >= 3 ? pool : [...pool, ...HINGLISH_GENERAL_TEMPLATES];
  }
  const pool = TEMPLATES[category] ?? [];
  return pool.length >= 3 ? pool : [...pool, ...GENERAL_TEMPLATES];
}

/** Randomly pick 3 templates for the current category (no repeats within the 3). */
function _pickTemplates(category) {
  const pool = (TEMPLATES[category] ?? []).length >= 3
    ? [...(TEMPLATES[category] ?? [])]
    : [...(TEMPLATES[category] ?? []), ...GENERAL_TEMPLATES];
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/** Build the allTemplates payload sent to the client: { en: string[], hi: string[] } */
function _buildAllTemplates(category) {
  return {
    en: _getAllTemplates(category, 'en'),
    hi: _getAllTemplates(category, 'hi'),
  };
}

// ─── In-memory store ──────────────────────────────────────────────────────────
/** @type {Map<string, RoomState>} */
const rooms = new Map();

// Active timers keyed by roomCode (so we can clear them)
const phaseTimers = new Map();     // roomCode → phase setTimeout id
const gracePeriodTimers = new Map(); // `${roomCode}:${playerId}` → setTimeout id

// ─── Room factory ─────────────────────────────────────────────────────────────
function createRoom(hostSocketId, nickname) {
  let code;
  // Ensure uniqueness
  do { code = generateRoomCode(); } while (rooms.has(code));

  const hostId = generatePlayerId();

  /** @type {RoomState} */
  const room = {
    code,
    hostId,
    players: [{
      id: hostId,
      socketId: hostSocketId,
      nickname,
      score: 0,
      connected: true,
      hasBeenSubject: false,
      joinedAt: Date.now(),
    }],
    phase: 'lobby',
    currentSubjectId: null,
    currentCategory: null,   // theme shown during writing phase
    currentTemplates: null,  // 3 fill-in-the-blank templates for this round
    statements: null,   // [{ text, isLie }]
    shuffleMap: null,   // shuffleMap[shuffledIndex] = originalIndex
    votes: {},          // playerId → { voteIndex, confidence: 'sure'|'risky' }
    round: 0,
    maxRounds: 5,
    phaseDeadline: null,
  };

  rooms.set(code, room);
  return { room, playerId: hostId };
}

// ─── Player management ────────────────────────────────────────────────────────
function addPlayer(roomCode, socketId, nickname) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'lobby') return { error: 'Game already in progress. Wait for the next game.' };

  // Prevent duplicate nicknames
  const taken = room.players.some(p => p.nickname.toLowerCase() === nickname.toLowerCase());
  if (taken) return { error: `Nickname "${nickname}" is already taken in this room.` };

  const playerId = generatePlayerId();
  room.players.push({
    id: playerId,
    socketId,
    nickname,
    score: 0,
    connected: true,
    hasBeenSubject: false,
    joinedAt: Date.now(),
  });

  return { playerId };
}

function rejoinPlayer(roomCode, playerId, newSocketId) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found in this room.' };

  // Cancel any pending grace-period cleanup for this player
  const timerKey = `${roomCode}:${playerId}`;
  if (gracePeriodTimers.has(timerKey)) {
    clearTimeout(gracePeriodTimers.get(timerKey));
    gracePeriodTimers.delete(timerKey);
  }

  player.socketId = newSocketId;
  player.connected = true;

  return { player, room };
}

function setMaxRounds(roomCode, maxRounds, requesterId) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can change settings.' };
  if (room.phase !== 'lobby') return { error: 'Can only change settings in the lobby.' };
  const clamped = Math.max(3, Math.min(10, Math.round(maxRounds)));
  room.maxRounds = clamped;
  return { maxRounds: clamped };
}

// ─── Phase: lobby → writing ───────────────────────────────────────────────────
function startGame(roomCode, requesterId, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can start the game.' };
  if (room.phase !== 'lobby') return { error: 'Game already started.' };

  const connected = room.players.filter(p => p.connected);
  if (connected.length < 3) return { error: 'Need at least 3 connected players to start.' };

  room.round = 1;
  _beginWritingPhase(room, io);
  return {};
}

function _pickSubject(room) {
  // Prefer players who haven't been Subject yet; once all have, reset flags
  const connected = room.players.filter(p => p.connected);
  let eligible = connected.filter(p => !p.hasBeenSubject);
  if (eligible.length === 0) {
    // Reset — everyone gets another turn
    room.players.forEach(p => { p.hasBeenSubject = false; });
    eligible = connected.filter(p => !p.hasBeenSubject);
  }
  // Exclude current subject from being picked again immediately
  const nonCurrent = eligible.filter(p => p.id !== room.currentSubjectId);
  return randomFrom(nonCurrent.length > 0 ? nonCurrent : eligible);
}

function _beginWritingPhase(room, io) {
  const subject = _pickSubject(room);
  subject.hasBeenSubject = true;
  room.currentSubjectId = subject.id;
  room.statements = null;
  room.shuffleMap = null;
  room.votes = {};
  room.phase = 'writing';
  room.phaseDeadline = Date.now() + WRITING_TIMEOUT_MS;
  room.currentCategory  = _pickCategory(room.currentCategory);
  room.currentTemplates = _pickTemplates(room.currentCategory);

  io.to(room.code).emit('phase-change', {
    phase: 'writing',
    subjectId: subject.id,
    subjectNickname: subject.nickname,
    deadline: room.phaseDeadline,
    round: room.round,
    maxRounds: room.maxRounds,
    category: room.currentCategory,
    templates: room.currentTemplates,
    allTemplates: _buildAllTemplates(room.currentCategory),
  });

  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'writing') {
      // Subject ran out of time — skip, use placeholder statements
      r.statements = [
        { text: '(Skipped)', isLie: false },
        { text: '(Skipped)', isLie: false },
        { text: '(Skipped)', isLie: true },
      ];
      _beginVotingPhase(r, io);
    }
  }, WRITING_TIMEOUT_MS));
}

// ─── Phase: writing → voting ──────────────────────────────────────────────────
function submitStatements(roomCode, playerId, statements, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'writing') return { error: 'Not in writing phase.' };
  if (room.currentSubjectId !== playerId) return { error: 'You are not the Subject this round.' };
  if (!Array.isArray(statements) || statements.length !== 3) return { error: 'Must submit exactly 3 statements.' };

  const lieCount = statements.filter(s => s.isLie).length;
  if (lieCount !== 1) return { error: 'Exactly one statement must be marked as the lie.' };

  room.statements = statements.map(s => ({
    text: String(s.text).trim(),
    isLie: Boolean(s.isLie),
  }));

  _clearPhaseTimer(room.code);
  _beginVotingPhase(room, io);
  return {};
}

function _beginVotingPhase(room, io) {
  room.phase = 'voting';
  room.phaseDeadline = Date.now() + VOTING_TIMEOUT_MS;

  // Shuffle statements once; store map server-side only
  const { shuffled, shuffleMap } = shuffleWithMap(room.statements);
  room.shuffleMap = shuffleMap; // shuffleMap[shuffledIdx] = originalIdx

  // Broadcast only text + label to non-Subject players (never isLie, never originalIndex)
  const publicStatements = shuffled.map((s, i) => ({ text: s.text, label: LABELS[i] }));

  io.to(room.code).emit('phase-change', {
    phase: 'voting',
    subjectId: room.currentSubjectId,
    subjectNickname: room.players.find(p => p.id === room.currentSubjectId)?.nickname,
    deadline: room.phaseDeadline,
    round: room.round,
    maxRounds: room.maxRounds,
  });

  // Send statements only to non-subject players (subject sees waiting screen)
  room.players.filter(p => p.connected && p.id !== room.currentSubjectId).forEach(p => {
    io.to(p.socketId).emit('statements-ready', { statements: publicStatements });
  });

  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'voting') {
      // Auto-fill missing votes with a random shuffled index (risky = no penalty if wrong)
      r.players.filter(p => p.connected && p.id !== r.currentSubjectId).forEach(p => {
        if (r.votes[p.id] === undefined) {
          r.votes[p.id] = { voteIndex: Math.floor(Math.random() * 3), confidence: 'risky' };
        }
      });
      _beginRevealPhase(r, io);
    }
  }, VOTING_TIMEOUT_MS));
}

// ─── Phase: voting ────────────────────────────────────────────────────────────
function submitVote(roomCode, playerId, voteIndex, confidence, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.phase !== 'voting') return { error: 'Not in voting phase.' };
  if (room.currentSubjectId === playerId) return { error: 'The Subject cannot vote.' };
  if (![0, 1, 2].includes(voteIndex)) return { error: 'Invalid vote index.' };
  if (!['sure', 'risky'].includes(confidence)) return { error: 'Invalid confidence level.' };

  room.votes[playerId] = { voteIndex, confidence };

  // Count eligible voters (connected non-subject)
  const eligible = room.players.filter(p => p.connected && p.id !== room.currentSubjectId);
  const votesIn = eligible.filter(p => room.votes[p.id] !== undefined).length;

  // Broadcast vote progress (count only, no content)
  io.to(room.code).emit('vote-update', { votesIn, totalVoters: eligible.length });

  // Auto-advance if all eligible players have voted
  if (votesIn === eligible.length) {
    _clearPhaseTimer(room.code);
    _beginRevealPhase(room, io);
  }

  return {};
}

// ─── Phase: voting → reveal ───────────────────────────────────────────────────
function _beginRevealPhase(room, io) {
  room.phase = 'reveal';

  // Find the original lie index
  const originalLieIndex = room.statements.findIndex(s => s.isLie);

  // Compute which shuffled index corresponds to the lie
  const shuffledLieIndex = room.shuffleMap.findIndex(origIdx => origIdx === originalLieIndex);

  // Score each voter
  const scoreDelta = {}; // playerId → points earned this round
  const subject = room.players.find(p => p.id === room.currentSubjectId);

  room.players.forEach(p => { scoreDelta[p.id] = 0; });

  let subjectFooledCount = 0;

  Object.entries(room.votes).forEach(([voterId, vote]) => {
    const voter = room.players.find(p => p.id === voterId);
    if (!voter) return;

    const { voteIndex: votedShuffledIndex, confidence } = vote;

    if (votedShuffledIndex === shuffledLieIndex) {
      // Correct — Sure: +2, Risky: +1
      const points = confidence === 'sure' ? 2 : 1;
      voter.score += points;
      scoreDelta[voterId] = (scoreDelta[voterId] || 0) + points;
    } else {
      // Wrong — Sure: -1, Risky: 0
      if (confidence === 'sure') {
        voter.score = Math.max(0, voter.score - 1); // floor at 0
        scoreDelta[voterId] = (scoreDelta[voterId] || 0) - 1;
      }
      subjectFooledCount++; // subject gets fool-point regardless of confidence
    }
  });

  if (subject && subjectFooledCount > 0) {
    subject.score += subjectFooledCount;
    scoreDelta[subject.id] = (scoreDelta[subject.id] || 0) + subjectFooledCount;
  }

  // Build the full shuffled statements list (with isLie revealed for clients)
  const { shuffled } = _applyShuffleMap(room.statements, room.shuffleMap);
  const revealedStatements = shuffled.map((s, i) => ({
    text: s.text,
    label: LABELS[i],
    isLie: s.isLie,
  }));

  io.to(room.code).emit('reveal', {
    statements: revealedStatements,
    shuffledLieIndex,
    votes: room.votes,
    scoreDelta,
    players: _publicPlayers(room),
  });

  // Auto-advance to next round / game-over after REVEAL_AUTO_ADVANCE_MS
  _clearPhaseTimer(room.code);
  phaseTimers.set(room.code, setTimeout(() => {
    const r = rooms.get(room.code);
    if (r && r.phase === 'reveal') {
      _advanceRound(r, io);
    }
  }, REVEAL_AUTO_ADVANCE_MS));
}

/** Helper: reconstruct shuffled order from shuffleMap */
function _applyShuffleMap(statements, shuffleMap) {
  const shuffled = shuffleMap.map(origIdx => statements[origIdx]);
  return { shuffled };
}

// ─── Round rotation ───────────────────────────────────────────────────────────
function _advanceRound(room, io) {
  if (room.round >= room.maxRounds) {
    _beginGameOver(room, io);
  } else {
    room.round++;
    _beginWritingPhase(room, io);
  }
}

// ─── Phase: gameover ─────────────────────────────────────────────────────────
function _beginGameOver(room, io) {
  room.phase = 'gameover';
  io.to(room.code).emit('game-over', { players: _publicPlayers(room) });
}

function resetGame(roomCode, requesterId, io) {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostId !== requesterId) return { error: 'Only the host can reset the game.' };

  room.phase = 'lobby';
  room.round = 0;
  room.currentSubjectId = null;
  room.currentCategory = null;
  room.currentTemplates = null;
  room.statements = null;
  room.shuffleMap = null;
  room.votes = {};
  room.phaseDeadline = null;
  room.players.forEach(p => {
    p.score = 0;
    p.hasBeenSubject = false;
  });

  _clearPhaseTimer(room.code);

  io.to(room.code).emit('phase-change', {
    phase: 'lobby',
    subjectId: null,
    subjectNickname: null,
    deadline: null,
    round: 0,
    maxRounds: room.maxRounds,
  });

  io.to(room.code).emit('player-joined', { players: _publicPlayers(room) });

  return {};
}

// ─── Disconnect / Reconnect ───────────────────────────────────────────────────
function handleDisconnect(socketId, io) {
  // Find which room this socket belongs to
  for (const [code, room] of rooms.entries()) {
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) continue;

    player.connected = false;
    io.to(code).emit('player-left', { players: _publicPlayers(room), disconnectedId: player.id });

    // If subject disconnected during writing — skip immediately
    if (room.phase === 'writing' && room.currentSubjectId === player.id) {
      _clearPhaseTimer(code);
      room.statements = [
        { text: '(Player disconnected)', isLie: false },
        { text: '(Player disconnected)', isLie: false },
        { text: '(Player disconnected)', isLie: true },
      ];
      _beginVotingPhase(room, io);
    }

    // If host disconnected, migrate host
    if (room.hostId === player.id) {
      const nextHost = room.players.find(p => p.connected && p.id !== player.id);
      if (nextHost) {
        room.hostId = nextHost.id;
        io.to(code).emit('host-changed', { newHostId: nextHost.id });
      }
    }

    // Start grace period — if player doesn't reconnect, clean up
    const timerKey = `${code}:${player.id}`;
    if (gracePeriodTimers.has(timerKey)) clearTimeout(gracePeriodTimers.get(timerKey));

    gracePeriodTimers.set(timerKey, setTimeout(() => {
      gracePeriodTimers.delete(timerKey);
      const r = rooms.get(code);
      if (!r) return;

      // Remove the player permanently
      r.players = r.players.filter(p => p.id !== player.id);

      // If room is empty, delete it
      if (r.players.length === 0 || r.players.every(p => !p.connected)) {
        _clearPhaseTimer(code);
        rooms.delete(code);
        return;
      }

      io.to(code).emit('player-left', { players: _publicPlayers(r), disconnectedId: player.id });
    }, GRACE_PERIOD_MS));

    break;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _clearPhaseTimer(roomCode) {
  if (phaseTimers.has(roomCode)) {
    clearTimeout(phaseTimers.get(roomCode));
    phaseTimers.delete(roomCode);
  }
}

/** Strip server-only fields (socketId, etc.) before sending to clients */
function _publicPlayers(room) {
  return room.players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    connected: p.connected,
  }));
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function getRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

module.exports = {
  createRoom,
  addPlayer,
  rejoinPlayer,
  setMaxRounds,
  startGame,
  submitStatements,
  submitVote,
  advanceRound(roomCode, requesterId, io) {
    const room = rooms.get(roomCode);
    if (!room) return { error: 'Room not found.' };
    if (room.hostId !== requesterId) return { error: 'Only the host can advance the round.' };
    if (room.phase !== 'reveal') return { error: 'Not in reveal phase.' };
    _clearPhaseTimer(room.code);
    _advanceRound(room, io);
    return {};
  },
  resetGame,
  handleDisconnect,
  getRoom,
  getRoomBySocketId,
  _publicPlayers,
  _getAllTemplates,
};
