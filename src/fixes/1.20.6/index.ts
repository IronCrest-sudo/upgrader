import { Fix } from '../../Fix'
import { convertLegacyItemNbt } from '../../nbt/LegacyItem'
import { functionFix, idPath, isObject, jsonFix, renameKey, replaceJsonStrings, walkJson } from '../Helpers'

const ItemPredicateKeys = new Set(['item', 'tool', 'mainhand', 'offhand', 'head', 'chest', 'legs', 'feet'])

function fixItemPredicate(predicate: any) {
	if (!isObject(predicate)) return
	if (typeof predicate.tag === 'string') {
		predicate.items = `#${predicate.tag.replace(/^#/, '')}`
		delete predicate.tag
	}
	renameKey(predicate, 'potion', 'potions')
	renameKey(predicate, 'nbt', 'custom_data')
	const subPredicates = predicate.predicates ??= {}
	for (const key of ['durability', 'enchantments', 'stored_enchantments', 'potions', 'custom_data']) {
		if (predicate[key] !== undefined) {
			const target = key === 'durability' ? 'damage' : key === 'potions' ? 'potion_contents' : key
			subPredicates[`minecraft:${target}`] = predicate[key]
			delete predicate[key]
		}
	}
	if (Object.keys(subPredicates).length === 0) delete predicate.predicates
}

function fixRecipe(data: any) {
	if (!isObject(data)) return
	if (['smelting', 'blasting', 'smoking', 'campfire_cooking'].includes(idPath(data.type) ?? '') && typeof data.result === 'string') {
		data.result = { id: data.result }
	}
}

function fixJsonObject(data: any, category: string) {
	walkJson(data, (value, _parent, key) => {
		if (!isObject(value)) return

		// Int/float providers no longer have a {type, value:{...}} wrapper.
		if (typeof value.type === 'string' && isObject(value.value)
			&& ['uniform', 'biased_to_bottom', 'clamped_normal', 'trapezoid'].includes(idPath(value.type) ?? '')) {
			Object.assign(value, value.value)
			delete value.value
		}

		const functionType = idPath(value.function)
		if (functionType === 'set_nbt') value.function = 'minecraft:set_custom_data'
		if (functionType === 'copy_nbt') value.function = 'minecraft:copy_custom_data'
		if (functionType === 'set_contents') {
			if (typeof value.type === 'string') value.component = value.type.replace(/^minecraft:/, '')
			delete value.type
		}
		if (functionType === 'set_attributes' && Array.isArray(value.modifiers)) {
			value.modifiers.forEach((modifier: any) => {
				if (!isObject(modifier)) return
				modifier.operation = ({ addition: 'add_value', multiply_base: 'add_multiplied_base', multiply_total: 'add_multiplied_total' } as Record<string, string>)[modifier.operation] ?? modifier.operation
			})
		}
		if (functionType === 'set_lore' && value.replace !== undefined) {
			value.mode = value.replace ? 'replace_all' : 'append'
			delete value.replace
		}
		if (functionType === 'copy_components' && Array.isArray(value.components)) {
			value.include = value.components
			delete value.components
		}

		if (idPath(value.type) === 'loot_table' && value.name !== undefined) renameKey(value, 'name', 'value')

		if (typeof key === 'string' && ItemPredicateKeys.has(key)) fixItemPredicate(value)
		if (idPath(value.condition) === 'match_tool') fixItemPredicate(value.predicate)
		if (isObject(value.item) && (category === 'advancements' || category === 'predicates' || category === 'loot_tables')) fixItemPredicate(value.item)
		if (isObject(value.block) && typeof value.block.tag === 'string') {
			value.block.blocks = `#${value.block.tag.replace(/^#/, '')}`
			delete value.block.tag
		}
		if (isObject(value.fluid)) renameKey(value.fluid, 'fluid', 'fluids')
		if (isObject(value.location)) {
			renameKey(value.location, 'biome', 'biomes')
			renameKey(value.location, 'structure', 'structures')
		}

		for (const [componentKey, componentValue] of Object.entries(value)) {
			if (componentKey.replace(/^minecraft:/, '') === 'food' && isObject(componentValue) && typeof componentValue.saturation_modifier === 'number' && typeof componentValue.nutrition === 'number') {
				componentValue.saturation = componentValue.nutrition * componentValue.saturation_modifier * 2
				delete componentValue.saturation_modifier
			}
		}
	})

	if (category === 'recipes') fixRecipe(data)
}

const Json = jsonFix(({ data }, category) => {
	replaceJsonStrings(data, value => {
		if (value === 'minecraft:sweeping') return 'minecraft:sweeping_edge'
		if (value === 'minecraft:horse.jump_strength') return 'minecraft:generic.jump_strength'
		return value
	})
	fixJsonObject(data, category)
})

function particleSyntax(line: string) {
	line = line.replace(/\bparticle\s+dust\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/g,
		'particle dust{color:[$1,$2,$3],scale:$4}')
	line = line.replace(/\bparticle\s+dust_color_transition\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/g,
		'particle dust_color_transition{from_color:[$1,$2,$3],scale:$4,to_color:[$5,$6,$7]}')
	line = line.replace(/\bparticle\s+(sculk_charge|shriek)\s+(-?[\d.]+)/g, (_match, type, value) =>
		`particle ${type}{${type === 'shriek' ? 'delay' : 'roll'}:${value}}`)
	line = line.replace(/\bparticle\s+item\s+((?:minecraft:)?[a-z0-9_./-]+)/g, 'particle item{item:"$1"}')
	return line
}

const Functions = functionFix((line, _file, ctx) => {
	let result = convertLegacyItemNbt(line, ctx.warn)
	result = particleSyntax(result)
	result = result
		.replace(/\bminecraft:sweeping\b/g, 'minecraft:sweeping_edge')
		.replace(/\bminecraft:horse\.jump_strength\b/g, 'minecraft:generic.jump_strength')
		.replace(/(\battribute\s+\S+\s+\S+\s+modifier\s+add\s+\S+\s+\S+\s+\S+\s+)addition\b/g, '$1add_value')
		.replace(/(\battribute\s+\S+\s+\S+\s+modifier\s+add\s+\S+\s+\S+\s+\S+\s+)multiply_base\b/g, '$1add_multiplied_base')
		.replace(/(\battribute\s+\S+\s+\S+\s+modifier\s+add\s+\S+\s+\S+\s+\S+\s+)multiply\b/g, '$1add_multiplied_total')
	const effect = result.match(/\beffect\s+give\s+\S+\s+\S+\s+\S+\s+(\d+)/)
	if (effect && Number(effect[1]) > 127) ctx.warn('Effect amplifiers above 127 cannot be preserved and require manual redesign.')
	return result
})

export const Fixes206 = Fix.version('1.20.4', '1.20.6', Fix.groupProblems(
	Fix.packFormat(41),
	Json,
	Fix.when('functions', Functions),
))
