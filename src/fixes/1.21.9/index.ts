import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, walkJson } from '../Helpers'

const Json = jsonFix(({ data }, category, ctx) => {
	if (category === 'worldgen/noise_settings' && isObject(data) && data.initial_density_without_jaggedness !== undefined) {
		renameKey(data, 'initial_density_without_jaggedness', 'preliminary_surface_level')
		ctx.warn('preliminary_surface_level is two-dimensional; verify that the migrated density function does not depend on Y.')
	}
	walkJson(data, value => {
		if (!isObject(value)) return
		if (idPath(value.type) === 'flash' && value.color === undefined) value.color = 0xFFFFFFFF
		if (isObject(value.respawn)) {
			renameKey(value.respawn, 'angle', 'yaw')
			value.respawn.yaw ??= 0
			value.respawn.pitch ??= 0
			if (value.respawn.dimension === undefined) ctx.warn('A respawn object is missing its now-required dimension field.')
		}
	})
})

const Functions = functionFix((line, _file, ctx) => {
	if (/\brespawn\s*:/.test(line) && !/\bdimension\s*:/.test(line)) ctx.warn('A player respawn object may need required dimension, yaw, and pitch fields.')
	return line
})

export const Fixes219 = Fix.version('1.21.8', '1.21.9', Fix.groupProblems(
	Fix.packFormat([88, 0]),
	Json,
	Fix.when('functions', Functions),
))
