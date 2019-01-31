import * as pkmn from 'pkmn';

import {Format} from './format';
import {Rules} from './rules';
import {Sets} from './sets';
import {Species} from './species';

export class Team extends pkmn.Team {
  validate(team: pkmn.Team, format?: Format): string[] {
    return Teams.validateTeam(this, format);
  }
}

export class Teams extends pkmn.Teams {
  static validateTeam(team: pkmn.Team, f?: Format): string[] {
    const format: Format =
        f ? f : Format.fromString(team.format || '') || new Format();
    const rules = Rules.get(format);
    if (!rules) {
      return [`${format} is not a valid format.`];
    }

    const problems = [];
    if (team.team.length > 6) {
      problems.push('Your team has more than six Pokémon.');
    }

    let kyurems = 0;
    let ndm = 0;
    let ndw = 0;
    let bp = 0;

    const speciesTable: {[k: number]: true} = {};
    const nameTable: {[k: string]: true} = {};
    const abilityTable: {[k: string]: true} = {};
    for (const set of team.team) {
      const species = Species.get(set.species, format.gen);
      if (!species) {
        problems.push(
            `${species} is not a valid species for generation ${format.gen}`);
        continue;
      }

      // Nickname Clause
      if (rules.clauses.has('Nickname')) {
        if (set.name) {
          if (set.name === species.baseSpecies) continue;
          if (nameTable[set.name]) {
            problems.push(
                `Your Pokémon must have different ` +
                `nicknames (you have more than one ${set.name}).`);
          }
          nameTable[set.name] = true;
        }
      }

      // Species Clause
      if (rules.clauses.has('Species')) {
        if (speciesTable[species.num]) {
          problems.push(
              `You are limited to one of each Pokémon by Species ` +
              `Clause (you have more than one ${species.baseSpecies}).`);
        }
        speciesTable[species.num] = true;
      }

      switch (species.name) {
        case 'Kyurem-White':
        case 'Kyurem-Black':
          kyurems++;
          break;
        case 'Necrozma-Dusk-Mane':
          ndm++;
          break;
        case 'Necrozma-Dawn-Wings':
          ndw++;
          break;
        default:  // exhaustive
      }

      problems.concat(Sets.validate(set, format));

      abilityTable[pkmn.toID(set.ability)] = true;
      if (set.moves.find(m => pkmn.toID(m) === 'batonpass')) bp++;
    }

    if (kyurems > 0) {
      problems.push('You cannot have more than one Kyurem-Black/Kyurem-White.');
    }
    if (ndm > 0) {
      problems.push('You cannot have more than one Necrozma-Dusk-Mane.');
    }
    if (ndw > 0) {
      problems.push('You cannot have more than one Necrozma-Dawn-Wings.');
    }

    // Baton Pass Clause (partial)
    if (rules.clauses.has('Baton Pass') && bp > 1) {
      problems.push(`Team has ${
          3} Pokémon with Baton Pass despite Baton Pass Clause's limit of 1.`);
    }

    // Drizzle ++ Swift Swim, Drought ++ Chlorophyll
    if (rules.format.id === 'gen5ou') {
      if (abilityTable['drizzle'] && abilityTable['swiftswim']) {
        problems.push(
            'Drizzle and Swift Swim may not be used to the same team.');
      }
      if (abilityTable['drought'] && abilityTable['chlorophyll']) {
        problems.push(
            'Drought and Chlorophyll may not be used to the same team.');
      }
    }

    return problems;
  }
}
