import * as pkmn from 'pkmn';
import {Species} from './species';

// NOTE: All mods are enforced by the engine during battle.
export type Mod = 'Sleep Clause' | 'HP Percentage' | 'Cancel' | 'Switch Priority' | 'Freeze';

// NOTE: Endless Battle/Mega Rayquaza are enforced by the engine during battle.
export type Clause = 'Species' | 'Nickname' | 'OHKO' | 'Evasion Abilities' |
  'Evasion Moves' | 'Endless Battle' | 'Moody' |
  'Swagger' | 'Baton Pass' | 'Mega Rayquaza';

export interface Bans {
  readonly species?: Readonly<Set<pkmn.ID>>;
  readonly moves?: Readonly<Set<pkmn.ID>>;
  readonly abilities?: Readonly<Set<pkmn.ID>>;
  readonly items?: Readonly<Set<pkmn.ID>>;
}

export interface Rules {
  readonly format: pkmn.ID;
  readonly mods: Readonly<Set<Mod>>;
  readonly clauses: Reaodnly<Set<Clause>>;
  readonly bans?: Bans;
  readonly complexBans?: Bans[];
}

const INGRAIN_SMEARGLE: ComplexBan =
  { species: new Set(['smeargle']), moves: new Set(['ingrain']) };

const HYPNOSIS_MEGA_GENGAR: ComplexBan =
  { species: new Set(['gengarmega']), moves: new Set(['hypnosis']) };

const SMASH_PASS: ComplexBan =
  { moves: new Set(['shellsmash', 'batonpass']) };

const PRANKSTER_ASSIST: ComplexBan =
  { ability: new Set(['prankster']),  moves: new Set(['assist']) };

const LEFTOVERS_WOBBUFFET: ComplexBan =
  { species: new Set(['wobbuffet']), item: new Set(['leftovers']) };

const STANDARD_MODS: Readonly<Set<Mod>>: new Set(['Sleep Clause', 'HP Percentage', 'Cancel']);
const STANDARD_CLAUSES: Readonly<Set<Clause>> = new Set(['Species', 'Nickname', 'OHKO', 'Moody', 'Evasion Moves', 'Endless Battle']);

const RULES: {[format: string]: Rules = {
  'gen7ag': {
    format: 'gen7ag',
    mods: new Set(['HP Percentage', 'Cancel']),
    clauses: new Set(['Endless Battle'])
  },
  'gen7uber': {
    format: 'gen7uber',
    mods: STANDARD_MODS,
    clauses: new Set([...STANDARD_CLAUSES, 'Mega Rayquaza']),
    bans: { moves: new Set(['batonpass']) }
  },
  'gen7ou': {
    format: 'gen7ou',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: new Set(['batonpass']),
      abilities: new Set(['arenatrap', 'shadowtag'])
    }
  },
  'gen7uu': {
    format: 'gen7uu',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: new Set(['batonpass']),
      abilities: new Set(['arenatrap', 'shadowtag', 'drizzle', 'drought']),
      items: new Set(['kommoniumz', 'mewniumz'])
    }
  },
  'gen7ru': {
    format: 'gen7ru',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: new Set(['batonpass', 'auroraveil']),
      abilities: new Set(['arenatrap', 'shadowtag', 'drizzle']),
      items: new Set(['kommoniumz', 'mewniumz'])
    }
  },
  'gen7nu': {
    format: 'gen7nu',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: new Set(['batonpass']),
      abilities: new Set(['arenatrap', 'shadowtag', 'drizzle', 'drought']),
      items: new Set(['kommoniumz', 'mewniumz'])
    }
  },
  'gen7pu': {
    format: 'gen7pu',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: new Set(['batonpass']),
      abilities: new Set(['arenatrap', 'shadowtag', 'drizzle', 'drought']),
      items: new Set(['kommoniumz', 'mewniumz'])
    }
  },
  'gen7lc': {
    format: 'gen7lc',
    mods: STANDARD_MODS,
    clauses: new Set([...STANDARD_CLAUSES, 'Swagger']),
    bans: {
      moves: new Set(['dragonrage', 'sonicboom']),
      items: new Set(['eeviumz'])
    }
  },
  // TODO
  'gen5ou': {
    format: 'gen5ou',
    mods: STANDARD_MODS,
    clauses: new Set([...STANDARD_CLAUSES, 'Swagger', 'Baton Pass', 'Evasion Abilities']),
    bans: {
      moves: new Set(['batonpass']),
      abilities: new Set(['arenatrap', 'sandrush']),
      items: new Set(['souldew'])
    }
  },
  // TODO
  'gen3uber': {
    format: 'gen3ou',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    complexBans: new Set(INGRAIN_SMEARGLE, LEFTOVERS_WOBBUFFET),
  },
  'gen3ou': {
    format: 'gen3ou',
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    complexBans: new Set(INGRAIN_SMEARGLE),
  },
  // TODO
}

export class Rules {
  static get(f: Format): Rules|undefined {
    return RULES[f.id];
  }

  static isLittleCup(r: Rules) {
    const tier = r.format.tier;
    return tier === 'LC' || tier == 'LC Uber';
  }

  static isBanned(r: Rules, k:'Move'|'Ability'|'Item'|'Species', id: pkmn.ID): boolean {
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
        return !!species || pkmn.Tiers.isAllowed(species, r.format.tier);
    }
    return false;
  }

  static isComplexBanned(r: Rules, s: pkmn.PokemonSet): boolean {
    if (!r.complexBans || !r.complexBans.length) return false;

    for (const ban of complexBans) {
      if ((!ban.species || ban.species.has(pkmn.toID(s.species))) &&
          (!ban.abilities || ban.abilities.has(pkmn.toID(s.ability))) &&
          (!ban.items || ban.items.has(pkmn.toID(s.item))) &&
          (!ban.moves || !!s.moves.find(m => ban.moves.has(toID(m))))) {
        return true;
      }
    }
    return false;
  }
}
