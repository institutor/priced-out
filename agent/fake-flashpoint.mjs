// A stand-in for Flashpoint, used by `--fake` and by the tests. It sends
// nothing, emails nobody and costs nothing. Its replies are made up so the
// agent's loop can be practised without spending credit. Every reply says so.
//
// It follows the same steps the real survey agent does: draft, "confirm" to
// publish, "confirm" to send, then results. It does not understand the
// questions, so its "results" are the same vague lines every time.

const TAG = "[FAKE FLASHPOINT: practice reply, no real survey or answers]";

export function fakeFlashpoint({ rehearsalFails = false } = {}) {
  let survey = 0;
  let waiting = null; // "publish" or "send": what a bare "confirm" would do next
  let published = false;
  let sent = false;
  let rehearsed = 0; // how many personas took the current survey

  function draftNew(people) {
    survey += 1;
    waiting = "publish";
    published = false;
    sent = false;
    rehearsed = 0;
    return { text: `${TAG}\nPanel has ${people || "the listed"} members. Drafted survey ${survey} from your brief, with the questions as you described them and no skip rules. It is not published. Reply confirm to publish it.` };
  }

  async function ask({ message, newSurvey }) {
    const text = message.trim().toLowerCase();
    const people = (message.match(/<[^>]+@[^>]+>/g) ?? []).length;

    if (newSurvey || survey === 0) return draftNew(people);

    if (/^\W*confirm\W*$/.test(text)) {
      if (waiting === "publish") {
        waiting = "send";
        published = true;
        return { text: `${TAG}\nSurvey ${survey} is published. It is ready to email to the panel. Reply confirm to send it. Sending cannot be undone.` };
      }
      if (waiting === "send") {
        waiting = null;
        sent = true;
        return { text: `${TAG}\nSurvey ${survey} was emailed to every panel member who can receive it.` };
      }
      return { text: `${TAG}\nThere is nothing waiting for a confirm.` };
    }

    if (rehearsed > 0 && /persona|synthetic|rehears/.test(text)) {
      return { text: `${TAG}\nSYNTHETIC rehearsal of survey ${survey}: ${rehearsed} of ${rehearsed} AI personas finished, none was cut off.\nOn the main closed question most personas picked the middle option.\nOne open question drew several answers that say they were unsure what it meant.\nThese are AI personas, not people.` };
    }

    if (sent) {
      if (survey === 1) {
        return { text: `${TAG}\nSurvey 1: 3 of 3 answered.\nThe closed questions split two ways: 2 picked the lower option, 1 picked the higher one.\nOpen answers: two mention cost, one mentions timing.` };
      }
      return { text: `${TAG}\nSurvey ${survey}: 3 of 3 answered.\nAll 3 picked the same option on the main follow-up question.\nOpen answers: all three give the same reason.` };
    }

    if (/\b(send|email)\b/.test(text) && published) {
      waiting = "send";
      return { text: `${TAG}\nSurvey ${survey} is ready to email to the panel. Reply confirm to send it. Sending cannot be undone.` };
    }
    if (/\bpublish\b/.test(text) && !published) {
      waiting = "publish";
      return { text: `${TAG}\nPublishing survey ${survey} makes it live. Reply confirm to publish it.` };
    }
    if (!published) {
      waiting = "publish";
      return { text: `${TAG}\nChanged survey ${survey} as you asked. It is not published. Reply confirm to publish it.` };
    }
    return { text: `${TAG}\nSurvey ${survey} is published and has not been sent. Nothing was changed.` };
  }

  async function rehearse({ howMany }) {
    if (survey === 0) throw new Error("There is no survey to rehearse.");
    if (rehearsalFails) throw new Error("The persona run was interrupted before any persona finished.");
    rehearsed = howMany;
    return { text: `${TAG}\nSYNTHETIC rehearsal: ${howMany} AI personas took survey ${survey}. ${howMany} of ${howMany} finished and none was cut off. Ask the survey agent for the rehearsal results to see what they answered.` };
  }

  async function deck({ title }) {
    return { text: `${TAG}\nA practice run makes no deck. A real run would return a link to "${title}".` };
  }

  return { survey: ask, rehearse, deck };
}
