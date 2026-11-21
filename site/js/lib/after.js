// After the event: what a treasurer counted, set beside what the answers said
// would happen. A survey records what people say, and the only check on it
// is who turns up, so this is where a club finds out how far to trust its
// own numbers next time.
//
// What is compared is the share of those who came that took the lower
// price. Turnout itself moves for reasons that have nothing to do with the
// price (the date, the weather), and a share is less thrown by that than a
// head count is. The money is compared with what the one price took before,
// when the treasurer has that figure.
import { waysToPrice } from "./curve.js";
import { money, pct } from "./format.js";
import { voice } from "./voice.js";

const counted = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

// Whose answers the "said" side comes from, to start a sentence with.
function whoseAnswers(meta) {
  const say = voice(meta);
  if (say.simulated) return `The ${say.many}' answers`;
  return meta.loaded ? "Your members' answers" : "The answers";
}

function compared(now, before, { more, fewer, same }) {
  if (now > before) return more(now - before);
  if (now < before) return fewer(before - now);
  return same;
}

// `view` is what the page is set to: {itemId, price, size}. `counts` is what
// was counted: `full` paid the full price, `low` took the lower one, and
// `before` paid when there was one price. Each is a whole number, or null
// when it has not been filled in.
//
// Returns {offered: false} where the page works out no second price at this
// view, so there is nothing to check. Otherwise {offered, price, lower,
// whose, said, lines}. `said` is what the answers gave, and `lines` are
// sentences, empty until `full` and `low` are both in and someone came.
export function afterEvent(dataset, { itemId, price, size }, counts = {}) {
  const { items, rows, meta } = dataset;
  const item = items.find((candidate) => candidate.id === itemId);
  const ways = waysToPrice(rows, item, price, size);
  const two = ways?.find((way) => way.kind === "two");
  if (!two) return { offered: false };

  const [now] = ways;
  const lower = two.accessPrice;
  const saidLow = two.there - now.there;
  const said = { full: now.there, low: saidLow, there: two.there, share: saidLow / two.there };
  const whose = whoseAnswers(meta);
  const result = { offered: true, price, lower, whose, said, lines: [] };

  const full = counted(counts.full);
  const low = counted(counts.low);
  const before = counted(counts.before);
  if (full === null || low === null || full + low === 0) return result;

  const came = full + low;
  const share = low / came;
  const lowWords = lower === 0 ? "for free" : `at ${money(lower)}`;
  result.lines.push({ key: "came", text: `${came} came: ${full} at ${money(price)} and ${low} ${lowWords}.` });
  result.lines.push({
    key: "share",
    text: `${whose} said about ${said.low} of every ${said.there} who come would take the lower price, which is ${pct(said.share)}. At your event it was ${low} of ${came}, which is ${pct(share)}.`,
  });

  // The two shares are compared as they are written, in whole percents, so
  // the sentence never contradicts the figures beside it.
  const reading = compared(Math.round(share * 100), Math.round(said.share * 100), {
    more: () => "More took the lower price than the answers said. Either more needed it than said so, or some who could pay in full took it.",
    fewer: () => "Fewer took the lower price than the answers said. Either fewer needed it, or the offer did not reach those who did. How it was offered is the thing to look at.",
    same: "That is the share the answers gave.",
  });
  result.lines.push({ key: "reading", text: reading });

  const took = full * price + low * lower;
  if (before === null) {
    result.lines.push({ key: "money", text: `The club took in ${money(took)}.` });
  } else {
    const was = before * price;
    const turnout = compared(came, before, {
      more: (by) => `${by} more came`,
      fewer: (by) => `${by} fewer came`,
      same: "as many came",
    });
    const takings = compared(took, was, {
      more: (by) => `${money(by)} more`,
      fewer: (by) => `${money(by)} less`,
      same: "the same",
    });
    result.lines.push({
      key: "money",
      text: `Before, ${before} paid ${money(price)}, which is ${money(was)}. This time ${turnout} and the club took in ${money(took)}, ${takings}.`,
    });
  }
  return result;
}
