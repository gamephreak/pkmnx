import * as pkmn from 'pkmn';
import {Species} from './species';

// NOTE: All mods are enforced by the engine during battle.
export type Mod =
    'Sleep Clause'|'HP Percentage'|'Cancel'|'Switch Priority'|'Freeze';

// NOTE: Endless Battle/Mega Rayquaza are enforced by the engine during battle.
export type Clause =
    'Species'|'Nickname'|'OHKO'|'Evasion Abilities'|'Evasion Moves'|
    'Endless Battle'|'Moody'|'Swagger'|'Baton Pass'|'Mega Rayquaza';

const STANDARD_MODS: Readonly<Mod[]> =
    ['Sleep Clause', 'HP Percentage', 'Cancel'];

const STANDARD_CLAUSES: Readonly<Clause[]> =
    ['Species', 'Nickname', 'OHKO', 'Moody', 'Evasion Moves', 'Endless Battle'];

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
      format: string, mods: Mod[] = STANDARD_MODS,
      clauses: Clause[] = STANDARD_CLAUSES, bans?: Ban, complexBans?: Ban[]) {
    this.format = pkmn.Format.fromString(format)!;
    this.mods = new Set(mods);
    this.clauses = new Set(clauses);
    this.bans = bans;
    this.complexBans = complexBans;
  }

  static get(f: pkmn.Format): Rules|undefined {
    return RULES[f.id];
  }

  isLittleCup() {
    const tier = this.format.tier;
    return tier === 'LC' || tier === 'LC Uber';
  }

  isBanned(k: 'Move'|'Ability'|'Item'|'Species', id: pkmn.ID): boolean {
    switch (k) {
      case 'Move':
        return (this.bans && this.bans.moves) ? this.bans.moves.has(id) : false;
      case 'Ability':
        return (this.bans && this.bans.abilities) ?
            this.bans.abilities.has(id) :
            false;
      case 'Item':
        return (this.bans && this.bans.items) ? this.bans.items.has(id) : false;
      case 'Species':
        if (this.bans && this.bans.species && this.bans.species.has(id)) {
          return true;
        }
        const species = Species.get(id);
        return species === undefined ||
            pkmn.Tiers.isAllowed(species, this.format.tier);
      default:  // exhaustive
    }
    return false;
  }

  isComplexBanned(s: pkmn.PokemonSet): boolean {
    if (!this.complexBans || !this.complexBans.length) return false;

    for (const ban of this.complexBans) {
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

const STANDARD_CLAUSES_WITH_SWAGGER: Readonly<Clause[]> =
    [...STANDARD_CLAUSES, 'Swagger'];

const GEN5_STANDARD_CLAUSES: Readonly<Clause[]> =
    [...STANDARD_CLAUSES_WITH_SWAGGER, 'Evasion Abilities', 'Baton Pass'];

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
  }),
  'gen7nu': new Rules('gen7nu', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
  }),
  'gen7pu': new Rules('gen7pu', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
  }),
  'gen7lc': new Rules(
      'gen7lc', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER,
      {moves: IDSet('dragonrage', 'sonicboom'), items: IDSet('eeviumz')}),
  'gen6ag':
      new Rules('gen6ag', ['HP Percentage', 'Cancel'], ['Endless Battle']),
  'genuber': new Rules(
      'gen6uber', STANDARD_MODS,
      [...STANDARD_CLAUSES_WITH_SWAGGER, 'Mega Rayquaza']),
  'gen6ou': new Rules('gen6ou', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER, {
    abilities: IDSet('arenatrap', 'shadowtag'),
    moves: IDSet('batonpass'),
    items: IDSet('souldew')
  }),
  'gen6uu': new Rules('gen6uu', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER, {
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    moves: IDSet('batonpass'),
  }),
  'gen6ru': new Rules('gen6ru', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER, {
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    moves: IDSet('batonpass'),
  }),
  'gen6nu': new Rules('gen6nu', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER, {
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    moves: IDSet('batonpass'),
  }),
  'gen6pu': new Rules('gen6pu', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER, {
    abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
    moves: IDSet('batonpass', 'chatter'),
  }),
  'gen6lc': new Rules(
      'gen6lc', STANDARD_MODS, STANDARD_CLAUSES_WITH_SWAGGER,
      {moves: IDSet('dragonrage', 'sonicboom')}),
  'gen5uber': new Rules(
      'gen5uber', STANDARD_MODS,
      ['Species', 'Nickname', 'OHKO', 'Moody', 'Endless Battle']),
  // NOTE: Drizzle ++ Swift Swim / Drought ++ Cholorophyll special cased.
  'gen5ou': new Rules('gen5ou', STANDARD_MODS, GEN5_STANDARD_CLAUSES, {
    moves: IDSet('batonpass'),
    abilities: IDSet('arenatrap', 'sandrush'),
    items: IDSet('souldew')
  }),
  'gen5uu': new Rules(
      'gen5uu', STANDARD_MODS, GEN5_STANDARD_CLAUSES,
      {abilities: IDSet('arenatrap', 'drought', 'sandstream', 'snowwarning')}),
  'gen5ru': new Rules(
      'gen5ru', STANDARD_MODS, GEN5_STANDARD_CLAUSES,
      {abilities: IDSet('arenatrap', 'drought', 'sandstream', 'snowwarning')},
      [SMASH_PASS]),
  'gen5nu': new Rules(
      'gen5nu', STANDARD_MODS, GEN5_STANDARD_CLAUSES,
      {abilities: IDSet('arenatrap', 'drought', 'sandstream', 'snowwarning')},
      [SMASH_PASS, PRANKSTER_ASSIST]),
  'gen5lc': new Rules('gen5lc', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('dragonrage', 'sonicboom'),
    items: IDSet('berryjuice'),
    abilities: IDSet('sandrush')
  }),
  'gen4uber': new Rules(
      'gen4uber', STANDARD_MODS, STANDARD_CLAUSES, {species: IDSet('arceus')}),
  'gen4ou': new Rules(
      'gen4ou', STANDARD_MODS,
      [...STANDARD_CLAUSES, 'Evasion Abilities', 'Baton Pass'],
      {items: IDSet('souldew')}),
  'gen4uu': new Rules('gen4uu', STANDARD_MODS, STANDARD_CLAUSES),
  'gen4nu': new Rules('gen4nu', STANDARD_MODS, STANDARD_CLAUSES),
  'gen4lc': new Rules('gen4lc', STANDARD_MODS, STANDARD_CLAUSES, {
    moves: IDSet('dragonrage', 'sonicboom'),
    items: IDSet('berryjuice', 'deepseatooth')
  }),
  'gen3uber': new Rules(
      'gen3ou', STANDARD_MODS, STANDARD_CLAUSES, undefined,
      [INGRAIN_SMEARGLE, LEFTOVERS_WOBBUFFET]),
  'gen3ou': new Rules(
      'gen3ou', STANDARD_MODS, STANDARD_CLAUSES, undefined, [INGRAIN_SMEARGLE]),
  'gen3uu': new Rules('gen3uu'),
  'gen3nu': new Rules('gen3nu'),
  'gen2ou': new Rules('gen2ou'),
  'gen1ou': new Rules('gen1ou'),
};
