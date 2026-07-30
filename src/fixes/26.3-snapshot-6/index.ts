import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, walkJson } from '../Helpers'

const Json = jsonFix(({ data }, category) => {
	if (category === 'worldgen/noise' && isObject(data)) {
		if (data.firstOctave !== undefined) {
			data.base_octave = data.firstOctave
			delete data.firstOctave
		}
		if (Array.isArray(data.amplitudes)) {
			data.octave_count = data.amplitudes.length
			data.amplitude_modifiers = data.amplitudes
			data.normalize = 'legacy'
			delete data.amplitudes
		}
		data.base_amplitude ??= 1
	}
	walkJson(data, value => {
		if (!isObject(value)) return
		const type = idPath(value.type)
		if (type === 'y_clamped_gradient') {
			value.type = 'minecraft:gradient'
			value.axis = 'y'
			value.tiling = 'clamp_to_edge'
		}
		if (type === 'end_islands') value.type = 'minecraft:end_outer_islands'
	})
})

const Functions = functionFix(line => line.replace(
	/(\bpublish\s+)(true|false)\s+(?:survival|creative|adventure|spectator)\s+(\d+)/g,
	'$1$2 $3',
))

export const Fixes263Snapshot6 = Fix.version('26.3-snapshot-5', '26.3-snapshot-6', Fix.groupProblems(
	Fix.packFormat([113, 0]),
	Json,
	Fix.when('functions', Functions),
))
