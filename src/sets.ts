import * as pkmn from 'pkmn';

import {Rules} from './rules';
import {Species} from './species';

/**
 * Describes a possible way to get a pokemon. Is not exhaustive!
 * sourcesBefore covers all sources that do not have exclusive
 * moves (like catching wild pokemon).
 *
 * First character is a generation number, 1-7.
 * Second character is a source ID, one of:
 *
 * - E = egg, 3rd char+ is the father in gen 2-5, empty in gen 6-7
 *   because egg moves aren't restricted to fathers anymore
 * - S = event, 3rd char+ is the index in .eventPokemon
 * - D = Dream World, only 5D is valid
 * - V = Virtual Console transfer, only 7V is valid
 *
 * Designed to match MoveSource where possible.
 */
type PokemonSource = string;

/**
 * Keeps track of how a pokemon with a given set might be obtained.
 *
 * `sources` is a list of possible PokemonSources, and a nonzero
 * sourcesBefore means the Pokemon is compatible with all possible
 * PokemonSources from that gen or earlier.
 *
 * `limitedEgg` tracks moves that can only be obtained from an egg with
 * another father in gen 2-5. If there are multiple such moves,
 * potential fathers need to be checked to see if they can actually
 * learn the move combination in question.
 */
type PokemonSources = {
  sources: PokemonSource[]; sourcesBefore: number;
  babyOnly?: string;
  sketchMove?: string;
  hm?: string;
  restrictiveMoves?: string[];
  limitedEgg?: Array<string|'self'>;
  isHidden?: boolean;
  fastCheck?: true;
};

export class Sets extends pkmn.Sets {
  static validate(set: pkmn.PokemonSet, format: pkmn.Format): string[] {
    const rules = Rules.get(format);
    if (!rules) {
      return [`${format} is not a valid format.`];
    }

    // Species
    const species = Species.get(set.species, format.gen);
    if (!species) {
      return [
        `${set.species} is not a valid species for generation ${format.gen}.`
      ];
    }

    const problems: string[] = [];
    const pokemon = set.name || set.species;
    if (rules.isBanned('Species', species.id)) {
      problems.push(
          `${pokemon}'s species is banned in generation ` +
          `${format.gen} ${format.tier}.`);
    }

    if (species.tier === 'Illegal') {
      problems.push(
          `${pokemon} does not exist outside of generation ${species.gen}.`);
    } else if (species.tier === 'Unreleased') {
      problems.push(`${pokemon} in unreleased in generation ${species.gen}.`);
    }

    // Complex Ban
    if (rules.isComplexBanned(set)) {
      problems.push(
          `${pokemon}'s set is complex banned in generation` +
          `${format.gen} ${format.tier}.`);
    }

    // Level
    if (set.level !== undefined &&
        (isNaN(set.level) || set.level > 100 || set.level > 100)) {
      problems.push(`${set.level} is invalid for ${pokemon}`);
    }
    const level = set.level ? set.level : rules.isLittleCup() ? 5 : 100;
    if (rules.isLittleCup()) {
      if (species.prevo) {
        problems.push(`${pokemon} isn't the first in its evolution family.`);
      } else if (!Species.nfe(species)) {
        problems.push(`${pokemon} doesn't have an evolution family.`);
      }
      if (level > 5) {
        problems.push(`${pokemon} must be level 5 or under in Little Cup.`);
      }
    }

    // Happiness
    if (set.happiness !== undefined && isNaN(set.happiness)) {
      problems.push(`${pokemon} has an invalid happiness.`);
    }

    // Gender
    if (set.gender) {
      if (set.gender !== species.gender) {
        problems.push(
            `${pokemon} is the wrong gender for its species ` +
            `(${set.gender} vs. ${species.gender}).`);
      }
      if (format.gen === 2) {
        const atkDV = pkmn.Stats.itod(set.ivs.atk);
        // Gen 2 gender is calculated from the Atk DV.
        // High Atk DV <-> M. The meaning of "high" depends on the gender ratio.
        let genderThreshold = species.genderRatio!.F * 16;
        if (genderThreshold === 4) genderThreshold = 5;
        if (genderThreshold === 8) genderThreshold = 7;

        const expectedGender = (atkDV >= genderThreshold ? 'M' : 'F');
        if (set.gender !== expectedGender) {
          problems.push(
              `${pokemon} is ${set.gender}, but it has an Atk DV ` +
              `of ${atkDV}, which makes its gender ${expectedGender}.`);
        }
      }
    }

    // IVs
    let perfectIVs = 0;
    let maxedIVs = true;
    let stat: pkmn.Stat;
    for (stat in set.ivs) {
      const iv = set.ivs[stat];
      if (iv < 0 || iv > 31) {
        problems.push(`${pokemon}'s ${
            pkmn.Stats.display(stat)} IV must be between 0 and 31.`);
        maxedIVs = false;
      } else if (iv === 31) {
        perfectIVs++;
      } else {
        maxedIVs = false;
      }
    }
    if (format.gen >= 6) {
      if (isLegendary(species, set.shiny)) {
        if (perfectIVs < 3) {
          problems.push(
              `${pokemon} must have at least three perfect IVs ` +
              `because it's a legendary in generation ${format.gen}.`);
        }
      }
    } else if (format.gen < 3) {
      if (set.ivs.spa !== set.ivs.spd) {
        problems.push(
            `Before generation 3, SpA and SpD IVs must match ` +
            `(${pokemon} has ${set.ivs.spa} SpA and ${set.ivs.spd} SpD IVs).`);
      }
      if (format.gen === 2) {
        const dvs = pkmn.Stats.istods(set.ivs) as pkmn.StatsTable;

        const expectedHPDV = pkmn.Stats.getHPDV(set.ivs);
        if (dvs.hp !== expectedHPDV) {
          problems.push(
              `${pokemon} has an HP DV of ${dvs.hp}, but its ` +
              `Atk, Def, Spe and Spc DVs give it an HP DV of ${expectedHPDV}.`);
        }

        const expectedShiny =
            !!(dvs.def === 10 && dvs.spe === 10 && dvs.spa === 10 &&
               dvs.atk % 4 >= 2);
        if ((expectedShiny && !set.shiny) || (!expectedShiny && set.shiny)) {
          problems.push(
              `${pokemon} is${set.shiny ? ' not ' : ' '}shiny, ` +
              `which does not match its DVs.`);
        }
      }
    }

    // EVs
    let total = 0;
    for (stat in set.evs) {
      const ev = set.evs[stat];
      if (ev < 0 || ev > 255) {
        problems.push(`${pokemon}'s ${
            pkmn.Stats.display(stat)} EV must be between 0 and 255.`);
      }
      total += ev;
    }
    if (format.gen >= 3) {
      if (total > 510) {
        problems.push(`${pokemon} has more than 510 EVs.`);
      }
    } else {
      if (set.evs.spa !== set.evs.spd) {
        problems.push(
            `Before generation 3, SpA and SpD EVs must match ` +
            `(${pokemon} has ${set.evs.spa} SpA and ${set.evs.spd} SpD EVs).`);
      }
    }

    // Nature
    if (set.nature) {
      const nature = pkmn.Natures.get(set.nature);
      if (nature) {
        if (format.gen < 3) {
          problems.push(
              `Natures do not exist in generation ${format.gen} ` +
              `(${pokemon} has ${nature})`);
        }
      } else {
        if (format.gen >= 3) {
          problems.push(
              `${set.nature} is not a valid nature in ` +
              `generation ${format.gen}`);
        }
      }
    } else {
      if (format.gen >= 3) {
        problems.push(
            `${pokemon} requires a nature in generation ${format.gen}`);
      }
    }

    // Item
    if (format.gen >= 2) {
      const item = pkmn.Items.get(set.item, format.gen);
      if (set.item && !item) {
        problems.push(
            `${set.item} is not a valid item for generation ${format.gen}`);
      }
      if (item && rules.isBanned('Item', item.id)) {
        problems.push(
            `${item.name} is banned in generation ` +
            `${format.gen} ${format.tier}.`);
      }

      if (item && item.id === 'griseousorb' && species.num !== 487) {
        problems.push(
            'Griseous Orb can only be held by Giratina in Generation 4.');
      }
    } else {
      if (set.item) {
        problems.push(
            `Held items do not exist in generation ` +
            `${format.gen} (${pokemon} has item ${set.item})`);
      }
    }

    let isHidden = false; // TODO is this necessary?
    const learnsetData: PokemonSources = {
      sources: [],
      sourcesBefore: format.gen,
    };

    // Ability
    if (format.gen >= 3) {
      if (!set.ability) {
        problems.push(`${pokemon} needs to have an ability.`);
      }
      const ability = pkmn.Items.get(set.ability, format.gen);
      if (!ability) {
        problems.push(
            `${set.ability} is not a valid ability for ` +
            `generation ${format.gen}`);
      } else {
        if (rules.isBanned('Ability', ability.id)) {
          problems.push(
              `${ability.name} is banned in generation ` +
              `${format.gen} ${format.tier}.`);
        }
        const abilities = species.abilities!;
        if (!Object.values(abilities).includes(ability.name)) {
          problems.push(`${pokemon} can't have ${ability.name}.`);
        }

        if (ability.id === 'battlebond' && species.id === 'greninja' &&
            set.gender && set.gender !== 'M') {
          problems.push(`Battle Bond Greninja must be male.`);
        }

        if (ability.name === abilities['H']) {
          isHidden = true;

          const speciesName = pkmn.Species.getName(set.species)!;
          if (species.unreleasedHidden) {
            problems.push(`${pokemon}'s Hidden Ability is unreleased.`);
          } else if (
              format.gen === 6 &&
              (speciesName.endsWith('Orange') ||
               speciesName.endsWith('White')) &&
              ability.id === 'symbiosis') {
            problems.push(
                `${pokemon}'s Hidden Ability is unreleased for ` +
                `the Orange and White forms.`);
          } else if (
              format.gen === 5 && level < 10 &&
              (species.maleOnlyHidden || species.gender === 'N')) {
            problems.push(`${
                pokemon} must be at least level 10 with its Hidden Ability.`);
          }

          if (species.maleOnlyHidden) {
            if (set.gender && set.gender !== 'M') {
              problems.push(
                  `${pokemon} must be male to have its Hidden Ability.`);
            }
            learnsetData.sources = ['5D'];
          }
        }

        // Evasion Abilities Clause
        if (rules.clauses.has('Evasion Abilities') &&
            (ability.name === 'Sand Veil' || ability.name === 'Snow Cloak')) {
          problems.push(
              `${ability.name} is banned by Evasion Abilities Clause.`);
        }
        // Moody Clause
        if (rules.clauses.has('Moody') && ability.name === 'Moody') {
          problems.push(`${ability.name} is banned by Moody Clause.`);
        }
      }
    } else {
      if (set.ability) {
        problems.push(
            `Abilities do not exist in generation ${format.gen} ` +
            `(${pokemon} has ability ${set.ability})`);
      }
    }

    // let learnsetProblems = []; // TODO

    // Moves
    let hpTypeMove: pkmn.Type|undefined;
    if (set.moves.length) {
      if (set.moves.length > 4) {
        problems.push(`${pokemon} has more than four moves.`);
      }
      const moveTable: {[k: string]: pkmn.Move} = {};
      // BUG: Gen 2 Marowak w/ Swords Dance?
      for (const m of set.moves) {
        const move = pkmn.Moves.get(m, format.gen);
        if (!move) {
          problems.push(
              `${m} is not a valid move for generation ${format.gen}`);
          continue;
        }
        if (move.id.startsWith('hiddenpower') && move.type !== 'Normal') {
          hpTypeMove = move.type;
        }

        if (rules.isBanned('Move', move.id)) {
          problems.push(
              `${move.name} is banned in generation ` +
              `${format.gen} ${format.tier}.`);
        }
        if (moveTable[move.id]) {
          problems.push(
              `${pokemon} may not have duplicate moves ` +
              `(${move} is duplicated).`);
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

        /* TODO: ???
        let lsetProblem = checkLearnset(move, species, lsetData, set);
        if (lsetProblem) {
          lsetProblem.moveName = move.name;
          lsetProblems.push(lsetProblem);
          //break;
        }
        */
      }

      // Gen 2 Sleep Trapping
      if (format.gen === 2) {
        if (checkSleepTrap(moveTable)) {
          problems.push(
              `${pokemon} has both a sleeping and a trapping move, a ` +
              `combination which is banned in generation ${format.gen}.`);
        }
      }

      // Baton Pass Clause (partial)
      if (rules.clauses.has('Baton Pass') && moveTable['batonpass']) {
        if (checkBatonPass(set, format, moveTable)) {
          problems.push(
              `${pokemon} can Baton Pass both Speed and a different stat, ` +
              `which is banned by Baton Pass Clause.`);
        }
      }
    } else {
      problems.push(`${pokemon} must have at least one move.`);
    }

    // Hidden Power Type
    let hpTypeSet: pkmn.Type|undefined;
    if (set.hpType) {
      hpTypeSet = (set.hpType.charAt(0).toUpperCase() + set.hpType.slice(1)) as
          pkmn.Type;
      if (!pkmn.Types.hiddenPowerIVs(hpTypeSet!)) {
        problems.push(
            `${pokemon}'s Hidden Power type (${set.hpType}) is invalid.`);
      }
    }
    const hpType: pkmn.Type|undefined = hpTypeSet || hpTypeMove;
    if (hpType) {
      if (hpType !== hpTypeMove) {
        problems.push(
            `${pokemon}'s set Hidden Power type of ${
                set.hpType} does not match ` +
            `its move's Hidden Power type of ${hpTypeMove}.`);
      } else {
        const canBottleCap = (format.gen >= 7 && level === 100);
        const hpTypeIVs: pkmn.Type =
            pkmn.Types.hiddenPower(set.ivs, format.gen)!.type;
        if (!canBottleCap && hpTypeIVs !== hpType) {
          problems.push(
              `${pokemon} has Hidden Power ${hpType}, but its IVs are ` +
              `for Hidden Power ${hpTypeIVs}.`);
        }
        if (hpType === 'Fighting' && format.gen >= 6 &&
            isLegendary(species, set.shiny)) {
          problems.push(
              `${pokemon} must not have Hidden Power Fighting because it starts ` +
              `with 3 perfect IVs because it's a ${format.gen} legendary.`);
        }
      }
    }

    /* TODO *********************
    lsetData.isHidden = isHidden;
    let lsetProblems = this.reconcileLearnset(template, lsetData, lsetProblem, name);
    if (lsetProblems) problems.push(...lsetProblems);

    if (!lsetData.sourcesBefore && lsetData.sources.length && lsetData.sources.every(source => 'SVD'.includes(source.charAt(1)))) {
      // Every source is restricted
      let legal = false;
      for (const source of lsetData.sources) {
        if (this.validateSource(set, source, template)) continue;
        legal = true;
        break;
      }

      if (!legal) {
        if (lsetData.sources.length > 1) {
          problems.push(`${name} has an event-exclusive move that it doesn't qualify for (only one of several ways to get the move will be listed):`);
        }
        let eventProblems = this.validateSource(set, lsetData.sources[0], template, ` because it has a move only available`);
        // @ts-ignore validateEvent must have returned an array because it was passed a because param
        if (eventProblems) problems.push(...eventProblems);
      }
    } else if (ruleTable.has('-illegal') && template.eventOnly) {
      let eventTemplate = !template.learnset && template.baseSpecies !== template.species && template.id !== 'zygarde10' ? dex.getTemplate(template.baseSpecies) : template;
      const eventPokemon = eventTemplate.eventPokemon;
      if (!eventPokemon) throw new Error(`Event-only template ${template.species} has no eventPokemon table`);
      let legal = false;
      for (const eventData of eventPokemon) {
        if (this.validateEvent(set, eventData, eventTemplate)) continue;
        legal = true;
        break;
      }
      if (!legal && template.id === 'celebi' && dex.gen >= 7 && !this.validateSource(set, '7V', template)) {
        legal = true;
      }
      if (!legal) {
        if (eventPokemon.length === 1) {
          problems.push(`${template.species} is only obtainable from an event - it needs to match its event:`);
        } else {
          problems.push(`${template.species} is only obtainable from events - it needs to match one of its events, such as:`);
        }
        let eventInfo = eventPokemon[0];
        const minPastGen = (format.requirePlus ? 7 : format.requirePentagon ? 6 : 1);
        let eventNum = 1;
        for (const [i, eventData] of eventPokemon.entries()) {
          if (eventData.generation <= dex.gen && eventData.generation >= minPastGen) {
            eventInfo = eventData;
            eventNum = i + 1;
            break;
          }
        }
        let eventName = eventPokemon.length > 1 ? ` #${eventNum}` : ``;
        let eventProblems = this.validateEvent(set, eventInfo, eventTemplate, ` to be`, `from its event${eventName}`);
        // @ts-ignore validateEvent must have returned an array because it was passed a because param
        if (eventProblems) problems.push(...eventProblems);
      }
    }
    if (ruleTable.has('-illegal') && set.level < (template.evoLevel || 0)) {
      // FIXME: Event pokemon given at a level under what it normally can be attained at gives a false positive
      problems.push(`${name} must be at least level ${template.evoLevel} to be evolved.`);
    }
    if (ruleTable.has('-illegal') && template.id === 'keldeo' && set.moves.includes('secretsword') && (format.requirePlus || format.requirePentagon)) {
      problems.push(`${name} has Secret Sword, which is only compatible with Keldeo-Ordinary obtained from Gen 5.`);
    }
    if (!lsetData.sources && lsetData.sourcesBefore <= 3 && dex.getAbility(set.ability).gen === 4 && !template.prevo && dex.gen <= 5) {
      problems.push(`${name} has a gen 4 ability and isn't evolved - it can't use moves from gen 3.`);
    }
    if (!lsetData.sources && lsetData.sourcesBefore < 6 && lsetData.sourcesBefore >= 3 && (isHidden || dex.gen <= 5) && template.gen <= lsetData.sourcesBefore) {
      let oldAbilities = dex.mod('gen' + lsetData.sourcesBefore).getTemplate(set.species).abilities;
      if (ability.name !== oldAbilities['0'] && ability.name !== oldAbilities['1'] && !oldAbilities['H']) {
        problems.push(`${name} has moves incompatible with its ability.`);
      }
    }

    */// TODO **********************

    return problems;
  }
}

function isLegendary(s: Species, shiny?: boolean) {
  // We know s.eggGroups is defined because gen >= 6.
  return (s.eggGroups![0] === 'Undiscovered' || s.name === 'Manaphy') &&
      !s.prevo && !Species.nfe(s) && s.name !== 'Unown' &&
      s.baseSpecies !== 'Pikachu' && (s.baseSpecies !== 'Diancie' || !shiny);
}

function IDSet(...ids: string[]): Set<pkmn.ID> {
  return new Set(ids as pkmn.ID[]);
}

const SPEED_BOOST_ABILITIES =
    IDSet('motordrive', 'rattled', 'speedboost', 'steadfast', 'weakarmor');
const SPEED_BOOST_ITEMS =
    IDSet('blazikenite', 'eeviumz', 'kommoniumz', 'salacberry');
const NON_SPEED_BOOST_ABILITIES = IDSet(
    'angerpoint', 'competitive', 'defiant', 'download', 'justified',
    'lightningrod', 'moxie', 'sapsipper', 'stormdrain');
const NON_SPEED_BOOST_ITEMS = IDSet(
    'absorbbulb', 'apicotberry', 'cellbattery', 'eeviumz', 'ganlonberry',
    'keeberry', 'kommoniumz', 'liechiberry', 'luminousmoss', 'marangaberry',
    'petayaberry', 'snowball', 'starfberry', 'weaknesspolicy');
const NON_SPEED_BOOST_MOVES = IDSet(
    'acupressure', 'bellydrum', 'chargebeam', 'curse', 'diamondstorm',
    'fellstinger', 'fierydance', 'flowershield', 'poweruppunch', 'rage',
    'rototiller', 'skullbash', 'stockpile');

function checkBatonPass(
    set: pkmn.PokemonSet, format: pkmn.Format,
    moves: {[k: string]: pkmn.Move}): boolean {
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
      if (move.zMoveBoosts && move.zMoveBoosts.spe &&
          move.zMoveBoosts.spe > 0) {
        if (!speedBoosted) speedBoosted = move.name;
      }

      if (move.zMoveBoosts &&
          ((move.zMoveBoosts.atk && move.zMoveBoosts.atk > 0) ||
           (move.zMoveBoosts.def && move.zMoveBoosts.def > 0) ||
           (move.zMoveBoosts.spa && move.zMoveBoosts.spa > 0) ||
           (move.zMoveBoosts.spd && move.zMoveBoosts.spd > 0))) {
        if (!nonSpeedBoosted || move.name === speedBoosted) {
          nonSpeedBoosted = move.name;
        }
      }
    }
  }

  if (SPEED_BOOST_ABILITIES.has(ability) ||
      (item && SPEED_BOOST_ITEMS.has(item.id))) {
    speedBoosted = true;
  }
  if (!speedBoosted) return false;

  if (NON_SPEED_BOOST_ABILITIES.has(ability) ||
      (item && NON_SPEED_BOOST_ITEMS.has(item.id))) {
    nonSpeedBoosted = true;
  }
  if (!nonSpeedBoosted) return false;

  // true unless both boost sources are Z-moves, and they're distinct
  return !(
      speedBoosted !== nonSpeedBoosted && typeof speedBoosted === 'string' &&
      typeof nonSpeedBoosted === 'string');
}

const SLEEP_MOVES =
    IDSet('hypnosis', 'lovelykiss', 'sing', 'sleeppowder', 'spore');
const TRAP_MOVES = IDSet('meanlook', 'spiderweb');

function checkSleepTrap(moves: {[k: string]: pkmn.Move}): boolean {
  let sleep = false;
  let trap = false;
  for (const m in moves) {
    if (SLEEP_MOVES.has(moves[m].id)) {
      sleep = true;
    } else if (TRAP_MOVES.has(moves[m].id)) {
      trap = true;
    }
  }

  return sleep && trap;
}
