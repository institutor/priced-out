// What the page calls the people behind the numbers.
//
// When the answers come from Flashpoint's AI personas, every phrase carries
// the word "simulated", so no sentence on the page can pass for a finding
// about real students. Sample data built for development uses the plain
// words: the banner says what it is, and it never ships as a result.

const STUDENTS = {
  simulated: false,
  many: "students",
  nobody: "nobody surveyed",
  Nobody: "Nobody surveyed",
  surveyed: "surveyed",
  asked: "We asked",
  shown: "We showed students",
  lead: "",
  range: (low, high) => `With a sample this size the true figure could be anywhere from ${low} to ${high}.`,
};

const SIMULATED = {
  simulated: true,
  many: "simulated students",
  nobody: "none of the simulated students",
  Nobody: "None of the simulated students",
  surveyed: "of the simulated students",
  asked: "The simulated students were asked",
  shown: "The simulated students were shown",
  lead: "Going by the simulated students, ",
  range: (low, high) =>
    `A simulated panel this size moves from ${low} to ${high} by chance alone. That range says nothing about how close it is to real students.`,
};

// The made-up club that shows how a club's own file loads. Its numbers stay
// on a public page for as long as someone leaves them there, so every phrase
// says they were made up.
const MADE_UP = {
  simulated: true,
  many: "made-up members",
  nobody: "none of the made-up members",
  Nobody: "None of the made-up members",
  surveyed: "of the made-up members",
  asked: "The made-up members were asked",
  shown: "The made-up members were shown",
  lead: "Going by the made-up club, ",
  range: (low, high) => `A made-up club this size moves from ${low} to ${high} by chance alone.`,
};

// A club's own members, read from its own file.
const MEMBERS = {
  ...STUDENTS,
  many: "members",
  nobody: "none of the members who answered",
  Nobody: "None of the members who answered",
  surveyed: "of the members who answered",
  asked: "Members were asked",
  shown: "Members were shown",
};

export function voice(meta) {
  if (meta.loaded?.example) return MADE_UP;
  if (meta.kind === "simulated") return SIMULATED;
  return meta.loaded ? MEMBERS : STUDENTS;
}
