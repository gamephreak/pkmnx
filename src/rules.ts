import * as pkmn from 'pkmn';
import {Species} from './species';

// NOTE: All mods are enforced by the engine during battle.
export type Mod =
    'Sleep Clause'|'HP Percentage'|'Cancel'|'Switch Priority'|'Freeze';

// NOTE: Endless Battle/Mega Rayquaza are enforced by the engine during battle.
export type Clause =
    'Species'|'Nickname'|'OHKO'|'Evasion Abilities'|'Evasion Moves'|
    'Endless Battle'|'Moody'|'Swagger'|'Baton Pass'|'Mega Rayquaza';

export interface Ban {
  readonly species?: Readonly<Set<pkmn.ID>>;
  readonly moves?: Readonly<Set<pkmn.ID>>;
  readonly abilities?: Readonly<Set<pkmn.ID>>;
  readonly items?: Readonly<Set<pkmn.ID>>;
}

export class Rules {
  readonly format: pkmn.Format;
  readonly mods: Readonly<Set<Mod>>;
  readonly clauses: Readonly<Set<Clause>>;
  readonly bans?: Ban;
  readonly complexBans?: Ban[];

  constructor(
      format: string, mods: Mod[], clauses: Clause[], bans?: Ban,
      complexBans?: Ban[]) {
    this.format = pkmn.Format.fromString(format)!;
    this.mods = new Set(mods);
    this.clauses = new Set(clauses);
    this.bans = bans;
    this.complexBans = complexBans;
  }

  static get(f: pkmn.Format): Rules|undefined {
    return RULES[f.id];
  }

  static isLittleCup(r: Rules) {
    const tier = r.format.tier;
    return tier === 'LC' || tier === 'LC Uber';
  }

  static isBanned(r: Rules, k: 'Move'|'Ability'|'Item'|'Species', id: pkmn.ID):
      boolean {
    switch (k) {
      case 'Move':
        return (r.bans && r.bans.moves) ? r.bans.moves.has(id) : false;
      case 'Ability':
        return (r.bans && r.bans.abilities) ? r.bans.abilities.has(id) : false;
      case 'Item':
        return (r.bans && r.bans.items) ? r.bans.items.has(id) : false;
      case 'Species':
        if (r.bans && r.bans.species && r.bans.species.has(id)) return true;
        const species = Species.get(id);
        return species === undefined ||
            pkmn.Tiers.isAllowed(species, r.format.tier);
      default:  // exhaustive
    }
    return false;
  }

  static isComplexBanned(r: Rules, s: pkmn.PokemonSet): boolean {
    if (!r.complexBans || !r.complexBans.length) return false;

    for (const ban of r.complexBans) {
      if ((!ban.species || ban.species.has(pkmn.toID(s.species))) &&
          (!ban.abilities || ban.abilities.has(pkmn.toID(s.ability))) &&
          (!ban.items || ban.items.has(pkmn.toID(s.item))) &&
          (ban.moves || !!s.moves.find(m => ban.moves!.has(pkmn.toID(m))))) {
        return true;
      }
    }
    return false;
  }
}

function IDSet(...ids: string[]): Set<pkmn.ID> {
  return new Set(ids as pkmn.ID[]);
}

const INGRAIN_SMEARGLE: Ban = {
  species: IDSet('smeargle'),
  moves: IDSet('ingrain')
};

const HYPNOSIS_MEGA_GENGAR: Ban = {
  species: IDSet('gengarmega'),
  moves: IDSet('hypnosis')
};

const SMASH_PASS: Ban = {
  moves: IDSet('shellsmash', 'batonpass')
};

const PRANKSTER_ASSIST: Ban = {
  abilities: IDSet('prankster'),
  moves: IDSet('assist')
};

const LEFTOVERS_WOBBUFFET: Ban = {
  species: IDSet('wobbuffet'),
  items: IDSet('leftovers')
};

const STANDARD_MODS: Readonly<Mod[]> =
    ['Sleep Clause', 'HP Percentage', 'Cancel'];

const STANDARD_CLAUSES: Readonly<Clause[]> =
    ['Species', 'Nickname', 'OHKO', 'Moody', 'Evasion Moves', 'Endless Battle'];

const RULES: {[format: string]: Rules} = {
  'gen7ag':
      new Rules('gen7ag', ['HP Percentage', 'Cancel'], ['Endless Battle']),
  'gen7uber': new Rules(
      'gen7uber', STANDARD_MODS, [...STANDARD_CLAUSES, 'Mega Rayquaza'],
      {moves: IDSet('batonpass')}, [HYPNOSIS_MEGA_GENGAR]),
  'gen7ou': new Rules(
      'gen7ou', STANDARD_MODS, STANDARD_CLAUSES,
      {moves: IDSet('batonpass'), abilities: IDSet('arenatrap', 'shadowtag')}),
  'gen7uu': new Rules('gen7uu', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    items: IDSet('kommoniumz', 'mewniumz')
  }),
  'gen7ru': new Rules('gen7ru', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass', 'auroraveil'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle'),
    items: IDSet('kommoniumz', 'mewniumz')
  }),
  'gen7nu': new Rules('gen7nu', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    items: IDSet('kommoniumz', 'mewniumz')
  }),
  'gen7pu': new Rules('gen7pu', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    items: IDSet('kommoniumz', 'mewniumz')
  }),
  'gen7lc': new Rules(
      'gen7lc', STANDARD_MODS, [...STANDARD_CLAUSES, 'Swagger'],
      {moves: IDSet('dragonrage', 'sonicboom'), items: IDSet('eeviumz')}),
  // TODO
  'gen5ou': new Rules(
      'gen5ou', STANDARD_MODS,
      [...STANDARD_CLAUSES, 'Swagger', 'Baton Pass', 'Evasion Abilities'], {
        moves: IDSet('batonpass'),
        abilities: IDSet('arenatrap', 'sandrush'),
        items: IDSet('souldew')
      }),
  // TODO
  'gen3uber': new Rules(
      'gen3ou', STANDARD_MODS, STANDARD_CLAUSES, undefined,
      [INGRAIN_SMEARGLE, LEFTOVERS_WOBBUFFET]),
  'gen3ou': new Rules(
      'gen3ou', STANDARD_MODS, STANDARD_CLAUSES, undefined, [INGRAIN_SMEARGLE])
  // TODO
};
