import * as pkmn from 'pkmn';

import {Format} from './format';
import {Rules} from './rules';
import {Species} from './species';

export class Sets extends pkmn.Sets {
  static validate(set: pkmn.PokemonSet, format: Format): string[] {
    const rules = Rules.get(format);
    if (!rules) {
      return [`${format} is not a valid format.`];
    }

    // Species
    const species = Species.get(set.species, format.gen);
    if (!species) {
      return [
        `${set.species} is not a valid species for generation ${format.gen}`
      ];
    }

    const problems: string[] = [];
    const pokemon = set.name || set.species;
    if (species.tier === 'Illegal') {
      problems.push(
          `${pokemon} does not exist outside of generation ${species.gen}.`);
    } else if (species.tier === 'Unreleased') {
      problems.push(`${pokemon} in unreleased in generation ${species.gen}.`);
    }

    // Level
    if (Rules.isLittleCup(rule)) {
      if (species.prevo) {
        problems.push(`${pokemon} isn't the first in its evolution family.`);
      } else if (!Species.nfe(species)) {
        problems.push(`${pokemon} doesn't have an evolution family.`);
      }
      if (set.level && set.level > 5) {
        problems.push(`${pokemon} must be level 5 or under in Little Cup.`);
      }
    } else {
      if (set.level && set.level > 100) {
        problems.push(`${pokemon} is higher than level 100.`);
      }
    }

    // Moves
    if (set.moves.length) {
      if (set.moves.length > 4) {
        problems.push(`${pokemon} has more than four moves.`);
      }
      const moveTable: {[k: string]: Move} = {};
      // BUG: Gen 2 Marowak w/ Swords Dance?
      for (const m of set.moves) {
        const move = pkmn.Moves.get(m, format.gen);
        if (!move) {
          problems.push(
              `${m} is not a valid move for generation ${format.gen}`);
        }
        if (moveTable[move.id]) {
          problems.push(`${pokemon} may not have duplicate moves (${
              move} is duplicated).`);
        }
        moveTable[move.id] = move;

        // OHKO Clause
        if (rules.clauses.has('OHKO') && move.ohko) {
          problems.push(`${move.name} is banned by OHKO Clause.`);
          continue;
        }
        // Evasion Moves Clause
        if (rules.clauses.has('Evasion Moves') &&
            (move.name === 'Minimize' || move.name === 'Double Team')) {
          problems.push(`${move.name} is banned by Evasion Moves Clause.`);
          continue;
        }
        // Swagger Clause
        if (rules.clauses.has('Swagger') && move.name === 'Swagger') {
          problems.push(`${move.name} is banned by Swagger Clause.`);
          continue;
        }
      }

      // Gen 2 Sleep Trapping
      if (format.gen === 2) {
        if (checkSleepTrap(moveTable)) {
          problems.push(`${
              pokemon} has both a sleeping and a trapping move, a combination which is banned in generation ${
              format.gen}.`);
        }
      }

      // Baton Pass Clause (partial)
      if (rules.clauses.has('Baton Pass') && moveTable['batonpass']) {
        if (checkBatonPass(set, format, moveTable)) {
          problems.push(`${pokemon} can Baton Pass both Speed and a different stat, which is banned by Baton Pass Clause.`;
        }
      }
    } else {
      problems.push(`${pokemon} must have at least one move.`);
    }

    // Gender
    if (set.gender) {
      if (set.gender !== species.gender) {
        problems.push(`${pokemon} is the wrong gender for its species (${
            set.gender} vs. ${species.gender}).`);
      }
      if (gen === 2) {
        const atkDV = pkmn.Stats.itod(set.ivs.atk);
        // Gen 2 gender is calculated from the Atk DV.
        // High Atk DV <-> M. The meaning of "high" depends on the gender ratio.
        const genderThreshold = species.genderRatio.F * 16;
        if (genderThreshold === 4) genderThreshold = 5;
        if (genderThreshold === 8) genderThreshold = 7;

        const expectedGender = (atkDV >= genderThreshold ? 'M' : 'F');
        if (set.gender !== expectedGender) {
          problems.push(`${pokemon} is ${set.gender}, but it has an Atk DV of ${
              atkDV}, which makes its gender ${expectedGender}.`);
        }
      }
    }

    // EVs
    if (format.gen < 3 && set.evs.spa !== set.evs.spd) {
      problems.push(`Before generation 3, SpA and SpD EVs must match (${
          pokemon} has ${set.evs.spa} SpA and ${set.evs.spd} SpD EVs).`);
    }
    // TODO: Max EVs and Total EVs check

    // IVs
    if (format.gen >= 6) {
      if (isLegendary(species, set.shiny)) {
        let perfect = 0;
        let stat: Stat;
        for (stat in set.ivs) {
          if (set.ivs[stat] >= 31) perfect++;
        }
        if (perfect < 3) {
          problems.push(`${
              pokemon} must have at least three perfect IVs because it's a legendary in generation ${
              format.gen}.`);
        }
      }

    } else if (format.gen < 3) {
      if (set.ivs.spa !== set.ivs.spd) {
        problems.push(`Before generation 3, SpA and SpD IVs must match (${
            pokemon} has ${set.ivs.spa} SpA and ${set.ivs.spd} SpD IVs).`);
      }
      if (format.gen === 2) {
        const dvs = pkmn.Stats.istods(set.ivs);

        const expectedHPDV = pkmn.Stats.getHPDV(set.ivs);
        if (dvs.hp !== expectedHPDV) {
          problems.push(`${pokemon} has an HP DV of ${
              dvs.hp}, but its Atk, Def, Spe and Spc DVs give it an HP DV of ${
              expectedHPDV}.`);
        }

        const expectedShiny =
            !!(dvs.def === 10 && dvs.spe === 10 && dvs.spa === 10 &&
               dvs.atk % 4 >= 2);
        if ((expectedShiny && !set.shiny) || (!expectedShiny && set.shiny)) {
          problems.push(`${name} is${
              set.shiny ? ' not ' : ' '}shiny, which does not match its DVs.`);
        }
      }
    }

    // Nature
    if (set.nature) {
      const nature = pkmn.Natures.get(set.nature);
      if (nature) {
        if (format.gen < 3) {
          problems.push(`Natures do not exist in generation ${format.gen} (${
              pokemon} has ${nature})`);
        }
      } else {
        if (format.gen >= 3) {
          problems.push(`${set.nature} is not a valid nature in generation ${
              format.gen}`);
        }
      }
    } else {
      if (format.gen >= 3) {
        problems.push(
            `${pokemon} requires a nature in generation ${format.gen}`);
      }
    }

    // Ability
    if (format.gen >= 3) {
      const ability = pkmn.Items.get(set.ability, format.gen);
      if (!ability) {
        problems.push(`${set.ability} is not a valid ability for generation ${
            format.gen}`);
      }

      // Evasion Abilities Clause
      if (rules.clauses.has('Evasion Abilities') &&
          (ability.name === 'Sand Veil' || ability.name === 'Snow Cloak')) {
        problems.push(`${ability.name} is banned by Evasion Abilities Clause.`);
        continue;
      }
      // Moody Clause
      if (rules.clauses.has('Moody') && ability.name === 'Moody') {
        problems.push(`${ability.name} is banned by Moody Clause.`);
        continue;
      }
    } else {
      if (set.ability) {
        problems.push(`Abilities do not exist in generation ${format.gen} (${
            pokemon} has ability ${set.ability})`);
      }
    }

    // Item
    if (format.gen >= 2) {
      const item = pkmn.Items.get(set.item, format.gen);
      if (set.item && !item) {
        problems.push(
            `${set.item} is not a valid item for generation ${format.gen}`);
      }

      if (item && item.id === 'griseousorb' && species.num !== 487) {
        problems.push(
            'Griseous Orb can only be held by Giratina in Generation 4.');
      }
    } else {
      if (set.item) {
        problems.push(`Held items do not exist in generation ${format.gen} (${
            pokemon} has item ${set.item})`);
      }
    }

    return problems;
  }
}

function isLegendary(s: Species, shiny?: boolean) {
  return (s.eggGroups[0] === 'Undiscovered' || s.name === 'Manaphy') &&
      !s.prevo && !Species.nfe(s) && s.name !== 'Unown' &&
      s.baseSpecies !== 'Pikachu' && (s.baseSpecies !== 'Diancie' || !shiny);
}

function checkBatonPass(
    set: pkmn.PokemonSet, format: Format, moves: {[k: string]: Move}): boolean {
  const SPEED_BOOST_ABILITIES: Set<ID> = new Set(
      ['motordrive', 'rattled', 'speedboost', 'steadfast', 'weakarmor']);
  const SPEED_BOOST_ITEMS: Set<ID> =
      new Set(['blazikenite', 'eeviumz', 'kommoniumz', 'salacberry']);
  const NON_SPEED_BOOST_ABILITIES: Set<ID> = new Set([
    'angerpoint', 'competitive', 'defiant', 'download', 'justified',
    'lightningrod', 'moxie', 'sapsipper', 'stormdrain'
  ]);
  const NON_SPEED_BOOST_ITEMS: Set<ID> = new Set([
    'absorbbulb', 'apicotberry', 'cellbattery', 'eeviumz', 'ganlonberry',
    'keeberry', 'kommoniumz', 'liechiberry', 'luminousmoss', 'marangaberry',
    'petayaberry', 'snowball', 'starfberry', 'weaknesspolicy'
  ]);
  const NON_SPEED_BOOST_MOVES: Set<ID> = new Set([
    'acupressure', 'bellydrum', 'chargebeam', 'curse', 'diamondstorm',
    'fellstinger', 'fierydance', 'flowershield', 'poweruppunch', 'rage',
    'rototiller', 'skullbash', 'stockpile'
  ]);

  const item = pkmn.Items.get(set.item, format.gen);
  const ability = pkmn.toID(set.ability);

  let speedBoosted: string|boolean = false;
  let nonSpeedBoosted: string|boolean = false;

  for (const id in moves) {
    const move = moves[id];

    if (move.id === 'flamecharge' ||
        (move.boosts && move.boosts.spe && move.boosts.spe > 0)) {
      speedBoosted = true;
    }

    if (NON_SPEED_BOOST_MOVES.has(move.id) ||
        move.boosts &&
            ((move.boosts.atk && move.boosts.atk > 0) ||
             (move.boosts.def && move.boosts.def > 0) ||
             (move.boosts.spa && move.boosts.spa > 0) ||
             (move.boosts.spd && move.boosts.spd > 0))) {
      nonSpeedBoosted = true;
    }

    if (item && item.zMove && move.type === item.zMoveType) {
      if (move.zMoveBoost && move.zMoveBoost.spe && move.zMoveBoost.spe > 0) {
        if (!speedBoosted) speedBoosted = move.name;
      }

      if (move.zMoveBoost &&
          ((move.zMoveBoost.atk && move.zMoveBoost.atk > 0) ||
           (move.zMoveBoost.def && move.zMoveBoost.def > 0) ||
           (move.zMoveBoost.spa && move.zMoveBoost.spa > 0) ||
           (move.zMoveBoost.spd && move.zMoveBoost.spd > 0))) {
        if (!nonSpeedBoosted || move.name === speedBoosted) {
          nonSpeedBoosted = move.name;
        }
      }
    }
  }

  if (SPEED_BOOST_ABILITIES.includes(ability) ||
      (item && SPEED_BOOST_ITEMS.has(item.id))) {
    speedBoosted = true;
  }
  if (!speedBoosted) return false;

  if (NON_SPEED_BOOST_ABILITIES.includes(ability) ||
      (item && NON_SPEED_BOOST_ITEMS.includes(item.id))) {
    nonSpeedBoosted = true;
  }
  if (!nonSpeedBoosted) return false;

  // true unless both boost sources are Z-moves, and they're distinct
  return !(
      speedBoosted !== nonSpeedBoosted && typeof speedBoosted === 'string' &&
      typeof nonSpeedBoosted === 'string');
}

function checkSleepTrap(moves: {[k: string]: Move}): boolean {
  const SLEEP_MOVES: Set<ID> =
      new Set(['hypnosis', 'lovelykiss', 'sing', 'sleeppowder', 'spore']);
  const TRAP_MOVES: Set<ID> = new Set(['meanlook', 'spiderweb']);

  let sleep = false;
  let trap = false;
  for (const m in moves) {
    if (SLEEP_MOVES.has(m)) {
      sleep = true;
    } else if (TRAP_MOVES.has(m)) {
      trap = true;
    }
  }

  return sleep && trap;
}
