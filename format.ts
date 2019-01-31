import * as pkmn from 'pkmn';

export class Format {
  readonly id: pkmn.ID;

  constructor(readonly gen: pkmn.Generation = 7, readonly tier: pkmn.Tier = 'OU') {
    this.gen = gen;
    this.tier = tier;
    this.id =`gen${gen}${toID(tier)}`
  }

  toString(): string {
    return this.id;
  }

  static fromString(s: string): Format|undefined {
    // BUG: this will break in ~10 years when gen10 gets released...
    if (s.slice(0, 3) === 'gen') {
      const tier: pkmn.Tier|undefined = Tiers.fromString(s.slice(4));
      return tier ? new Format(Number(s[3])) as pkmn.Generation, tier) : undefined;
    } else {
      const tier: pkmn.Tier|undefined = Tiers.fromString(s);
      return tier ? new Format(6, tier) : undefined;
    }
  }
};
