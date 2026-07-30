import { Fix } from '../../Fix'
import { functionFix, isObject, jsonFix, replaceJsonStrings, walkJson } from '../Helpers'

function ingredient(value: any): any {
	if (Array.isArray(value)) return value.map(ingredient)
	if (!isObject(value)) return value
	if (typeof value.item === 'string' && Object.keys(value).length === 1) return value.item
	if (typeof value.tag === 'string' && Object.keys(value).length === 1) return `#${value.tag.replace(/^#/, '')}`
	return value
}

function attributeId(value: string) {
	const match = value.match(/^(minecraft:)?(?:generic|player|zombie)\.([a-z0-9_.-]+)$/)
	return match ? `minecraft:${match[2]}` : value
}

const Json = jsonFix(({ data }, category, ctx) => {
	replaceJsonStrings(data, value => {
		if (value === 'minecraft:damage_item') return 'minecraft:change_item_damage'
		return attributeId(value)
	})

	if (category === 'recipes' && isObject(data)) {
		if (Array.isArray(data.ingredients)) data.ingredients = data.ingredients.map(ingredient)
		if (isObject(data.key)) Object.keys(data.key).forEach(key => data.key[key] = ingredient(data.key[key]))
	}
	if (category === 'worldgen/biome' && isObject(data.carvers) && !Array.isArray(data.carvers)) {
		data.carvers = Object.values(data.carvers).flatMap(value => Array.isArray(value) ? value : [value])
	}

	walkJson(data, (value, _parent, key) => {
		if (!isObject(value)) return
		if ((key === 'type' || key === 'entity_type') && value.type === 'minecraft:boat') value.type = '#minecraft:boat'

		for (const [componentKey, component] of Object.entries(value)) {
			const path = componentKey.replace(/^minecraft:/, '')
			if (path === 'fire_resistant') {
				delete value[componentKey]
				value['minecraft:damage_resistant'] = { types: '#minecraft:is_fire' }
			}
			if (path === 'food' && isObject(component)) {
				const consumable: any = {}
				if (component.eat_seconds !== undefined) consumable.consume_seconds = component.eat_seconds
				if (component.effects !== undefined) consumable.on_consume_effects = component.effects
				if (Object.keys(consumable).length > 0) value['minecraft:consumable'] ??= consumable
				if (component.using_converts_to !== undefined) value['minecraft:use_remainder'] ??= component.using_converts_to
				delete component.eat_seconds
				delete component.effects
				delete component.using_converts_to
			}
		}
	})

	if (category === 'functions' && /\b(?:summon|data merge).*\bminecraft:(?:boat|chest_boat)\b/.test(String(data))) {
		ctx.warn('Generic boat entity IDs need a wood-specific replacement and could not be inferred.')
	}
})

const Functions = functionFix((line, _file, ctx) => {
	const result = line.replace(/\b(?:minecraft:)?(?:generic|player|zombie)\.([a-z0-9_.-]+)/g, 'minecraft:$1')
	if (/\bsummon\s+(?:minecraft:)?(?:boat|chest_boat)\b/.test(result)) {
		ctx.warn('Generic boat/chest_boat summon requires a wood-specific entity ID; it was left unchanged.')
	}
	return result
})

export const Fixes212 = Fix.version('1.21.1', '1.21.2', Fix.groupProblems(
	Fix.packFormat(57),
	Json,
	Fix.when('functions', Functions),
))
