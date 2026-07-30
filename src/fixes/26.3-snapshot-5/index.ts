import { Fix } from '../../Fix'
import { idPath, isObject, jsonFix } from '../Helpers'

const Json = jsonFix(({ data }, category) => {
	if ((category === 'worldgen/feature' || category === 'worldgen/configured_feature') && isObject(data) && idPath(data.type) === 'sculk_patch') {
		delete data.extra_rare_growths
		delete data.catalyst_chance
	}
})

export const Fixes263Snapshot5 = Fix.version('26.3-snapshot-4', '26.3-snapshot-5', Fix.groupProblems(
	Fix.packFormat([112, 0]),
	Json,
))
