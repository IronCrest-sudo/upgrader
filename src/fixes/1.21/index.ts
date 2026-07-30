import { Fix } from '../../Fix'
import { Pack } from '../../Pack'
import { functionFix, idPath, isObject, jsonFix, renameKey, replaceJsonStrings, walkJson } from '../Helpers'

function fixCondition(value: any) {
	if (!isObject(value)) return
	const condition = idPath(value.condition)
	if (condition === 'random_chance_with_looting') {
		const chance = typeof value.chance === 'number' ? value.chance : 0
		const multiplier = typeof value.looting_multiplier === 'number' ? value.looting_multiplier : 0
		value.condition = 'minecraft:random_chance_with_enchanted_bonus'
		value.enchantment = 'minecraft:looting'
		value.unenchanted_chance = chance
		value.enchanted_chance = {
			type: 'minecraft:linear',
			base: chance,
			per_level_above_first: multiplier,
		}
		delete value.chance
		delete value.looting_multiplier
	} else if (condition === 'random_chance_with_enchanted_bonus' && value.chance !== undefined) {
		value.unenchanted_chance = typeof value.chance === 'number' ? value.chance : 0
		value.enchanted_chance = value.chance
		delete value.chance
	}
}

const Json = jsonFix(({ data }) => {
	replaceJsonStrings(data, (value, key) => {
		if (key === 'entity') return ({ killer: 'attacker', direct_killer: 'direct_attacker', killer_player: 'attacking_player' } as Record<string, string>)[value] ?? value
		if (key === 'source') return ({ killer: 'attacking_entity', killer_player: 'last_damage_player' } as Record<string, string>)[value] ?? value
		if (value === 'minecraft:replace_disc') return 'minecraft:replace_disk'
		return value
	})
	walkJson(data, value => {
		if (!isObject(value)) return
		fixCondition(value)
		const functionType = idPath(value.function)
		if (functionType === 'enchanted_count_increase' && value.enchantment === undefined) value.enchantment = 'minecraft:looting'
		if (functionType === 'enchant_randomly') {
			renameKey(value, 'enchantments', 'options')
			if (value.only_compatible === undefined) value.only_compatible = true
		}
		if (functionType === 'enchant_with_levels') {
			if (value.options === undefined) value.options = value.treasure ? '#minecraft:on_random_loot' : '#minecraft:in_enchanting_table'
			delete value.treasure
		}
		if (value.enchantment !== undefined && value.levels !== undefined) renameKey(value, 'enchantment', 'enchantments')
	})
})

function modifierId(uuid: string) {
	return `upgrader:${uuid.toLowerCase().replace(/[^a-z0-9_.-]/g, '')}`
}

const Functions = functionFix((line, _file, ctx) => {
	let result = line
	result = result.replace(/(\battribute\s+\S+\s+\S+\s+modifier\s+add)\s+([0-9a-f-]{16,})\s+(?:"[^"]*"|\S+)\s+(\S+)\s+(\S+)/gi,
		(_match, prefix, uuid, amount, operation) => `${prefix} ${modifierId(uuid)} ${amount} ${operation}`)
	result = result.replace(/(\battribute\s+\S+\s+\S+\s+modifier\s+(?:remove|value get))\s+([0-9a-f-]{16,})/gi,
		(_match, prefix, uuid) => `${prefix} ${modifierId(uuid)}`)
	if (/\b(?:Attributes|AttributeModifiers)\s*:/.test(result)) {
		ctx.warn('Legacy attribute NBT was detected. UUID/name modifiers need a namespaced id; verify this command manually.')
	}
	return result
})

const Directories: Fix = async (pack, ctx) => Pack.useModernDirectories(pack, ctx)

export const Fixes21 = Fix.version('1.20.6', '1.21', Fix.groupProblems(
	Fix.packFormat(48),
	Directories,
	Json,
	Fix.when('functions', Functions),
))
