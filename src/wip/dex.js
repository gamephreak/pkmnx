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
	sources: PokemonSource[]
	sourcesBefore: number
	babyOnly?: string
	sketchMove?: string
	hm?: string
	restrictiveMoves?: string[]
	limitedEgg?: (string | 'self')[]
	isHidden?: boolean
	fastCheck?: true
}





/**
 * Returns a sanitized format ID if valid, or throws if invalid.
 * @param {string} name
 */
validateFormat(name) {
  const [formatName, customRulesString] = name.split('@@@', 2);
  const format = this.getFormat(formatName);
  if (!format.exists) throw new Error(`Unrecognized format "${formatName}"`);
  if (!customRulesString) return format.id;
  const ruleTable = this.getRuleTable(format);
  const customRules = customRulesString.split(',').map(rule => {
    const ruleSpec = this.validateRule(rule);
    if (typeof ruleSpec === 'string' && ruleTable.has(ruleSpec)) return null;
    return rule.replace(/[\r\n|]*/g, '').trim();
  }).filter(rule => rule);
  if (!customRules.length) throw new Error(`The format already has your custom rules`);
  const validatedFormatid = format.id + '@@@' + customRules.join(',');
  const moddedFormat = this.getFormat(validatedFormatid, true);
  this.getRuleTable(moddedFormat);
  return validatedFormatid;
}
/**
 * @param {string | Format} [name]
 * @return {Format}
 */
getFormat(name, isTrusted = false) {
  if (name && typeof name !== 'string') {
    return name;
  }
  name = (name || '').trim();
  let id = toId(name);
  if (this.data.Aliases.hasOwnProperty(id)) {
    name = this.data.Aliases[id];
    id = toId(name);
  }
  if (this.data.Formats.hasOwnProperty('gen7' + id)) {
    id = 'gen7' + id;
  }
  let supplementaryAttributes = /** @type {AnyObject?} */ (null);
  if (name.includes('@@@')) {
    if (!isTrusted) {
      try {
        name = this.validateFormat(name);
        isTrusted = true;
      } catch (e) {}
    }
    let [newName, customRulesString] = name.split('@@@', 2);
    name = newName;
    id = toId(name);
    if (isTrusted && customRulesString) {
      supplementaryAttributes = {
        customRules: customRulesString.split(','),
        searchShow: false,
      };
    }
  }
  let effect;
  if (this.data.Formats.hasOwnProperty(id)) {
    let format = this.data.Formats[id];
    effect = new Data.Format({name}, format, supplementaryAttributes);
  } else {
    effect = new Data.Format({name, exists: false});
  }
  return effect;
}


/**
 * @param {Format} format
 * @param {number} [depth = 0]
 * @return {RuleTable}
 */
getRuleTable(format, depth = 0) {
  let ruleTable = new Data.RuleTable();
  if (format.ruleTable) return format.ruleTable;

  let ruleset = format.ruleset.slice();
  for (const ban of format.banlist) {
    ruleset.push('-' + ban);
  }
  for (const ban of format.unbanlist) {
    ruleset.push('+' + ban);
  }
  if (format.customRules) {
    for (const rule of format.customRules) {
      if (rule.startsWith('!')) {
        ruleset.unshift(rule);
      } else {
        ruleset.push(rule);
      }
    }
  }
  if (format.checkLearnset) {
    ruleTable.checkLearnset = [format.checkLearnset, format.name];
  }

  for (const rule of ruleset) {
    const ruleSpec = this.validateRule(rule, format);
    if (typeof ruleSpec !== 'string') {
      if (ruleSpec[0] === 'complexTeamBan') {
        /**@type {[string, string, number, string[]]} */
        // @ts-ignore
        let complexTeamBan = ruleSpec.slice(1);
        ruleTable.addComplexTeamBan(complexTeamBan[0], complexTeamBan[1], complexTeamBan[2], complexTeamBan[3]);
      } else if (ruleSpec[0] === 'complexBan') {
        /**@type {[string, string, number, string[]]} */
        // @ts-ignore
        let complexBan = ruleSpec.slice(1);
        ruleTable.addComplexBan(complexBan[0], complexBan[1], complexBan[2], complexBan[3]);
      } else {
        throw new Error(`Unrecognized rule spec ${ruleSpec}`);
      }
      continue;
    }
    if ("!+-".includes(ruleSpec.charAt(0))) {
      if (ruleSpec.charAt(0) === '+' && ruleTable.has('-' + ruleSpec.slice(1))) {
        ruleTable.delete('-' + ruleSpec.slice(1));
      }
      ruleTable.set(ruleSpec, '');
      continue;
    }
    const subformat = this.getFormat(ruleSpec);
    if (ruleTable.has('!' + subformat.id)) continue;
    ruleTable.set(subformat.id, '');
    if (!subformat.exists) continue;
    if (depth > 16) {
      throw new Error(`Excessive ruleTable recursion in ${format.name}: ${ruleSpec} of ${format.ruleset}`);
    }
    const subRuleTable = this.getRuleTable(subformat, depth + 1);
    for (const [k, v] of subRuleTable) {
      if (!ruleTable.has('!' + k)) ruleTable.set(k, v || subformat.name);
    }
    for (const [rule, source, limit, bans] of subRuleTable.complexBans) {
      ruleTable.addComplexBan(rule, source || subformat.name, limit, bans);
    }
    for (const [rule, source, limit, bans] of subRuleTable.complexTeamBans) {
      ruleTable.addComplexTeamBan(rule, source || subformat.name, limit, bans);
    }
    if (subRuleTable.checkLearnset) {
      if (ruleTable.checkLearnset) {
        throw new Error(`"${format.name}" has conflicting move validation rules from "${ruleTable.checkLearnset[1]}" and "${subRuleTable.checkLearnset[1]}"`);
      }
      ruleTable.checkLearnset = subRuleTable.checkLearnset;
    }
  }

  format.ruleTable = ruleTable;
  return ruleTable;
}

/**
 * @param {string} rule
 * @param {Format?} format
 */
validateRule(rule, format = null) {
  switch (rule.charAt(0)) {
    case '-':
    case '+':
      if (format && format.team) throw new Error(`We don't currently support bans in generated teams`);
      if (rule.slice(1).includes('>') || rule.slice(1).includes('+')) {
        let buf = rule.slice(1);
        const gtIndex = buf.lastIndexOf('>');
        let limit = rule.charAt(0) === '+' ? Infinity : 0;
        if (gtIndex >= 0 && /^[0-9]+$/.test(buf.slice(gtIndex + 1).trim())) {
          if (limit === 0) limit = parseInt(buf.slice(gtIndex + 1));
          buf = buf.slice(0, gtIndex);
        }
        let checkTeam = buf.includes('++');
        const banNames = buf.split(checkTeam ? '++' : '+').map(v => v.trim());
        if (banNames.length === 1 && limit > 0) checkTeam = true;
        const innerRule = banNames.join(checkTeam ? ' ++ ' : ' + ');
        const bans = banNames.map(v => this.validateBanRule(v));

        if (checkTeam) {
          return ['complexTeamBan', innerRule, '', limit, bans];
        }
        if (bans.length > 1 || limit > 0) {
          return ['complexBan', innerRule, '', limit, bans];
        }
        throw new Error(`Confusing rule ${rule}`);
      }
      return rule.charAt(0) + this.validateBanRule(rule.slice(1));
    default:
      let id = toId(rule);
      if (!this.data.Formats.hasOwnProperty(id)) {
        throw new Error(`Unrecognized rule "${rule}"`);
      }
      if (rule.charAt(0) === '!') return '!' + id;
      return id;
  }
}

/**
 * @param {string} rule
 */
validateBanRule(rule) {
  let id = toId(rule);
  if (id === 'unreleased') return 'unreleased';
  if (id === 'illegal') return 'illegal';
  const matches = [];
  let matchTypes = ['pokemon', 'move', 'ability', 'item', 'pokemontag'];
  for (const matchType of matchTypes) {
    if (rule.slice(0, 1 + matchType.length) === matchType + ':') {
      matchTypes = [matchType];
      id = id.slice(matchType.length);
      break;
    }
  }
  const ruleid = id;
  if (this.data.Aliases.hasOwnProperty(id)) id = toId(this.data.Aliases[id]);
  for (const matchType of matchTypes) {
    let table;
    switch (matchType) {
      case 'pokemon': table = this.data.Pokedex; break;
      case 'move': table = this.data.Movedex; break;
      case 'item': table = this.data.Items; break;
      case 'ability': table = this.data.Abilities; break;
      case 'pokemontag':
        // valid pokemontags
        const validTags = [
          // singles tiers
          'uber', 'ou', 'uubl', 'uu', 'rubl', 'ru', 'nubl', 'nu', 'publ', 'pu', 'zu', 'nfe', 'lcuber', 'lc', 'cap', 'caplc', 'capnfe',
          //doubles tiers
          'duber', 'dou', 'dbl', 'duu',
          // custom tags
          'mega',
        ];
        if (validTags.includes(ruleid)) matches.push('pokemontag:' + ruleid);
        continue;
      default:
        throw new Error(`Unrecognized match type.`);
    }
    if (table.hasOwnProperty(id)) {
      if (matchType === 'pokemon') {
        const template = table[id];
        // @ts-ignore
        if (template.otherFormes) {
          matches.push('basepokemon:' + id);
          continue;
        }
      }
      matches.push(matchType + ':' + id);
    } else if (matchType === 'pokemon' && id.slice(-4) === 'base') {
      id = id.slice(0, -4);
      if (table.hasOwnProperty(id)) {
        matches.push('pokemon:' + id);
      }
    }
  }
  if (matches.length > 1) {
    throw new Error(`More than one thing matches "${rule}"; please use something like "-item:metronome" to disambiguate`);
  }
  if (matches.length < 1) {
    throw new Error(`Nothing matches "${rule}"`);
  }
  return matches[0];
}



/**
 * @return {ModdedDex}
 */
includeFormats() {
  if (!this.isBase) throw new Error(`This should only be run on the base mod`);
  this.includeMods();
  if (this.formatsCache) return this;

  if (!this.formatsCache) this.formatsCache = {};

  // Load formats
  let Formats;
  try {
    Formats = require(FORMATS).Formats;
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND' && e.code !== 'ENOENT') {
      throw e;
    }
  }
  if (!Array.isArray(Formats)) throw new TypeError(`Exported property 'Formats' from "./config/formats.js" must be an array`);

  let section = '';
  let column = 1;
  for (const [i, format] of Formats.entries()) {
    let id = toId(format.name);
    if (format.section) section = format.section;
    if (format.column) column = format.column;
    if (!format.name && format.section) continue;
    if (!id) throw new RangeError(`Format #${i + 1} must have a name with alphanumeric characters, not '${format.name}'`);
    if (!format.section) format.section = section;
    if (!format.column) format.column = column;
    if (this.formatsCache[id]) throw new Error(`Format #${i + 1} has a duplicate ID: '${id}'`);
    format.effectType = 'Format';
    format.baseRuleset = format.ruleset ? format.ruleset.slice() : [];
    if (format.challengeShow === undefined) format.challengeShow = true;
    if (format.searchShow === undefined) format.searchShow = true;
    if (format.tournamentShow === undefined) format.tournamentShow = true;
    if (format.mod === undefined) format.mod = 'gen7';
    if (!dexes[format.mod]) throw new Error(`Format "${format.name}" requires nonexistent mod: '${format.mod}'`);
    this.formatsCache[id] = format;
  }

  return this;
}



/**
 * A RuleTable keeps track of the rules that a format has. The key can be:
 * - '[ruleid]' the ID of a rule in effect
 * - '-[thing]' or '-[category]:[thing]' ban a thing
 * - '+[thing]' or '+[category]:[thing]' allow a thing (override a ban)
 * [category] is one of: item, move, ability, species, basespecies
 * @augments {Map<string, string>}
 */
// @ts-ignore TypeScript bug
class RuleTable extends Map {
	constructor() {
		super();
		/**
		 * rule, source, limit, bans
		 * @type {[string, string, number, string[]][]}
		 */
		this.complexBans = [];
		/**
		 * rule, source, limit, bans
		 * @type {[string, string, number, string[]][]}
		 */
		this.complexTeamBans = [];
		/** @type {[Function, string]?} */
		this.checkLearnset = null;
	}
	/**
	 * @param {string} thing
	 * @param {{[id: string]: true}?} setHas
	 * @return {string}
	 */
	check(thing, setHas = null) {
		if (setHas) setHas[thing] = true;
		return this.getReason('-' + thing);
	}
	/**
	 * @param {string} key
	 * @return {string}
	 */
	getReason(key) {
		const source = this.get(key);
		if (source === undefined) return '';
		return source ? `banned by ${source}` : `banned`;
	}

	/**
	 * @param {[string, string, number, string[]][]} complexBans
	 * @param {string} rule
	 * @return {number}
	 */
	getComplexBanIndex(complexBans, rule) {
		let ruleId = toId(rule);
		let complexBanIndex = -1;
		for (let i = 0; i < complexBans.length; i++) {
			if (toId(complexBans[i][0]) === ruleId) {
				complexBanIndex = i;
				break;
			}
		}
		return complexBanIndex;
	}

	/**
	 * @param {string} rule
	 * @param {string} source
	 * @param {number} limit
	 * @param {string[]} bans
	 */
	addComplexBan(rule, source, limit, bans) {
		let complexBanIndex = this.getComplexBanIndex(this.complexBans, rule);
		if (complexBanIndex !== -1) {
			if (this.complexBans[complexBanIndex][2] === Infinity) return;
			this.complexBans[complexBanIndex] = [rule, source, limit, bans];
		} else {
			this.complexBans.push([rule, source, limit, bans]);
		}
	}

	/**
	 * @param {string} rule
	 * @param {string} source
	 * @param {number} limit
	 * @param {string[]} bans
	 */
	addComplexTeamBan(rule, source, limit, bans) {
		let complexBanTeamIndex = this.getComplexBanIndex(this.complexTeamBans, rule);
		if (complexBanTeamIndex !== -1) {
			if (this.complexTeamBans[complexBanTeamIndex][2] === Infinity) return;
			this.complexTeamBans[complexBanTeamIndex] = [rule, source, limit, bans];
		} else {
			this.complexTeamBans.push([rule, source, limit, bans]);
		}
	}
}

class Format extends BasicEffect {
	/**
	 * @param {AnyObject} data
	 * @param {?AnyObject} [moreData]
	 * @param {?AnyObject} [moreData2]
	 */
	constructor(data, moreData = null, moreData2 = null) {
		super(data, moreData, moreData2);
		/** @type {string} */
		this.mod = Tools.getString(this.mod) || 'gen7';
		/**
		 * Name of the team generator algorithm, if this format uses
		 * random/fixed teams. null if players can bring teams.
		 * @type {string | undefined}
		 */
		this.team = this.team;
		/** @type {'Format' | 'Ruleset' | 'Rule' | 'ValidatorRule'} */
		// @ts-ignore
		this.effectType = Tools.getString(this.effectType) || 'Format';
		/**
		 * Whether or not debug battle messages should be shown.
		 * @type {boolean}
		 */
		this.debug = !!this.debug;
		/**
		 * Whether or not a format will update ladder points if searched
		 * for using the "Battle!" button.
		 * (Challenge and tournament games will never update ladder points.)
		 * (Defaults to `true`.)
		 * @type {boolean}
		 */
		this.rated = (this.rated !== false);
		/**
		 * Game type.
		 * @type {GameType}
		 */
		this.gameType = this.gameType || 'singles';
		/**
		 * List of rule names.
		 * @type {string[]}
		 */
		this.ruleset = this.ruleset || [];
		/**
		 * Base list of rule names as specified in "./config/formats.js".
		 * Used in a custom format to correctly display the altered ruleset.
		 * @type {string[]}
		 */
		this.baseRuleset = this.baseRuleset || [];
		/**
		 * List of banned effects.
		 * @type {string[]}
		 */
		this.banlist = this.banlist || [];
		/**
		 * List of inherited banned effects to override.
		 * @type {string[]}
		 */
		this.unbanlist = this.unbanlist || [];
		/**
		 * List of ruleset and banlist changes in a custom format.
		 * @type {?string[]}
		 */
		this.customRules = this.customRules || null;
		/**
		 * Table of rule names and banned effects.
		 * @type {?RuleTable}
		 */
		this.ruleTable = null;
		/**
		 * The number of Pokemon players can bring to battle and
		 * the number that can actually be used.
		 * @type {{battle?: number, validate?: [number, number]} | undefined}
		 */
		this.teamLength = this.teamLength || undefined;
		/**
		 * An optional function that runs at the start of a battle.
		 * @type {(this: Battle) => void | undefined}
		 */
		this.onBegin = this.onBegin || undefined;

		/**
		 * If no team is selected, this format can generate a random team
		 * for the player.
		 * @type {boolean}
		 */
		this.canUseRandomTeam = !!this.canUseRandomTeam;
		/**
		 * Pokemon must be obtained from Gen 6 or later.
		 * @type {boolean}
		 */
		this.requirePentagon = !!this.requirePentagon;
		/**
		 * Pokemon must be obtained from Gen 7 or later.
		 * @type {boolean}
		 */
		this.requirePlus = !!this.requirePlus;
		/**
		 * Maximum possible level pokemon you can bring. Note that this is
		 * still 100 in VGC, because you can bring level 100 pokemon,
		 * they'll just be set to level 50. Can be above 100 in special
		 * formats.
		 * @type {number}
		 */
		this.maxLevel = this.maxLevel || 100;
		/**
		 * Default level of a pokemon without level specified. Mainly
		 * relevant to Custom Game where the default level is still 100
		 * even though higher level pokemon can be brought.
		 * @type {number}
		 */
		this.defaultLevel = this.defaultLevel || this.maxLevel;
		/**
		 * Forces all pokemon brought in to this level. Certain Game Freak
		 * formats will change level 1 and level 100 pokemon to level 50,
		 * which is what this does.
		 *
		 * You usually want maxForcedLevel instead, which will bring level
		 * 100 pokemon down, but not level 1 pokemon up.
		 * @type {number | undefined}
		 */
		this.forcedLevel = this.forcedLevel || undefined;
		/**
		 * Forces all pokemon above this level down to this level. This
		 * will allow e.g. level 50 Hydreigon in Gen 5, which is not
		 * normally legal because Hydreigon doesn't evolve until level
		 * 64.
		 * @type {number | undefined}
		 */
		this.maxForcedLevel = this.maxForcedLevel || undefined;

		/** @type {boolean} */
		this.noLog = !!this.noLog;
	}
}


