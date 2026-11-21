// A stand-in for Flashpoint, used by `--fake` and by the tests. It sends
// nothing, emails nobody and costs nothing. Its replies are made up so the
// agent's loop can be practised without spending credit. Every reply says so.

const TAG = "[FAKE FLASHPOINT: practice reply, no real survey or answers]";

export function fakeFlashpoint() {
  let survey = 0;
  let waiting = null; // "publish" or "send"
  let sent = false;

  return async function flashpoint({ message, newSurvey }) {
    const text = message.trim().toLowerCase();
    const people = (message.match(/<[^>]+@[^>]+>/g) ?? []).length;

    if (/^confirm\W*$/.test(text)) {
      if (waiting === "publish") {
        waiting = "send";
        return { text: `${TAG}\nSurvey ${survey} is published. It is ready to email to the panel. Reply confirm to send it. Sending cannot be undone.` };
      }
      if (waiting === "send") {
        waiting = null;
        sent = true;
        return { text: `${TAG}\nSurvey ${survey} was emailed to every panel member who can receive it.` };
      }
      return { text: `${TAG}\nThere is nothing waiting for a confirm.` };
    }

    if (sent && /result|respon|answer|repl/.test(text) && !newSurvey && !/write|draft|new survey|follow-up survey/.test(text)) {
      if (survey === 1) {
        return { text: `${TAG}\nSurvey 1: 3 of 3 answered.\nThe closed questions split two ways: 2 picked the lower option, 1 picked the higher one.\nOpen answers: two mention cost, one mentions timing.` };
      }
      return { text: `${TAG}\nSurvey ${survey}: 3 of 3 answered.\nAll 3 picked the same option on the main follow-up question.\nOpen answers: all three give the same reason.` };
    }

    survey += 1;
    waiting = "publish";
    sent = false;
    return { text: `${TAG}\nPanel has ${people || "the listed"} members. Drafted survey ${survey} from your brief, with the questions as you described them. Reply confirm to publish it.` };
  };
}
