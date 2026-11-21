// What it would take: the price that keeps nearly everyone in, what an
// access price would bring back, and the same thing priced each way side by
// side, with who comes and what the club takes in.
import { el, sentence } from "./dom.js";
import { circled, marked, wipe } from "./ink.js";
import { sharesAt, maxPriceFor, accessTier, waysToPrice } from "../lib/curve.js";
import { money, people, phrase } from "../lib/format.js";
import { voice } from "../lib/voice.js";

const ACCESS_TARGET = 0.05;
const GENTLE_TARGET = 0.1;
const COUNT = ["", "", "two", "three"];

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;
  const say = voice(dataset.meta);

  // Each figure is circled, the way a number that matters gets circled.
  const statement = (name, figure, ...text) =>
    el("div", { class: "statement" }, circled(el("span", { class: "figure", text: figure }), name), el("p", {}, text));

  // The access price is the highest price that loses no more than 1 in 20.
  // There are four different things to say about it, and only one of them is
  // good news, so each case gets its own sentence.
  function accessStatement(item, price, size) {
    const accessPrice = maxPriceFor(rows, item, ACCESS_TARGET);
    if (accessPrice === null) {
      return statement("access", "No price", `gets everyone in. Even free, more than 1 in 20 said they would skip a ${phrase(item)}, so for them the price is not the only thing in the way.`);
    }
    if (accessPrice >= price) {
      return statement("access", "No gap", `to close here. At ${money(price)} no more than 1 in 20 ${say.surveyed} are left out.`);
    }
    const tier = accessTier(rows, item, price, ACCESS_TARGET);
    const back = tier ? people(tier.regained, size) : 0;
    if (back === 0) {
      return statement("access", money(accessPrice), `is the access price, but in a club of ${size} the difference from ${money(price)} comes to less than one person.`);
    }
    if (accessPrice === 0) {
      return statement("access", "Free", sentence(
        `is the only price at which no more than 1 in 20 skip it. Waiving the ${money(price)} for those who need it brings back about `,
        [back], ` of your ${size}, and costs the club nothing it was getting.`,
      ));
    }
    return statement("access", money(accessPrice), sentence(
      "as an access price brings back about ", [back], ` of your ${size}. At ${money(price)} they were paying nothing, so that is about `,
      [money(back * accessPrice)], " more for the club, not less.",
    ));
  }

  // The treasurer's real choice, on one small table: leave the price alone,
  // lower it for everyone, or keep it and add a second price. The most
  // people and the most money are each marked with the highlighter.
  function waysBlock(item, price, size) {
    const ways = waysToPrice(rows, item, price, size, { gentle: GENTLE_TARGET, access: ACCESS_TARGET });
    if (!ways || ways.length < 2) return null;
    const [now] = ways;
    const lower = ways.find((way) => way.kind === "lower");
    const two = ways.find((way) => way.kind === "two");

    const name = (way) => {
      if (way.kind !== "two") return `${money(way.price)} for everyone`;
      return `${money(way.price)}, or ${way.accessPrice === 0 ? "free" : money(way.accessPrice)} for those who need it`;
    };
    const most = (key) => Math.max(...ways.map((way) => way[key]));
    const cell = (way, key, text) => {
      const value = el("span", { text });
      return el("td", {}, way[key] === most(key) ? marked(value, `ways ${key}`) : value);
    };

    const reading = [];
    if (lower) {
      const more = lower.there - now.there;
      const change = lower.taken - now.taken;
      let money_ = "takes in the same money";
      if (change < 0) money_ = `takes in ${money(-change)} less`;
      if (change > 0) money_ = `takes in ${money(change)} more`;
      reading.push(`One lower price for everyone brings ${more} more of your ${size} and ${money_}.`);
    }
    if (two) {
      const more = two.there - now.there;
      const change = two.taken - now.taken;
      const money_ = change > 0 ? `take in ${money(change)} more` : "cost the club nothing it was getting";
      reading.push(`Two prices bring ${more} more and ${money_}, as long as those who can pay the full price still do.`);
    }

    const intro = `here is what each way of pricing it would do in a club of ${size}.`;
    return el("div", { class: "ways" },
      el("h3", { class: "sub", text: `The same ${phrase(item)}, priced ${COUNT[ways.length]} ways` }),
      el("p", { text: say.lead ? `${say.lead}${intro}` : `H${intro.slice(1)}` }),
      el("table", { class: "ways-table" },
        el("thead", {}, el("tr", {},
          el("th", { scope: "col", text: "The price" }),
          el("th", { scope: "col", text: "Who comes" }),
          el("th", { scope: "col", text: "Money in" }),
        )),
        el("tbody", {}, ways.map((way) => el("tr", {},
          el("th", { scope: "row", text: name(way) }),
          cell(way, "there", `${way.there} of ${size}`),
          cell(way, "taken", money(way.taken)),
        ))),
      ),
      el("p", { class: "ways-read", text: reading.join(" ") }),
    );
  }

  function render({ itemId, price, size }) {
    wipe(root);
    const item = items.find((candidate) => candidate.id === itemId);
    const shares = sharesAt(rows, item, price);
    if (shares.n < rules.minCell) {
      root.append(el("p", { class: "empty", text: "Not enough answers for this item yet." }));
      return;
    }

    const gentle = maxPriceFor(rows, item, GENTLE_TARGET);
    let gentleStatement = statement("gentle", "No price", `keeps 9 in 10. Even free, more than 1 in 10 said they would skip a ${phrase(item)}.`);
    if (gentle !== null) {
      const where = gentle >= price ? `At ${money(price)} you are inside that.` : `You are at ${money(price)}.`;
      gentleStatement = statement("gentle", money(gentle), `is the most a ${phrase(item)} can cost and still lose no more than 1 in 10. ${where}`);
    }

    root.append(
      el("div", { class: "statements" }, gentleStatement, accessStatement(item, price, size)),
      waysBlock(item, price, size),
      el("p", {
        class: "aside",
        text: `${say.simulated ? `Every figure here is worked out from the ${say.many}. ` : ""}The access price is the highest price that loses no more than 1 in 20. The sums assume people who can pay the full price still do. Whether they would depends on how the lower price is offered, which is the next question.`,
      }),
    );
  }

  state.subscribe(render);
  render(state.get());
}
