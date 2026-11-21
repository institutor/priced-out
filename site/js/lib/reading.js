// Which part of the page is being read. `tops` are how far the top of each
// part is from the top of the screen, in page order. The part being read is
// the last one whose top has passed `line`. Before the first, there is none,
// and the answer is -1.
export function partBeingRead(tops, line) {
  let found = -1;
  tops.forEach((top, index) => {
    if (top <= line) found = index;
  });
  return found;
}
