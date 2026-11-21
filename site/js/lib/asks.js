// The survey ranks the ways of offering a lower price from the member's side:
// which one would they use. This is the club's side: what each way takes to
// run, and what can go wrong with it. None of it comes from the survey, and
// the page says so where it shows these.
const ASKS = {
  open: {
    run: "Make one code and send it in the same message as the price.",
    snag: "Anyone can use it, including members who could pay in full. Each one who does costs the club the difference between the two prices.",
  },
  sliding: {
    run: "Put two or three prices on the form and let each member pick one in private.",
    snag: "Some who could pay more will pick the lowest price. Each one who does costs the club the difference between the prices.",
  },
  forward: {
    run: "Add a way to pay extra, and tell members how many covered tickets there are.",
    snag: "It covers only as many seats as members pay for. The next part works out how far members' pledges go.",
  },
  pwyc: {
    run: "Let each member type in what they will pay.",
    snag: "You cannot tell ahead how much will come in, which makes it hard to book anything on it.",
  },
  draw: {
    run: "Give every buyer a discount picked at random.",
    snag: "Luck decides who pays less, not need. The member who needed it most may get the least.",
  },
  request: {
    run: "Make a code. A member messages you, and you send it to them.",
    snag: "The member has to ask, and you find out who did. The published work further down found few people ask.",
  },
};

// The fixes in the order given, each with what it asks of the club. A fix
// this file does not know is left out.
export function asksFor(fixes) {
  return (fixes ?? [])
    .filter((fix) => Object.hasOwn(ASKS, fix.id))
    .map((fix) => ({ id: fix.id, label: fix.label, ...ASKS[fix.id] }));
}
