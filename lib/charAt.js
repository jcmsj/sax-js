/**
 * @param {string} chunk
 * @param {Number} i
 * @returns {string}
 */
export function charAt(chunk, i) {
  return i < chunk.length ? chunk.charAt(i) : '';
}
