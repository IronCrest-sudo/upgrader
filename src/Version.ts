export type PackFormat = readonly [major: number, minor: number]

type VersionInfo = {
	format: PackFormat,
	display: string,
	snapshot?: boolean,
}

const Versions = {
	'1.16.5': { format: [6, 0], display: '1.16.3—1.16.5' },
	'1.17.1': { format: [7, 0], display: '1.17—1.17.1' },
	'21w44a': { format: [8, 0], display: '21w44a', snapshot: true },
	'1.18.1': { format: [8, 0], display: '1.18—1.18.1' },
	'1.18.2': { format: [9, 0], display: '1.18.2' },
	'1.19': { format: [10, 0], display: '1.19—1.19.2' },
	'1.19.3': { format: [10, 0], display: '1.19.3' },
	'1.19.4': { format: [12, 0], display: '1.19.4' },
	'1.20': { format: [15, 0], display: '1.20—1.20.1' },
	'1.20.2': { format: [18, 0], display: '1.20.2' },
	'1.20.4': { format: [26, 0], display: '1.20.3—1.20.4' },
	'1.20.6': { format: [41, 0], display: '1.20.5—1.20.6' },
	'1.21': { format: [48, 0], display: '1.21' },
	'1.21.1': { format: [48, 0], display: '1.21.1' },
	'1.21.2': { format: [57, 0], display: '1.21.2' },
	'1.21.3': { format: [57, 0], display: '1.21.3' },
	'1.21.4': { format: [61, 0], display: '1.21.4' },
	'1.21.5': { format: [71, 0], display: '1.21.5' },
	'1.21.6': { format: [80, 0], display: '1.21.6' },
	'1.21.7': { format: [81, 0], display: '1.21.7' },
	'1.21.8': { format: [81, 0], display: '1.21.8' },
	'1.21.9': { format: [88, 0], display: '1.21.9' },
	'1.21.10': { format: [88, 0], display: '1.21.10' },
	'1.21.11': { format: [94, 1], display: '1.21.11' },
	'26.1': { format: [101, 1], display: '26.1' },
	'26.1.1': { format: [101, 1], display: '26.1.1' },
	'26.1.2': { format: [101, 1], display: '26.1.2' },
	'26.2': { format: [107, 1], display: '26.2' },
	'26.3-snapshot-1': { format: [108, 0], display: '26.3 Snapshot 1', snapshot: true },
	'26.3-snapshot-2': { format: [109, 0], display: '26.3 Snapshot 2', snapshot: true },
	'26.3-snapshot-3': { format: [110, 0], display: '26.3 Snapshot 3', snapshot: true },
	'26.3-snapshot-4': { format: [111, 0], display: '26.3 Snapshot 4', snapshot: true },
	'26.3-snapshot-5': { format: [112, 0], display: '26.3 Snapshot 5', snapshot: true },
	'26.3-snapshot-6': { format: [113, 0], display: '26.3 Snapshot 6', snapshot: true },
} satisfies Record<string, VersionInfo>

export type Version = keyof typeof Versions
export const VersionKeys = Object.keys(Versions) as Version[]
export type VersionOrAuto = Version | 'auto'

export namespace Version {
	export const DEFAULT_SOURCE: VersionOrAuto = 'auto'
	export const DEFAULT_TARGET: Version = '26.2'

	export function packFormat(version: Version): PackFormat {
		return Versions[version].format
	}

	export function displayName(version: string): string {
		return VersionKeys.includes(version as Version) ? Versions[version as Version].display : version
	}

	export function ord(version: Version): number {
		return VersionKeys.indexOf(version)
	}

	export function order(before: Version, after: Version) {
		return ord(before) < ord(after)
	}

	export function atLeast(version: Version, minimum: Version) {
		return ord(version) >= ord(minimum)
	}

	export function includes(source: Version, target: Version, from: Version, to: Version) {
		return ord(source) < ord(to) && ord(target) > ord(from)
	}

	export function includesInclusive(source: Version, target: Version, from: Version, to: Version) {
		return ord(source) <= ord(to) && ord(target) >= ord(from)
	}

	export function isWorkInProgress(_source: Version, target: Version) {
		return (Versions[target] as VersionInfo).snapshot === true
	}

	export function samePackFormat(a: PackFormat, b: PackFormat) {
		return a[0] === b[0] && a[1] === b[1]
	}

	export function formatName(format: PackFormat) {
		return format[1] === 0 ? `${format[0]}` : `${format[0]}.${format[1]}`
	}

	export function parsePackFormat(value: unknown): PackFormat | undefined {
		if (typeof value === 'number' && Number.isFinite(value)) {
			const major = Math.trunc(value)
			const minor = Math.round((value - major) * 10)
			return [major, minor]
		}
		if (Array.isArray(value) && typeof value[0] === 'number') {
			return [value[0], typeof value[1] === 'number' ? value[1] : 0]
		}
		return undefined
	}

	export function readPackFormat(pack: Record<string, unknown>): PackFormat | undefined {
		return parsePackFormat(pack.max_format) ?? parsePackFormat(pack.pack_format) ?? parsePackFormat(pack.min_format)
	}

	export function writePackFormat(pack: Record<string, unknown>, format: PackFormat) {
		if (format[0] >= 82) {
			delete pack.pack_format
			delete pack.supported_formats
			pack.min_format = [format[0], format[1]]
			pack.max_format = [format[0], format[1]]
		} else {
			pack.pack_format = format[0]
			delete pack.min_format
			delete pack.max_format
		}
	}

	export function autoDetect(format: PackFormat): Version | undefined {
		// Formats 8 and 10 span releases that did contain data-pack changes without
		// a format bump. Choose the older safe boundary so those fixes are not
		// skipped. Newer duplicate formats only cover compatible hotfix releases.
		if (samePackFormat(format, [8, 0])) return '1.18.1'
		if (samePackFormat(format, [10, 0])) return '1.19'
		return [...VersionKeys].reverse().find(version => samePackFormat(packFormat(version), format) && !(Versions[version] as VersionInfo).snapshot)
			?? [...VersionKeys].reverse().find(version => samePackFormat(packFormat(version), format))
	}

	export function autoDetectOrFallback(format: PackFormat): Version {
		const detected = autoDetect(format)
		if (detected !== undefined) return detected
		if (format[0] < packFormat(VersionKeys[0])[0]) return VersionKeys[0]
		return VersionKeys[VersionKeys.length - 1]
	}
}
