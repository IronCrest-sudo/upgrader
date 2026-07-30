import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, replaceJsonStrings, walkJson } from '../Helpers'

const BlockTagRenames: Record<string, string> = {
	dry_vegetation_may_place_on: 'supports_dry_vegetation',
	bamboo_plantable_on: 'supports_bamboo',
	small_dripleaf_placeable: 'supports_small_dripleaf',
	big_dripleaf_placeable: 'supports_big_dripleaf',
	mushroom_grow_block: 'overrides_mushroom_light_requirement',
	snow_layer_can_survive_on: 'support_override_snow_layer',
	snow_layer_cannot_survive_on: 'cannot_support_snow_layer',
}

function renameTag(value: string) {
	const match = value.match(/^#?(?:minecraft:)?([a-z0-9_./-]+)$/)
	if (!match || !BlockTagRenames[match[1]]) return value
	const prefix = value.startsWith('#') ? '#' : ''
	return `${prefix}minecraft:${BlockTagRenames[match[1]]}`
}

function belowTrunkProvider(provider: any) {
	return {
		type: 'minecraft:rule_based_state_provider',
		rules: [{
			if_true: {
				type: 'minecraft:not',
				predicate: { type: 'minecraft:matching_block_tag', tag: 'minecraft:cannot_replace_below_tree_trunk' },
			},
			then: provider ?? { type: 'minecraft:simple_state_provider', state: { Name: 'minecraft:dirt' } },
		}],
	}
}

const Json = jsonFix(({ data }, category, ctx) => {
	replaceJsonStrings(data, renameTag)
	walkJson(data, value => {
		if (!isObject(value)) return
		if (idPath(value.condition) === 'time_check' && value.clock === undefined) value.clock = 'minecraft:overworld'
	})

	if (category === 'test_environment' && isObject(data) && data.time_of_day !== undefined) {
		renameKey(data, 'time_of_day', 'clock_time')
		data.clock ??= 'minecraft:overworld'
	}
	if (category === 'recipes' && isObject(data)) {
		if (['stonecutting', 'smithing_transform', 'smithing_trim'].includes(idPath(data.type) ?? '')) delete data.group
		if (idPath(data.type) === 'crafting_special_mapcloning') {
			ctx.warn('crafting_special_mapcloning was removed. Converting it to crafting_transmute requires pack-specific ingredients.')
		}
	}
	if (category === 'worldgen/configured_feature' || category === 'worldgen/feature') {
		if (!isObject(data)) return
		const type = idPath(data.type)
		if (type === 'forest_rock') data.type = 'minecraft:block_blob'
		if (type === 'ice_spike') data.type = 'minecraft:spike'
		if (type === 'tree' && (data.force_dirt !== undefined || data.dirt_provider !== undefined)) {
			data.below_trunk_provider = belowTrunkProvider(data.dirt_provider)
			delete data.force_dirt
			delete data.dirt_provider
		}
		if (['flower', 'flower_no_bonemeal', 'random_patch'].includes(type ?? '')) {
			ctx.warn(`Feature type minecraft:${type} was removed and needs a pack-specific replacement.`)
		}
	}
})

const Functions = functionFix(line => {
	let result = line.replace(/\b(?:villager|piglin)\.(\*|\d+)\b/g, 'mob.inventory.$1')
	for (const [from, to] of Object.entries(BlockTagRenames)) {
		result = result.replace(new RegExp(`#minecraft:${from}\\b`, 'g'), `#minecraft:${to}`)
	}
	return result
})

export const Fixes261 = Fix.version('1.21.11', '26.1', Fix.groupProblems(
	Fix.packFormat([101, 1]),
	Json,
	Fix.when('functions', Functions),
))
