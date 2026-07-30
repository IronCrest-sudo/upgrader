import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, replaceJsonStrings, walkJson } from '../Helpers'

const RemovedFeatures = new Set(['coral_mushroom', 'kelp', 'seagrass', 'sea_pickle'])

const Json = jsonFix(({ data }, category, ctx) => {
	replaceJsonStrings(data, value => value === '#minecraft:dowses_campfires' ? '#minecraft:douses_campfires' : value)
	walkJson(data, value => {
		if (!isObject(value)) return
		for (const key of Object.keys(value)) {
			if (key.replace(/^minecraft:/, '') === 'potion_contents' && !isObject(value[key])) value[key] = { potions: value[key] }
		}
		if (isObject(value.attributes) && isObject(value.attributes['minecraft:gameplay/bed_rule'])) {
			renameKey(value.attributes['minecraft:gameplay/bed_rule'], 'explodes', 'destroy_on_use')
		}
		if (isObject(value['minecraft:gameplay/bed_rule'])) renameKey(value['minecraft:gameplay/bed_rule'], 'explodes', 'destroy_on_use')
		if (idPath(value.type) === 'copy_properties_provider') renameKey(value, 'source_block_state_provider', 'source')
	})
	if ((category === 'worldgen/feature' || category === 'worldgen/configured_feature') && RemovedFeatures.has(idPath(data.type) ?? '')) {
		ctx.warn(`Feature type ${data.type} was removed and needs a pack-specific replacement.`)
	}
})

const Functions = functionFix(line => line.replace(/#minecraft:dowses_campfires\b/g, '#minecraft:douses_campfires'))

export const Fixes263Snapshot3 = Fix.version('26.3-snapshot-2', '26.3-snapshot-3', Fix.groupProblems(
	Fix.packFormat([110, 0]),
	Json,
	Fix.when('functions', Functions),
))
