import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, walkJson } from '../Helpers'

function predicate(value: any): any {
	if (Array.isArray(value)) return { type: 'minecraft:all_of', terms: value.map(predicate) }
	if (!isObject(value)) return value
	const condition = idPath(value.condition ?? value.type)
	if (condition === 'reference' && typeof value.name === 'string') return value.name
	if (value.condition !== undefined) renameKey(value, 'condition', 'type')
	const type = idPath(value.type)
	if ((type === 'all_of' || type === 'any_of') && value.terms !== undefined) {
		value.terms = Array.isArray(value.terms) ? value.terms.map(predicate) : predicate(value.terms)
	}
	if (type === 'inverted' && value.term !== undefined) value.term = predicate(value.term)
	if (type === 'block_state_property') {
		value.type = 'minecraft:match_block'
		renameKey(value, 'block', 'blocks')
		renameKey(value, 'properties', 'state')
	}
	return value
}

function modifier(value: any): any {
	if (Array.isArray(value)) return value.map(modifier)
	if (!isObject(value)) return value
	const functionType = idPath(value.function ?? value.type)
	if (functionType === 'reference' && typeof value.name === 'string') return value.name
	if (value.function !== undefined) renameKey(value, 'function', 'type')
	if (value.conditions !== undefined) {
		value.condition = predicate(value.conditions)
		delete value.conditions
	}
	if (functionType === 'sequence' && value.functions !== undefined) value.functions = modifier(value.functions)
	if (functionType === 'modify_contents' && value.modifier !== undefined) value.modifier = modifier(value.modifier)
	if (functionType === 'set_loot_table') renameKey(value, 'name', 'tag')
	return value
}

function entry(value: any) {
	if (!isObject(value)) return
	if (value.conditions !== undefined) {
		value.condition = predicate(value.conditions)
		delete value.conditions
	}
	if (value.functions !== undefined) {
		value.modifier = modifier(value.functions)
		delete value.functions
	}
	if (Array.isArray(value.children)) value.children.forEach(entry)
	const type = idPath(value.type)
	if (type === 'tag') renameKey(value, 'name', 'items')
}

function lootTable(data: any) {
	if (!isObject(data)) return
	if (data.functions !== undefined) {
		data.modifier = modifier(data.functions)
		delete data.functions
	}
	if (!Array.isArray(data.pools)) return
	data.pools.forEach((pool: any) => {
		if (!isObject(pool)) return
		if (pool.conditions !== undefined) {
			pool.condition = predicate(pool.conditions)
			delete pool.conditions
		}
		if (pool.functions !== undefined) {
			pool.modifier = modifier(pool.functions)
			delete pool.functions
		}
		if (Array.isArray(pool.entries)) pool.entries.forEach(entry)
	})
}

const AdvancementRenames: Record<string, Record<string, string>> = {
	bee_nest_destroyed: { block: 'blocks' },
	enter_block: { block: 'blocks' },
	slide_down_block: { block: 'blocks' },
	player_generates_container_loot: { loot_table: 'loot_tables' },
	crafter_recipe_crafted: { recipe_id: 'recipes' },
	recipe_crafted: { recipe_id: 'recipes' },
	recipe_unlocked: { recipe: 'recipes' },
}

function advancement(data: any) {
	if (!isObject(data?.criteria)) return
	Object.values(data.criteria).forEach((criterion: any) => {
		if (!isObject(criterion?.conditions)) return
		const trigger = idPath(criterion.trigger) ?? ''
		for (const [from, to] of Object.entries(AdvancementRenames[trigger] ?? {})) renameKey(criterion.conditions, from, to)
		for (const [key, value] of Object.entries(criterion.conditions)) {
			if (Array.isArray(value) && value.every(item => isObject(item) && (item.condition !== undefined || item.type !== undefined))) {
				criterion.conditions[key] = predicate(value)
			}
		}
	})
}

function mobSpawns(data: any) {
	if (!isObject(data) || (data.spawners === undefined && data.spawn_costs === undefined)) return
	const spawns: Record<string, any[]> = {}
	if (isObject(data.spawners)) {
		for (const [category, entries] of Object.entries(data.spawners)) {
			if (!Array.isArray(entries)) continue
			spawns[category] = entries.map(entry => {
				if (!isObject(entry)) return entry
				const min = entry.minCount ?? entry.min_count ?? 1
				const max = entry.maxCount ?? entry.max_count ?? min
				const result: any = { ...entry, count: min === max ? min : { type: 'minecraft:uniform', min_inclusive: min, max_inclusive: max } }
				delete result.minCount
				delete result.maxCount
				delete result.min_count
				delete result.max_count
				return result
			})
		}
	}
	const attributes = data.attributes ??= {}
	attributes['minecraft:gameplay/natural_mob_spawns'] = {
		spawns_by_category: spawns,
		spawn_costs: data.spawn_costs ?? {},
	}
	if (data.creature_spawn_probability !== undefined) attributes['minecraft:gameplay/creature_world_gen_spawn_probability'] = data.creature_spawn_probability
	delete data.spawners
	delete data.spawn_costs
	delete data.creature_spawn_probability
}

function noiseSettings(data: any, warn: (message: string) => unknown) {
	if (!isObject(data)) return
	const router = isObject(data.noise_router) ? data.noise_router : undefined
	if (router?.final_density !== undefined) {
		router.final_density = { type: 'minecraft:add', left: router.final_density, right: { type: 'minecraft:beardifier' } }
	} else if (data.final_density !== undefined) {
		data.final_density = { type: 'minecraft:add', left: data.final_density, right: { type: 'minecraft:beardifier' } }
	}
	if (data.aquifers_enabled) {
		data.aquifers = {
			barrier: router?.barrier ?? 0,
			fluid_level_floodedness: router?.fluid_level_floodedness ?? 0,
			fluid_level_spread: router?.fluid_level_spread ?? 0,
			lava: router?.lava ?? 0,
			surface_level: router?.preliminary_surface_level ?? data.preliminary_surface_level ?? 0,
			exclusion: 0,
		}
	}
	delete data.aquifers_enabled
	for (const field of ['barrier', 'fluid_level_floodedness', 'fluid_level_spread', 'lava']) if (router) delete router[field]
	if (data.ore_veins_enabled) warn('ore_veins_enabled now requires explicit ore_veins definitions; automatic vanilla-equivalent densities could not be inferred.')
	delete data.ore_veins_enabled
	for (const field of ['vein_toggle', 'vein_ridged', 'vein_gap']) if (router) delete router[field]
}

function densityFunction(value: any) {
	if (!isObject(value) || typeof value.type !== 'string') return
	let type = idPath(value.type)
	if (type === 'invert') {
		value.type = 'minecraft:reciprocal'
		type = 'reciprocal'
	}
	if (type === 'constant') renameKey(value, 'argument', 'value')
	if (['add', 'mul', 'min', 'max'].includes(type ?? '')) {
		renameKey(value, 'argument1', 'left')
		renameKey(value, 'argument2', 'right')
	}
	if (['abs', 'square', 'cube', 'half_negative', 'quarter_negative', 'squeeze', 'interpolated', 'flat_cache', 'cache_2d', 'cache_once', 'cache_all_in_cell', 'blend_density', 'reciprocal'].includes(type ?? '')) renameKey(value, 'argument', 'input')
	if (['shift_a', 'shift_b', 'shift'].includes(type ?? '')) renameKey(value, 'argument', 'noise')
}

const RemovedFeatures = new Set(['nether_forest_vegetation', 'twisting_vines', 'weeping_vines'])

const Json = jsonFix((file, category, ctx) => {
	const { data } = file
	if (category === 'loot_tables') lootTable(data)
	if (category === 'item_modifiers') file.data = modifier(data)
	if (category === 'predicates') file.data = predicate(data)
	if (category === 'advancements') advancement(data)
	if (category === 'worldgen/biome') mobSpawns(data)
	if (category === 'worldgen/noise_settings') noiseSettings(data, ctx.warn)
	if (category === 'villager_trade' && isObject(data)) renameKey(data, 'given_item_modifiers', 'given_item_modifier')
	if ((category === 'worldgen/feature' || category === 'worldgen/configured_feature') && RemovedFeatures.has(idPath(data.type) ?? '')) ctx.warn(`Feature type ${data.type} was removed and needs a replacement.`)
	walkJson(file.data, value => densityFunction(value))
})

const Functions = functionFix((line, _file, ctx) => {
	if (/\b(?:front_text|back_text)\s*:/.test(line) && /\bclick_event\s*:/.test(line) && !/\ballow_op_features\s*:/.test(line)) {
		ctx.warn('Sign click events no longer execute by default. Add allow_op_features:1b where that behavior is required.')
	}
	return line
})

export const Fixes263Snapshot4 = Fix.version('26.3-snapshot-3', '26.3-snapshot-4', Fix.groupProblems(
	Fix.packFormat([111, 0]),
	Json,
	Fix.when('functions', Functions),
))
