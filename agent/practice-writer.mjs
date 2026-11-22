// The writer behind `--practice`. An AI model plays Flashpoint's survey agent
// AND invents the people who answer, so a whole mission can be rehearsed for
// free: no Flashpoint credit, no emails, no real answers.
//
// Everything it writes is made up. The run log says so at the top and on every
// reply, and practice runs are kept out of the repository.
//
//   ask(system, prompt) -> the model's text

export const PRACTICE_TAG = "[PRACTICE FLASHPOINT: an AI stand-in wrote this reply and invented the answers. Not Flashpoint, not people.]";

const SURVEY_AGENT = "You are standing in for Flashpoint's survey agent in a practice run. Reply the way a careful survey platform would: brief, concrete, no chit-chat. Plain text with simple markdown tables where they help. Never mention that you are an AI model or that this is practice; the caller adds that label.";

export function practiceWriter({ ask }) {
  const drafts = {}; // survey number -> the survey as written
  const answers = {}; // survey number -> each invented respondent's answers
  const rehearsals = {}; // survey number -> each persona's answers
  let cast = ""; // the invented respondents, the same people in every round
  let mission = "";

  async function ensureCast(people, brief) {
    if (cast !== "") return;
    mission = brief;
    cast = await ask(
      "You invent realistic survey respondents for a practice run. Output only the list.",
      `A club is about to survey ${people || 3} of its members. The first survey brief is below. Invent exactly ${people || 3} members as a numbered list. Give each a first name, their year, how involved they are, how tight money is for them, and one private opinion that bears on the brief and that they would only reveal if asked the right question. Make them differ from each other, and make at least one of them hold a view the survey writer would not expect.\n\nBrief:\n${brief}`,
    );
  }

  return {
    async draft({ survey, people, brief }) {
      await ensureCast(people, brief);
      drafts[survey] = await ask(
        SURVEY_AGENT,
        `Build survey ${survey} from this brief. Reply with: one line saying the panel has ${people || "the listed"} members; then every question as built, in a table with label, type, text and answer options; then one line on validation (0 blockers). Keep to what the brief asks. Do not add screening or skip rules. Do not include any email address.\n\nBrief:\n${brief}`,
      );
      return `Drafted survey ${survey}.\n\n${drafts[survey]}`;
    },

    async change({ survey, request }) {
      drafts[survey] = await ask(SURVEY_AGENT, `Here is survey ${survey} as built:\n\n${drafts[survey]}\n\nThe researcher asks:\n${request}\n\nIf this asks for a change, make it and reply with one line on what changed, then the full table of questions as they now stand. If it only asks a question, answer it from the survey and then show the table unchanged.`);
      return drafts[survey];
    },

    async send({ survey, people }) {
      answers[survey] = await ask(
        "You play several survey respondents in a practice run. Answer every question as each person honestly would, in character. Output only the answers.",
        `The respondents:\n${cast}\n\nThey each received this survey:\n${drafts[survey]}\n\nWrite each person's answer to every question, by question label. Closed questions: pick from the options given. Open questions: one or two sentences in their own voice. They answer honestly, and their answers do not have to agree with each other or with what the survey writer hoped. ${people || 3} respondents, all answer.`,
      );
    },

    async results({ survey, request }) {
      return ask(SURVEY_AGENT, `Survey ${survey}:\n${drafts[survey]}\n\nEvery response received so far, by respondent:\n${answers[survey]}\n\nThe researcher asks:\n${request}\n\nAnswer from the responses only. Give how many answered, then exact counts per answer option for each closed question, then the open answers quoted in full. Do not name the respondents: call them Respondent 1, 2, 3. Do not invent anything that is not in the responses.`);
    },

    async rehearse({ survey, howMany, audience }) {
      rehearsals[survey] = await ask(
        "You play AI personas taking a survey in a rehearsal. Output only the answers.",
        `Invent ${howMany} AI personas for this audience: ${audience}\n\nThe mission behind the survey: ${mission}\n\nThey take this survey:\n${drafts[survey]}\n\nWrite each persona's answer to every question, by question label. Synthetic personas tend to be more agreeable and more willing to pay than real people, so let that show. If a question is ambiguous, double-barrelled or hard to answer, have two or three personas say so in an open answer or pick inconsistently.`,
      );
    },

    async rehearsalResults({ survey, howMany, request }) {
      return ask(SURVEY_AGENT, `Survey ${survey}:\n${drafts[survey]}\n\nA synthetic rehearsal ran ${howMany} AI personas through it. Their answers:\n${rehearsals[survey]}\n\nThe researcher asks:\n${request}\n\nStart with the line "SYNTHETIC rehearsal of survey ${survey}: ${howMany} of ${howMany} AI personas finished, none was cut off. These are AI personas, not people." Then give exact counts per answer option for each closed question, the themes in the open answers, and any question the personas found unclear.`);
    },
  };
}
