// Pure village transactions. UI and timers never mutate resource balances directly.
let data = {
  buildings: [],
  research: [],
  resources: [],
  progression: {
    baseCoins: 10,
    growth: 1.6,
    copyGrowth: 1.18,
    copyDiminish: 0.7,
    baseLand: 4,
    offlineHours: 8,
    gates: [],
  },
};
export function configureVillage(config) {
  data = config;
}
export const catalogue = () => data;
export function ensureVillage(s) {
  s.village ??= {
    buildings: {},
    research: [],
    resources: {},
    lastAccrual: s.lastAccrual,
    active: [],
    passive: [],
  };
  for (const r of data.resources) s.village.resources[r.id] ??= 0;
  return s.village;
}
export const frontier = (s) =>
  Math.max(0, ...s.completed.filter((id) => /^L\d+$/.test(id)).map((id) => Number(id.slice(1))));
export const base = (n) =>
  Math.round(data.progression.baseCoins * data.progression.growth ** Math.max(0, n - 1));
export const capacity = (s, id) =>
  data.resources.find((r) => r.id === id).cap * (1 + (ensureVillage(s).buildings.I04 || 0));
export const buildingCount = (s) =>
  Object.values(ensureVillage(s).buildings).reduce((sum, count) => sum + count, 0);
export function activeBuildings(s) {
  const v = ensureVillage(s),
    active = [];
  for (const b of [...data.buildings].sort((a, b) => a.level - b.level)) {
    if (!v.buildings[b.id]) continue;
    if (b.research && b.level >= 7 && !active.some((p) => p.path === b.path && p.level < b.level))
      continue;
    active.push(b);
  }
  return active;
}
export function multiplier(s, scope) {
  const v = ensureVillage(s),
    active = activeBuildings(s);
  let contribution = 0;
  for (const b of active.filter((b) => b.scope === scope))
    for (let i = 0; i < v.buildings[b.id]; i++)
      contribution += b.contribution * data.progression.copyDiminish ** i;
  const h = frontier(s),
    paths = new Set(active.filter((b) => b.research).map((b) => b.path));
  let synergy = 0;
  if (h >= 8 && paths.size >= 2) synergy += 0.1;
  if (
    h >= 12 &&
    [...paths].some((p) => {
      const types = active.filter((b) => b.path === p);
      return types.length >= 4 && types.some((b) => v.buildings[b.id] >= 2);
    })
  )
    synergy += 0.15;
  if (h >= 18 && paths.size === 3) synergy += 0.15;
  if (
    h >= 25 &&
    (active.filter((b) => b.research).length >= 12 ||
      [...paths].some((p) => active.filter((b) => b.path === p).length >= 8))
  )
    synergy += 0.2;
  return (1 + contribution) * (1 + synergy);
}
export function recordActive(s, amount, now = Date.now()) {
  const v = ensureVillage(s);
  v.active = v.active.filter((e) => e.time > now - 86400000);
  const bucket = Math.floor(now / 60000) * 60000,
    last = v.active.at(-1);
  if (last?.time === bucket) last.amount += amount;
  else v.active.push({ time: bucket, amount });
  s.coins += amount;
}
export function rates(s) {
  const v = ensureVillage(s),
    out = {};
  for (const b of activeBuildings(s))
    for (const [id, n] of Object.entries(b.output))
      out[id] = (out[id] || 0) + n * v.buildings[b.id];
  return out;
}
export function accrueVillage(s, now = Date.now()) {
  const v = ensureVillage(s),
    elapsed = Math.min(data.progression.offlineHours * 3600000, Math.max(0, now - v.lastAccrual));
  const output = rates(s),
    before = { ...v.resources };
  let remaining = elapsed / 60000;
  // Minute slices respect kiln inputs, concurrent producers and capacity, bounded to 480 steps.
  while (remaining > 1e-9) {
    const dt = Math.min(1, remaining);
    remaining -= dt;
    for (const r of data.resources.filter((r) => r.id !== 'bricks'))
      if (frontier(s) >= r.level)
        v.resources[r.id] = Math.max(
          v.resources[r.id],
          Math.min(capacity(s, r.id), v.resources[r.id] + (output[r.id] || 0) * dt),
        );
    const bricks = Math.max(
      0,
      Math.min(
        (output.bricks || 0) * dt,
        v.resources.timber / 2,
        v.resources.stone / 2,
        capacity(s, 'bricks') - v.resources.bricks,
      ),
    );
    v.resources.bricks += bricks;
    v.resources.timber -= bricks * 2;
    v.resources.stone -= bricks * 2;
  }
  v.active = v.active.filter((e) => e.time > now - 86400000);
  v.passive = v.passive.filter((e) => e.time > now - 86400000);
  const allowance = Math.max(
    0,
    v.active.reduce((n, e) => n + e.amount, 0) * 0.1 - v.passive.reduce((n, e) => n + e.amount, 0),
  );
  const coins = Math.min(allowance, ((output.coins || 0) * elapsed) / 60000);
  s.coins += coins;
  if (coins) {
    const bucket = Math.floor(now / 60000) * 60000,
      last = v.passive.at(-1);
    if (last?.time === bucket) last.amount += coins;
    else v.passive.push({ time: bucket, amount: coins });
  }
  v.lastAccrual = Math.max(v.lastAccrual, now);
  return {
    coins,
    resources: Object.fromEntries(
      data.resources.map((r) => [r.id, v.resources[r.id] - before[r.id]]),
    ),
  };
}
export const buildingCost = (s, b) =>
  Object.fromEntries(
    Object.entries(b.cost).map(([k, n]) => [
      k,
      n ? Math.ceil(n * data.progression.copyGrowth ** (ensureVillage(s).buildings[b.id] || 0)) : 0,
    ]),
  );
export const canPay = (s, cost) =>
  Object.entries(cost).every(
    ([id, n]) => (id === 'coins' ? s.coins : ensureVillage(s).resources[id] || 0) + 1e-8 >= n,
  );
export function pay(s, cost) {
  for (const [id, n] of Object.entries(cost))
    if (id === 'coins') s.coins -= n;
    else s.village.resources[id] -= n;
}
export function buildingLock(s, b) {
  const v = ensureVillage(s);
  if (frontier(s) < b.level) return 'Clear L' + b.level;
  if (b.sentence && !s.completed.some((id) => id.startsWith('S'))) return 'Complete a sentence set';
  if (b.research && !v.research.includes(b.research)) return b.research;
  if (b.storage && v.installment) return 'Finish expansion';
  if (
    b.research &&
    b.level >= 7 &&
    !activeBuildings(s).some((p) => p.path === b.path && p.level < b.level)
  )
    return 'Earlier ' + b.path + ' building';
  if (!canPay(s, buildingCost(s, b))) return 'Need resources';
  return '';
}
export function buyBuilding(s, id) {
  const b = data.buildings.find((b) => b.id === id);
  if (!b || buildingLock(s, b)) return false;
  pay(s, buildingCost(s, b));
  s.village.buildings[id] = (s.village.buildings[id] || 0) + 1;
  return true;
}
export function fundStorage(s) {
  const v = ensureVillage(s),
    b = data.buildings.find((b) => b.storage);
  if (frontier(s) < b.level) return false;
  v.installment ??= { remaining: buildingCost(s, b) };
  for (const [id, n] of Object.entries(v.installment.remaining)) {
    const paid = Math.min(n, id === 'coins' ? s.coins : v.resources[id]);
    pay(s, { [id]: paid });
    v.installment.remaining[id] -= paid;
  }
  if (Object.values(v.installment.remaining).every((n) => n < 1e-8)) {
    v.buildings[b.id] = (v.buildings[b.id] || 0) + 1;
    delete v.installment;
  }
  return true;
}
export function exchangeQuote(s, id, quantity, direction = 'buy') {
  const r = data.resources.find((r) => r.id === id);
  if (!r?.exchange) return { reason: 'Not tradable', coins: 0 };
  if (frontier(s) < r.level) return { reason: 'Clear L' + r.level, coins: 0 };
  if (!['buy', 'sell'].includes(direction) || !Number.isSafeInteger(quantity) || quantity <= 0)
    return { reason: 'Invalid trade', coins: 0 };
  const unit = r.exchange * base(frontier(s));
  const coins = (direction === 'sell' ? Math.floor(unit / 2) : unit) * quantity;
  const held = ensureVillage(s).resources[id];
  let reason = '';
  if (direction === 'buy') {
    if (held + quantity > capacity(s, id) + 1e-8) reason = 'Storage full';
    else if (s.coins + 1e-8 < coins)
      reason = 'Need ' + Math.ceil(coins - s.coins).toLocaleString() + ' more coins';
  } else if (held + 1e-8 < quantity) reason = 'Not enough materials';
  return { reason, coins };
}
export function exchange(s, id, quantity, direction = 'buy') {
  const quote = exchangeQuote(s, id, quantity, direction);
  if (quote.reason) return false;
  const sign = direction === 'sell' ? -1 : 1;
  s.coins -= sign * quote.coins;
  s.village.resources[id] += sign * quantity;
  return true;
}
export function gateStatus(s, n) {
  const v = ensureVillage(s),
    gate = data.progression.gates.find((g) => g.level === n);
  if (!gate) return [];
  return [
    {
      kind: 'buildings',
      label: 'Buildings owned',
      have: buildingCount(s),
      need: gate.buildings,
      help: `Own ${gate.buildings} buildings in this journey. Every purchased copy counts, including supply buildings, storage and repeated copies of the same type. Researching a blueprint alone is not a building. Choose any affordable buildings to reach the count. Meet this goal, the research goal and every resource target to unlock the next journey. Buildings remain yours when you advance; prestige resets them.`,
    },
    {
      kind: 'research',
      label: 'Research',
      have: v.research.length,
      need: gate.research,
      help: `Complete ${gate.research} research plans in this journey. Any path counts and each completed plan counts once. Research uses knowledge and insight produced by buildings. You can choose which plans to unlock; you do not need to complete every plan. Completed research stays unlocked when advancing and resets on prestige.`,
    },
    ...Object.entries(gate.resources).map(([id, need]) => {
      const resource = data.resources.find((r) => r.id === id);
      return {
        kind: 'resource',
        resource: id,
        label: resource.english,
        have: Math.floor(v.resources[id]),
        need,
        help:
          `Have ${need} ${resource.english} in storage at the same time as the other journey goals. ` +
          (resource.exchange
            ? `Produce ${resource.english} with buildings or buy it with coins in the Village exchange. `
            : `Buildings produce ${resource.english}; it cannot be bought in the exchange. `) +
          'This is a stockpile target, not a payment: advancing does not consume resources. Spending or selling them before advancing can make this goal incomplete again. Build a storehouse if the target exceeds your storage capacity.',
      };
    }),
  ];
}
