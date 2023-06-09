import * as fs from 'node:fs';
import * as jsoncParser from 'jsonc-parser';
import * as chokidar from 'chokidar';
import { ENV, logger } from './util';

let pathCacheOptions = readCacheOptions();

if (ENV.STACKS_API_PROXY_CACHE_CONTROL_FILE) {
  chokidar
    .watch(ENV.STACKS_API_PROXY_CACHE_CONTROL_FILE, {
      persistent: false,
      useFsEvents: false,
      ignoreInitial: true,
    })
    .on('all', (_eventName, _path, _stats) => {
      pathCacheOptions = readCacheOptions();
    });
}

function readCacheOptions(): Map<RegExp, string | null> {
  const proxyCacheControlFile = ENV.STACKS_API_PROXY_CACHE_CONTROL_FILE;
  if (!proxyCacheControlFile) {
    return new Map();
  }
  logger.info(`Using cache config file: ${proxyCacheControlFile}`);

  try {
    const configContent: { paths: Record<string, string> } = jsoncParser.parse(
      fs.readFileSync(proxyCacheControlFile, 'utf8')
    );
    return new Map(
      Object.entries(configContent.paths).map(([k, v]) => [RegExp(k), v])
    );
  } catch (error) {
    logger.error(error, `Error reading changes from ${proxyCacheControlFile}`);
    return new Map();
  }
}

export function getCacheControlHeader(
  statusCode: number,
  url: string
): string | null {
  if (statusCode < 200 || statusCode > 299) {
    return null;
  }
  for (const [regexp, cacheControl] of pathCacheOptions.entries()) {
    if (cacheControl && regexp.test(url)) {
      return cacheControl;
    }
  }
  return null;
}
