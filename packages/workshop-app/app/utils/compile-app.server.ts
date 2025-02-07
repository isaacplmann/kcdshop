import fs from 'fs'
import path from 'path'
import { type CacheEntry } from '@epic-web/cachified'
import {
	getAppFromFile,
	modifiedTimes,
} from '@kentcdodds/workshop-utils/apps.server'
import {
	cachified,
	compiledCodeCache,
} from '@kentcdodds/workshop-utils/cache.server'
import { type Timings } from '@kentcdodds/workshop-utils/timing.server'
import * as esbuild from 'esbuild'

async function getForceFresh(
	filePath: string,
	cacheEntry: CacheEntry | null | undefined,
) {
	if (!cacheEntry) return true
	const app = await getAppFromFile(filePath)
	if (!app) return true
	const appModified = modifiedTimes.get(app.fullPath) ?? 0
	const cacheModified = cacheEntry.metadata.createdTime
	return !cacheModified || appModified > cacheModified || undefined
}

export async function compileTs(
	filePath: string,
	fullPath: string,
	{
		forceFresh,
		request,
		timings,
	}: { forceFresh?: boolean; request?: Request; timings?: Timings } = {},
) {
	const cacheEntry = compiledCodeCache.get(filePath)
	return cachified({
		key: `${filePath}::${fullPath}`,
		request,
		timings,
		forceFresh: forceFresh || (await getForceFresh(filePath, cacheEntry)),
		cache: compiledCodeCache,
		getFreshValue: async () => {
			const result = await esbuild.build({
				stdin: {
					contents: await fs.promises.readFile(filePath, 'utf-8'),
					// NOTE: if the fileAppName is specified, then we're resolving to a different
					// app than the one we're serving the file from. We do this so the tests
					// can live in the solution directory, but be run against the problem
					resolveDir: fullPath,
					sourcefile: path.basename(filePath),
					loader: 'tsx',
				},
				define: {
					'process.env': JSON.stringify({ NODE_ENV: 'development' }),
				},
				bundle: true,
				write: false,
				format: 'esm',
				platform: 'browser',
				jsx: 'automatic',
				minify: false,
				sourcemap: 'inline',
			})
			return result
		},
	})
}
