import type { NbtCompound, NbtList } from 'deepslate'
import { NbtTag, StringReader } from 'deepslate'
import { collectComponents } from './Components'

function parseCompound(source: string) {
	const reader = new StringReader(source)
	reader.skipWhitespace()
	const tag = NbtTag.fromString(reader)
	reader.skipWhitespace()
	if (reader.canRead() || !tag.isCompound()) throw new Error('Expected one NBT compound')
	return tag
}

function componentString(components: NbtCompound) {
	const entries: string[] = []
	components.forEach((key, value) => {
		let result = value.toString()
		// These text components were strings containing JSON in 1.20.5.
		if (key === 'minecraft:custom_name') result = `'${value.getAsString().replaceAll("'", "\\'")}'`
		if (key === 'minecraft:lore' && value.isList()) {
			result = `[${(value as NbtList).map(entry => `'${entry.getAsString().replaceAll("'", "\\'")}'`).join(',')}]`
		}
		entries.push(`${key}=${result}`)
	})
	return `[${entries.join(',')}]`
}

function findCompoundEnd(line: string, start: number) {
	let depth = 0
	let quote = ''
	let escaped = false
	for (let index = start; index < line.length; index++) {
		const char = line[index]
		if (quote) {
			if (escaped) escaped = false
			else if (char === '\\') escaped = true
			else if (char === quote) quote = ''
			continue
		}
		if (char === '"' || char === "'") quote = char
		else if (char === '{') depth++
		else if (char === '}' && --depth === 0) return index
	}
	return -1
}

function isItemContext(prefix: string, item: string) {
	const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`(?:^|\\brun\\s+)give\\s+\\S+\\s+${escaped}$`).test(prefix)
		|| new RegExp(`(?:^|\\brun\\s+)clear\\s+\\S+\\s+${escaped}$`).test(prefix)
		|| new RegExp(`(?:^|\\brun\\s+)item\\s+.*\\swith\\s+${escaped}$`).test(prefix)
		|| new RegExp(`(?:^|\\brun\\s+)loot\\s+.*\\sgive\\s+${escaped}$`).test(prefix)
}

/** Converts legacy item{tag} arguments in commands into item[components].
 * The parser is deliberately limited to item-taking command positions so block
 * and entity NBT are never accidentally rewritten. */
export function convertLegacyItemNbt(line: string, warn: (message: string) => unknown) {
	const pattern = /(?:minecraft:)?[a-z0-9_.\/-]+(?=\{)/gi
	let offset = 0
	let result = line
	while (true) {
		pattern.lastIndex = offset
		const match = pattern.exec(result)
		if (!match) break
		const item = match[0]
		const braceStart = match.index + item.length
		if (!isItemContext(result.slice(0, braceStart), item)) {
			offset = braceStart + 1
			continue
		}
		const braceEnd = findCompoundEnd(result, braceStart)
		if (braceEnd < 0) {
			warn('Could not find the end of a legacy item NBT compound; it was left unchanged.')
			break
		}
		try {
			const tag = parseCompound(result.slice(braceStart, braceEnd + 1))
			const replacement = item + componentString(collectComponents(tag))
			result = result.slice(0, match.index) + replacement + result.slice(braceEnd + 1)
			offset = match.index + replacement.length
		} catch (error) {
			warn(`Could not convert legacy item NBT: ${error instanceof Error ? error.message : error}`)
			offset = braceEnd + 1
		}
	}
	return result
}
