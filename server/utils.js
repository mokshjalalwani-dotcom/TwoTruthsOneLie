const { v4: uuidv4 } = require('uuid');

/**
 * Generates a random 5-character alphanumeric room code (uppercase).
 * Excludes visually ambiguous characters (0, O, I, 1).
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generates a unique player ID.
 */
function generatePlayerId() {
  return uuidv4();
}

/**
 * Shuffles an array in-place using Fisher-Yates and returns it.
 * Also returns the permutation map: permutation[newIndex] = originalIndex
 */
function shuffleWithMap(arr) {
  const indices = arr.map((_, i) => i);
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // indices[newIndex] = originalIndex
  return { shuffled, shuffleMap: indices };
}

/**
 * Picks a random element from an array.
 */
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { generateRoomCode, generatePlayerId, shuffleWithMap, randomFrom };
