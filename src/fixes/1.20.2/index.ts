import { Fix } from '../../Fix'
import { functionFix, jsonFix, replaceJsonStrings } from '../Helpers'

const RenameGameEvents = jsonFix(({ data }) => {
	replaceJsonStrings(data, value => value === 'minecraft:entity_roar' || value === 'minecraft:entity_shake' ? 'minecraft:entity_action' : value)
})

const Functions = functionFix(line => line
	.replace(/\bminecraft:entity_(?:roar|shake)\b/g, 'minecraft:entity_action')
	.replace(/\bentity_(?:roar|shake)\b/g, 'entity_action'))

export const Fixes202 = Fix.version('1.20', '1.20.2', Fix.groupProblems(
	Fix.packFormat(18),
	RenameGameEvents,
	Fix.when('functions', Functions),
))
