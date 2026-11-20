// "I will if you will": would members' own pledges cover the people a price
// leaves out?
//
// Each pledge is [amount, threshold]. The amount is what the respondent would
// add to their own ticket (0 means no). The threshold is how many others must
// do the same first: 0 means "I would do it anyway", and "most" means most of
// the club.

// Scales the surveyed answers to a club with `payers` paying members and lets
// the pledges cascade: people who give regardless go first, and each round
// anyone whose threshold is now met joins, until nobody new does.
export function cascade(pledges, payers) {
  const answered = pledges.length;
  if (answered === 0 || payers <= 0) return { answered, steps: [], pledgers: 0, pool: 0 };

  const groups = new Map();
  for (const [amount, threshold] of pledges) {
    if (!(amount > 0)) continue;
    const group = groups.get(threshold) ?? { count: 0, total: 0 };
    group.count += 1;
    group.total += amount;
    groups.set(threshold, group);
  }

  const isMet = (threshold, pledgers) => (threshold === "most" ? pledgers > payers / 2 : pledgers >= threshold);
  const tally = (pledgers) => {
    let count = 0;
    let total = 0;
    for (const [threshold, group] of groups) {
      if (!isMet(threshold, pledgers)) continue;
      count += group.count;
      total += group.total;
    }
    return { count, total };
  };

  let current = tally(0);
  let pledgers = (payers * current.count) / answered;
  const steps = [Math.round(pledgers)];
  for (let round = 0; round < groups.size; round++) {
    const next = tally(pledgers);
    const nextPledgers = (payers * next.count) / answered;
    if (nextPledgers <= pledgers) break;
    current = next;
    pledgers = nextPledgers;
    steps.push(Math.round(pledgers));
  }
  return { answered, steps, pledgers: Math.round(pledgers), pool: (payers * current.total) / answered };
}

export function seatsCovered(pool, price) {
  if (!(price > 0)) return 0;
  return Math.floor(pool / price);
}
