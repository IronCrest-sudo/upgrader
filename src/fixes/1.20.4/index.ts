import { Fix } from '../../Fix'
import { functionFix, jsonFix, replaceJsonStrings } from '../Helpers'

function renameGrass(value: string) {
	if (value === 'minecraft:grass') return 'minecraft:short_grass'
	if (value === 'grass') return 'short_grass'
	return value
}

const Json = jsonFix(({ data }) => replaceJsonStrings(data, renameGrass))
const Functions = functionFix(line => line
	.replace(/\bminecraft:grass\b/g, 'minecraft:short_grass')
	.replace(/(?<![:/a-z0-9_.-])grass(?![a-z0-9_.-])/gi, 'short_grass'))

export const Fixes204 = Fix.version('1.20.2', '1.20.4', Fix.groupProblems(
	Fix.packFormat(26),
	Json,
	Fix.when('functions', Functions),
))
