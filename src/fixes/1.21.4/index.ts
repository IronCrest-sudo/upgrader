import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, walkJson } from '../Helpers'

const Json = jsonFix(({ data }, category, ctx) => {
	if (category === 'worldgen/biome' && isObject(data.effects) && isObject(data.effects.music)) {
		data.effects.music = [{ data: data.effects.music, weight: 1 }]
	}
	if (category === 'trim_material' && isObject(data)) delete data.item_model_index

	walkJson(data, value => {
		if (!isObject(value)) return
		if (idPath(value.type) === 'trail' && value.duration === undefined) {
			value.duration = 20
			ctx.warn('A trail particle had no duration. A 20-tick duration was added; verify the intended timing.')
		}

		for (const [key, component] of Object.entries(value)) {
			const path = key.replace(/^minecraft:/, '')
			if (path === 'equippable' && isObject(component)) renameKey(component, 'model', 'asset_id')
			if (path === 'custom_model_data' && typeof component === 'number') value[key] = { floats: [component] }
		}

		if (idPath(value.function) === 'set_custom_model_data' && value.value !== undefined) {
			value.floats = { values: [value.value], mode: 'replace_all' }
			delete value.value
		}
	})
})

const Functions = functionFix(line => line
	.replace(/\bcustom_model_data\s*=\s*(-?[\d.]+)(?![\d.])/g, 'custom_model_data={floats:[$1]}')
	.replace(/\bTNTFuse\s*:/g, 'fuse:')
	.replace(/\bCookTimeTotal\s*:/g, 'cooking_total_time:')
	.replace(/\bCookTime\s*:/g, 'cooking_time_spent:')
	.replace(/\bBurnTime\s*:/g, 'lit_time_remaining:'))

export const Fixes214 = Fix.version('1.21.3', '1.21.4', Fix.groupProblems(
	Fix.packFormat(61),
	Json,
	Fix.when('functions', Functions),
))
