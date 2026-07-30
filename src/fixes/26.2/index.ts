import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, replaceJsonStrings, walkJson } from '../Helpers'

const EntityPredicateFields = new Set([
	'entity', 'player', 'parent', 'partner', 'child', 'villager', 'zombie', 'projectile', 'shooter',
	'bystander', 'lightning', 'source_entity', 'direct_entity', 'vehicle', 'passenger', 'targeted_entity',
])

function convertEntityPredicate(value: any) {
	if (!isObject(value)) return
	if (value.type !== undefined) {
		value['minecraft:entity_type'] = value.type
		delete value.type
	}
	if (isObject(value.type_specific)) {
		const specific = value.type_specific
		const type = idPath(specific.type)
		if (type) {
			const renamed = type === 'slime' ? 'slime' : type
			const payload = { ...specific }
			delete payload.type
			value[`minecraft:type_specific/${renamed}`] = payload
		}
		delete value.type_specific
	}
	for (const key of ['vehicle', 'passenger', 'targeted_entity']) convertEntityPredicate(value[key])
	const player = value['minecraft:type_specific/player']
	if (isObject(player?.looking_at)) convertEntityPredicate(player.looking_at)
}

function configuredFeature(data: any, ctx: { warn: (message: string) => unknown }) {
	if (!isObject(data)) return
	const type = idPath(data.type)
	if (type === 'pointed_dripstone') data.type = 'minecraft:speleothem'
	if (type === 'dripstone_cluster') data.type = 'minecraft:speleothem_cluster'
	if (type === 'multiface_growth' && data.block === undefined) data.block = 'minecraft:glow_lichen'
	if (type === 'tree' && data.below_trunk_provider === undefined) {
		data.below_trunk_provider = {
			type: 'minecraft:rule_based_state_provider',
			rules: [{
				if_true: { type: 'minecraft:not', predicate: { type: 'minecraft:matching_block_tag', tag: 'minecraft:cannot_replace_below_tree_trunk' } },
				then: { type: 'minecraft:simple_state_provider', state: { Name: 'minecraft:dirt' } },
			}],
		}
	}
	if (type === 'large_dripstone' && isObject(data.column_radius) && typeof data.column_radius.max_inclusive === 'number' && data.column_radius.max_inclusive > 16) {
		data.column_radius.max_inclusive = 16
		ctx.warn('large_dripstone column_radius was clamped to the new maximum of 16.')
	}
}

const Json = jsonFix(({ data }, category, ctx) => {
	replaceJsonStrings(data, value => {
		if (value === '#minecraft:concrete_powder') return '#minecraft:concrete_powders'
		if (value === 'minecraft:nameplate_distance') return 'minecraft:name_tag_distance'
		return value
	})
	if (category === 'worldgen/configured_feature' || category === 'worldgen/feature') configuredFeature(data, ctx)

	walkJson(data, (value, parent, key) => {
		if (!isObject(value)) return
		if (isObject(parent) && typeof key === 'string' && EntityPredicateFields.has(key)) convertEntityPredicate(value)
		if (idPath(value.condition) === 'entity_properties' && isObject(value.predicate)) convertEntityPredicate(value.predicate)
		if (idPath(value.type) === 'weird_scaled_sampler') ctx.warn('weird_scaled_sampler was removed; replace it with an interval_select density function.')
		if (idPath(value.type) === 'noise_gradient') ctx.warn('noise_gradient surface rules were removed; replace them with noise_threshold and set is_3d explicitly.')
	})
})

const Functions = functionFix(line => line
	.replace(/#minecraft:concrete_powder\b/g, '#minecraft:concrete_powders')
	.replace(/\bminecraft:nameplate_distance\b/g, 'minecraft:name_tag_distance'))

export const Fixes262 = Fix.version('26.1.2', '26.2', Fix.groupProblems(
	Fix.packFormat([107, 1]),
	Json,
	Fix.when('functions', Functions),
))
