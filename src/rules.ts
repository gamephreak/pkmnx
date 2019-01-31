import * as pkmn from 'pkmn';
import {Format} from './format';
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

export interface Rules {
  readonly format: Format;
  readonly mods: Readonly<Set<Mod>>;
  readonly clauses: Readonly<Set<Clause>>;
  readonly bans?: Ban;
  readonly complexBans?: Ban[];
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

const STANDARD_MODS: Readonly<Set<Mod>> =
    new Set(['Sleep Clause', 'HP Percentage', 'Cancel'] as Mod[]);

const STANDARD_CLAUSES: Readonly<Set<Clause>> = new Set([
  'Species', 'Nickname', 'OHKO', 'Moody', 'Evasion Moves', 'Endless Battle'
] as Clause[]);

const RULES: {[format: string]: Rules} = {
  'gen7ag': {
    format: Format.fromString('gen7ag')!,
    mods: new Set(['HP Percentage', 'Cancel'] as Mod[]),
    clauses: new Set(['Endless Battle'] as Clause[])
  },
  'gen7uber': {
    format: Format.fromString('gen7uber')!,
    mods: STANDARD_MODS,
    clauses: new Set([...STANDARD_CLAUSES.keys(), 'Mega Rayquaza'] as Clause[]),
    bans: {moves: IDSet('batonpass')},
    complexBans: [HYPNOSIS_MEGA_GENGAR]
  },
  'gen7ou': {
    format: Format.fromString('gen7ou')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: IDSet('batonpass'),
      abilities: IDSet('arenatrap', 'shadowtag')
    }
  },
  'gen7uu': {
    format: Format.fromString('gen7uu')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: IDSet('batonpass'),
      abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
      items: IDSet('kommoniumz', 'mewniumz')
    }
  },
  'gen7ru': {
    format: Format.fromString('gen7ru')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: IDSet('batonpass', 'auroraveil'),
      abilities: IDSet('arenatrap', 'shadowtag', 'drizzle'),
      items: IDSet('kommoniumz', 'mewniumz')
    }
  },
  'gen7nu': {
    format: Format.fromString('gen7nu')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: IDSet('batonpass'),
      abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
      items: IDSet('kommoniumz', 'mewniumz')
    }
  },
  'gen7pu': {
    format: Format.fromString('gen7pu')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    bans: {
      moves: IDSet('batonpass'),
      abilities: IDSet('arenatrap', 'shadowtag', 'drizzle', 'drought'),
      items: IDSet('kommoniumz', 'mewniumz')
    }
  },
  'gen7lc': {
    format: Format.fromString('gen7lc')!,
    mods: STANDARD_MODS,
    clauses: new Set([...STANDARD_CLAUSES.keys(), 'Swagger'] as Clause[]),
    bans: {moves: IDSet('dragonrage', 'sonicboom'), items: IDSet('eeviumz')}
  },
  // TODO
  'gen5ou': {
    format: Format.fromString('gen5ou')!,
    mods: STANDARD_MODS,
    clauses: new Set([
      ...STANDARD_CLAUSES.keys(), 'Swagger', 'Baton Pass', 'Evasion Abilities'
    ] as Clause[]),
    bans: {
      moves: IDSet('batonpass'),
      abilities: IDSet('arenatrap', 'sandrush'),
      items: IDSet('souldew')
    }
  },
  // TODO
  'gen3uber': {
    format: Format.fromString('gen3ou')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    complexBans: [INGRAIN_SMEARGLE, LEFTOVERS_WOBBUFFET],
  },
  'gen3ou': {
    format: Format.fromString('gen3ou')!,
    mods: STANDARD_MODS,
    clauses: STANDARD_CLAUSES,
    complexBans: [INGRAIN_SMEARGLE],
  },
  // TODO
};

export class Rules {
  static get(f: Format): Rules|undefined {
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

  static isBansned(r: Rules, s: pkmn.PokemonSet): boolean {
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
