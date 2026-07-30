import { Fix } from '../../Fix'
import { functionFix, isObject, jsonFix, replaceJsonStrings, walkJson } from '../Helpers'

const Json = jsonFix(({ data }, _category, ctx) => {
	replaceJsonStrings(data, value => value === '#minecraft:plays_ambient_desert_block_sounds'
		? '#minecraft:triggers_ambient_desert_sand_block_sounds'
		: value)
	walkJson(data, value => {
		if (!isObject(value)) return
		for (const [key, component] of Object.entries(value)) {
			if (key.replace(/^minecraft:/, '') === 'painting/variant' && isObject(component)) {
				ctx.warn('Inline painting variants are no longer accepted; create a painting_variant registry entry and reference its ID.')
			}
		}
	})
})

const Functions = functionFix(line => {
	let result = line.replace(/#minecraft:plays_ambient_desert_block_sounds\b/g, '#minecraft:triggers_ambient_desert_sand_block_sounds')
	if (/\barea_effect_cloud\b/.test(result)) result = result.replace(/\bParticle\s*:/g, 'custom_particle:')
	return result
})

export const Fixes216 = Fix.version('1.21.5', '1.21.6', Fix.groupProblems(
	Fix.packFormat(80),
	Json,
	Fix.when('functions', Functions),
))
