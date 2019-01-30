import * as pkmn from 'pkmn';

/*
export type PokemonSet = {
  readonly name: string;
  readonly species: string;
  readonly item: string;
  readonly ability: string;
  readonly moves: string[];
  readonly evs: StatsTable;
  readonly ivs: StatsTable;
  readonly gender?: string;
  readonly level?: number;
  readonly shiny?: boolean;
  readonly pokeball?: string;
  readonly hpType?: string;
};
 */

export type ObservedPokemonSet = {
  //readonly name: string; not important
  readonly species: string;
  readonly moves: string[];
  readonly level: number;
  readonly pokeball: string;

  readonly gender: string;
  readonly shiny: boolean;

  // situationally observable
  readonly item?: string;
  readonly ability?: string;
  readonly hpType?: string;

  // can only be inferred
  readonly happiness: number;
  readonly evs: StatsTable;
  readonly nature: string;
  readonly ivs: StatsTable;
};


export class Sets extends pkmn.Sets {
  validate(s: pkmn.PokemonSet, gen?: pkmn.Generation): string[] {
    return [];  // TODO
  }

  // TODO: COMPLEX TEAM BANS REQUIRE US TO HAVE ENTIRES TEAMS SET BEFORE RESTRICTING!
  //restrictions(s: ObservedPokemonSet, Format: format);
  //possibilities(s: ObservedPokemonSet, Format: format);
}
