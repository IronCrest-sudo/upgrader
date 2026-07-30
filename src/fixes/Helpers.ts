import type { Fix, FixContext } from '../Fix'
import { categories, type Pack, type PackFile } from '../Pack'

export function namespaceId(id: string, namespace = 'minecraft') {
	return id.includes(':') ? id : `${namespace}:${id}`
}

export function idPath(id: unknown) {
	return typeof id === 'string' ? id.replace(/^minecraft:/, '') : undefined
}

export function renameKey(value: any, from: string, to: string) {
	if (!isObject(value) || value[from] === undefined || from === to) return
	if (value[to] === undefined) value[to] = value[from]
	delete value[from]
}

export function isObject(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Depth-first JSON visitor. The visitor may mutate the current value. */
export function walkJson(value: any, visitor: (value: any, parent?: any, key?: string | number) => void, parent?: any, key?: string | number) {
	visitor(value, parent, key)
	if (Array.isArray(value)) {
		value.forEach((child, index) => walkJson(child, visitor, value, index))
	} else if (isObject(value)) {
		Object.entries(value).forEach(([childKey, child]) => walkJson(child, visitor, value, childKey))
	}
}

export function replaceJsonStrings(value: any, replacer: (value: string, key?: string | number) => string) {
	walkJson(value, (child, parent, key) => {
		if (typeof child === 'string' && parent !== undefined && key !== undefined) {
			parent[key] = replacer(child, key)
		}
	})
}

export function jsonFix(fix: (file: PackFile, category: string, ctx: FixContext) => unknown): Fix {
	return async (pack, ctx) => {
		for (const category of categories) {
			const feature = category.startsWith('worldgen/') || category === 'dimension' || category === 'dimension_type'
				? 'worldgen'
				: category.startsWith('tags/') ? 'ids' : 'predicates'
			if (!ctx.config(feature)) continue
			for (const file of pack.data[category] ?? []) {
				if (file.error || file.deleted) continue
				const fileCtx: FixContext = {
					...ctx,
					warn: message => ctx.warn(message, [file.name]),
				}
				await fix(file, category, fileCtx)
			}
		}
	}
}

export function functionFix(fix: (line: string, file: PackFile, ctx: FixContext) => string): Fix {
	return async (pack, ctx) => {
		for (const file of pack.data.functions ?? []) {
			if (file.error || file.deleted || !Array.isArray(file.data)) continue
			const fileCtx: FixContext = {
				...ctx,
				warn: message => ctx.warn(message, [file.name]),
			}
			file.data = file.data.map((line: string) => fix(line, file, fileCtx))
		}
	}
}

export function allPackFiles(pack: Pack) {
	return Object.values(pack.data).flat().filter(file => !file.error && !file.deleted)
}

export function conditionList(value: any): any {
	if (!Array.isArray(value)) return value
	if (value.length === 0) return { type: 'minecraft:all_of', terms: [] }
	if (value.length === 1) return value[0]
	return { type: 'minecraft:all_of', terms: value }
}

export function mapObject(value: any, mapper: (key: string, value: any) => [string, any]) {
	if (!isObject(value)) return value
	return Object.fromEntries(Object.entries(value).map(([key, child]) => mapper(key, child)))
}
