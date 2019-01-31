// TODO: COMPLEX TEAM BANS REQUIRE US TO HAVE ENTIRES TEAMS SET BEFORE
// RESTRICTING!
// restrictions(s: ObservedPokemonSet, Format: format);
// possibilities(s: ObservedPokemonSet, Format: format);

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
