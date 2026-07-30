import { Fix } from '../../Fix'
import { idPath, isObject, jsonFix, renameKey } from '../Helpers'

const FeatureRenames: Record<string, string> = {
	basalt_columns: 'stepped_column_cluster',
	basalt_pillar: 'single_block_pillar',
	glowstone_blob: 'random_neighbor_spread',
}

const Json = jsonFix(({ data }, category, ctx) => {
	if ((category === 'worldgen/feature' || category === 'worldgen/configured_feature') && isObject(data)) {
		const type = idPath(data.type)
		if (type && FeatureRenames[type]) {
			data.type = `minecraft:${FeatureRenames[type]}`
			if (type === 'basalt_columns') renameKey(data, 'reach', 'column_reach')
			if (type === 'glowstone_blob') renameKey(data, 'xy_offset', 'xz_offset')
			ctx.warn(`minecraft:${type} was renamed and gained required configurable fields; defaults could not be inferred safely.`)
		}
	}
	if (category === 'worldgen/placed_feature' && Array.isArray(data.placement)) {
		data.placement.forEach((modifier: any) => {
			if (!isObject(modifier) || idPath(modifier.type) !== 'random_offset') return
			modifier.type = 'minecraft:offset'
			modifier.x = modifier.xz_spread
			modifier.z = modifier.xz_spread
			modifier.y = modifier.y_spread
			delete modifier.xz_spread
			delete modifier.y_spread
		})
	}
	if (category === 'worldgen/configured_carver' && isObject(data)) {
		const config = isObject(data.config) ? data.config : {}
		Object.assign(data, config)
		delete data.config
		const type = idPath(data.type)
		if (type === 'nether_cave') data.type = 'minecraft:cave'
		if (type === 'cave' || type === 'nether_cave') renameKey(data, 'yScale', 'room_vertical_radius_multiplier')
		if (type === 'canyon' && isObject(data.shape)) renameKey(data.shape, 'yScale', 'y_scale')
		delete data.replaceable
		delete data.lava_level
		delete data.debug_settings
		if (data.count === undefined) data.count = 1
		if (data.thickness === undefined) data.thickness = 1
	}
})

export const Fixes263Snapshot2 = Fix.version('26.3-snapshot-1', '26.3-snapshot-2', Fix.groupProblems(
	Fix.packFormat([109, 0]),
	Json,
	Fix.when('worldgen', Fix.rename('worldgen/configured_carver', 'worldgen/carver')),
))
