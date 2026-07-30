import { Fix } from '../../Fix'
import { isObject, jsonFix, renameKey, walkJson } from '../Helpers'

function itemStack(value: any) {
	return typeof value === 'string' ? { id: value } : value
}

function potDecorations(value: any) {
	if (!Array.isArray(value)) return value
	const [back, left, right, front] = value
	return Object.fromEntries(Object.entries({ back, left, right, front })
		.filter(([, item]) => item !== undefined)
		.map(([side, item]) => [side, itemStack(item)]))
}

const Json = jsonFix(({ data }, category) => {
	walkJson(data, value => {
		if (!isObject(value)) return
		for (const key of Object.keys(value)) {
			if (key.replace(/^minecraft:/, '') === 'pot_decorations') value[key] = potDecorations(value[key])
		}
		if (value.sherds !== undefined) value.sherds = potDecorations(value.sherds)
	})
	if (category === 'trim_material' && isObject(data)) {
		renameKey(data, 'asset_name', 'palette')
		delete data.override_armor_assets
	}
	if (category === 'instrument' && isObject(data) && data.use_duration === undefined) data.use_duration = 0
	if (category === 'worldgen/noise_settings' && isObject(data)) renameKey(data, 'surface_rule', 'material_rule')
	if (category === 'worldgen/configured_feature' && isObject(data) && isObject(data.config)) {
		Object.assign(data, data.config)
		delete data.config
	}
})

export const Fixes263Snapshot1 = Fix.version('26.2', '26.3-snapshot-1', Fix.groupProblems(
	Fix.packFormat([108, 0]),
	Json,
	Fix.when('worldgen', Fix.rename('worldgen/configured_feature', 'worldgen/feature')),
))
