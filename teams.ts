import * as pkmn from 'pkmn';

export class Team extends pkmn.Team {
  validate(team: Team, gen?: pkmn.Generation): string[] {
    return Teams.validateTeam(this, gen);
  }
}

export class Teams extends pkmn.Teams {
  static validateTeam(team: Team, gen?: pkmn.Generation): string[] {
    return [];  // TODO
  }
}
