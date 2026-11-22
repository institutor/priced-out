// The agent's notebook. At the end of a mission it writes down one to three
// lessons about method. At the start of the next it gets the latest ones back.
// Real missions and practice missions keep separate notebooks, so nothing
// learned from invented answers is ever read as experience with real people.
import fs from "node:fs";

const fileOf = (mode) => new URL(`memory/${mode === "real" ? "lessons" : "practice-lessons"}.md`, import.meta.url);
const KEPT = 8;

// The newest lessons, oldest first.
export function lessonsIn(text, most = KEPT) {
  return text.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim()).filter(Boolean).slice(-most);
}

export function readLessons(mode, file = fileOf(mode)) {
  return fs.existsSync(file) ? lessonsIn(fs.readFileSync(file, "utf8")) : [];
}

export function lessonEntry({ stamp, objective, lessons }) {
  return `\n## ${stamp}\n\nObjective: ${objective}\n\n${lessons.map((lesson) => `- ${lesson.replace(/\s+/g, " ")}`).join("\n")}\n`;
}

export function writeLessons(mode, entry, file = fileOf(mode)) {
  fs.mkdirSync(new URL("./", file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, mode === "real"
      ? "# What the agent has learned\n\nThe agent writes these itself at the end of each real run, and reads the latest ones at the start of the next. Names and addresses are removed.\n"
      : "# Practice notebook\n\nLessons from practice runs, where every answer was invented. They are kept apart from the real notebook.\n");
  }
  fs.appendFileSync(file, lessonEntry(entry));
}
