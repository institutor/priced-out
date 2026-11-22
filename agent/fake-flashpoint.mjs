// A stand-in for Flashpoint, used by `--fake`, `--practice` and the tests. It
// sends nothing, emails nobody and costs nothing. Every reply says it is fake.
//
// It follows the same steps the real survey agent does: draft, "confirm" to
// publish, "confirm" to send, then results. The steps are fixed code. The
// words come from a writer:
//   - the canned writer below (used by --fake and the tests) does not understand
//     the questions, so its "results" are the same vague lines every time;
//   - practice-writer.mjs (used by --practice) has an AI model invent the survey
//     text and the answers, so a whole mission can be rehearsed.

export const FAKE_TAG = "[FAKE FLASHPOINT: practice reply, no real survey or answers]";

const cannedWriter = {
  draft: async ({ survey, people }) => `Panel has ${people || "the listed"} members. Drafted survey ${survey} from your brief, with the questions as you described them and no skip rules.`,
  change: async ({ survey }) => `Changed survey ${survey} as you asked.`,
  send: async () => {},
  results: async ({ survey }) => (survey === 1
    ? "Survey 1: 3 of 3 answered.\nThe closed questions split two ways: 2 picked the lower option, 1 picked the higher one.\nOpen answers: two mention cost, one mentions timing."
    : `Survey ${survey}: 3 of 3 answered.\nAll 3 picked the same option on the main follow-up question.\nOpen answers: all three give the same reason.`),
  rehearse: async () => {},
  rehearsalResults: async ({ survey, howMany }) => `SYNTHETIC rehearsal of survey ${survey}: ${howMany} of ${howMany} AI personas finished, none was cut off.\nOn the main closed question most personas picked the middle option.\nOne open question drew several answers that say they were unsure what it meant.\nThese are AI personas, not people.`,
};

export function fakeFlashpoint({ rehearsalFails = false, writer = cannedWriter, tag = FAKE_TAG } = {}) {
  let survey = 0;
  let waiting = null; // "publish" or "send": what a bare "confirm" would do next
  let published = false;
  let sent = false;
  let rehearsed = 0; // how many personas took the current survey
  let people = 0;
  const say = (text) => ({ text: `${tag}\n${text}` });
  // The writer may be an AI model, so it never gets an address.
  const noEmails = (text) => text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");

  async function ask({ message: raw, newSurvey }) {
    const text = raw.trim().toLowerCase();
    const listed = (raw.match(/<[^>]+@[^>]+>/g) ?? []).length;
    if (listed > 0) people = listed;
    const message = noEmails(raw);

    if (newSurvey || survey === 0) {
      survey += 1;
      waiting = "publish";
      published = false;
      sent = false;
      rehearsed = 0;
      return say(`${await writer.draft({ survey, people, brief: message })}\nIt is not published. Reply confirm to publish it.`);
    }

    if (/^\W*confirm\W*$/.test(text)) {
      if (waiting === "publish") {
        waiting = "send";
        published = true;
        return say(`Survey ${survey} is published. It is ready to email to the panel. Reply confirm to send it. Sending cannot be undone.`);
      }
      if (waiting === "send") {
        waiting = null;
        sent = true;
        await writer.send({ survey, people });
        return say(`Survey ${survey} was emailed to every panel member who can receive it.`);
      }
      return say("There is nothing waiting for a confirm.");
    }

    if (rehearsed > 0 && /persona|synthetic|rehears/.test(text)) return say(await writer.rehearsalResults({ survey, howMany: rehearsed, request: message }));
    if (sent) return say(await writer.results({ survey, people, request: message }));

    if (/\b(send|email)\b/.test(text) && published) {
      waiting = "send";
      return say(`Survey ${survey} is ready to email to the panel. Reply confirm to send it. Sending cannot be undone.`);
    }
    if (/\bpublish\b/.test(text) && !published) {
      waiting = "publish";
      return say(`Publishing survey ${survey} makes it live. Reply confirm to publish it.`);
    }
    if (!published) {
      waiting = "publish";
      return say(`${await writer.change({ survey, request: message })}\nIt is not published. Reply confirm to publish it.`);
    }
    return say(`Survey ${survey} is published and has not been sent. Nothing was changed.`);
  }

  async function rehearse({ howMany, audience }) {
    if (survey === 0) throw new Error("There is no survey to rehearse.");
    if (rehearsalFails) throw new Error("The persona run was interrupted before any persona finished.");
    rehearsed = howMany;
    await writer.rehearse({ survey, howMany, audience });
    return say(`SYNTHETIC rehearsal: ${howMany} AI personas took survey ${survey}. ${howMany} of ${howMany} finished and none was cut off. Ask the survey agent for the rehearsal results to see what they answered.`);
  }

  async function deck({ title }) {
    return say(`A practice run makes no deck. A real run would return a link to "${title}".`);
  }

  return { survey: ask, rehearse, deck };
}
