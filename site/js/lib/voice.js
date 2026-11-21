// What the page calls the people behind the numbers.
//
// When the answers come from Flashpoint's AI personas, every phrase carries
// the word "simulated", so no sentence on the page can pass for a finding
// about real students. Sample data uses the plain words: the banner says what
// it is, and it never ships as a result.

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

export function voice(meta) {
  return meta.kind === "simulated" ? SIMULATED : STUDENTS;
}
