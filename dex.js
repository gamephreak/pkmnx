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



