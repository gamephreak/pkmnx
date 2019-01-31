import * as pkmn from 'pkmn';

/**
 * Describes a possible way to get a move onto a pokemon.
 *
 * First character is a generation number, 1-7.
 * Second character is a source ID, one of:
 *
 * - L = start or level-up, 3rd char+ is the level
 * - M = TM/HM
 * - T = tutor
 * - E = egg
 * - S = event, 3rd char+ is the index in .eventPokemon
 * - D = Dream World, only 5D is valid
 * - V = Virtual Console transfer, only 7V is valid
 * - C = NOT A REAL SOURCE, see note, only 3C/4C is valid
 *
 * C marks certain moves learned by a pokemon's prevo. It's used to
 * work around the chainbreeding checker's shortcuts for performance;
 * it lets the pokemon be a valid father for teaching the move, but
 * is otherwise ignored by the learnset checker (which will actually
 * check prevos for compatibility).
 */
type MoveSource = string;

export type EventInfo = {
  readonly generation: pkmn.Generation;
  readonly level?: number;
  readonly shiny?: true | 1;
  readonly gender?: pkmn.Gender;
  readonly nature?: string;
  readonly ivs?: Readonly<Partial<pkmn.StatsTable>>;
  readonly perfectIVs?: number;
  readonly isHidden?: boolean;
  readonly abilities?: Readonly<string[]>;
  readonly moves?: Readonly<string[]>;
  readonly pokeball?: string;
  readonly from?: string;
};

export interface Species extends pkmn.Species {
  readonly eggGroups: Readonly<string[]>;
  readonly genderRatio?: {[k: string]: number};
  readonly evoLevel?: number;
  readonly maleOnlyHidden?: boolean;
  readonly unreleasedHidden?: boolean;
  readonly eventOnly?: boolean;
  readonly eventPokemon?: Readonly<EventInfo[]>;
  readonly learnset?: Readonly<{[k: string]: MoveSource[]}>;
  readonly battleOnly?: boolean;
  readonly requiredAbility?: string;
  readonly requiredItem?: string;
  readonly requiredItems?: string[];
  readonly requiredMove?: string;
  // TODO illegal moveset combinations!
}

export class Species extends pkmn.Species {
  static nfe(s: Species) {
    return s.evos && s.evos.length;
  }
}
