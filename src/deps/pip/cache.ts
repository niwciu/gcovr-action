import * as cache from "@actions/cache";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as io from "../../io";
import { initContext } from "./context";
import { showPackageInfo } from "./info";

export class PackageCacheInfoCacheInfo {
  name: string = "";
  key: string = "";
  path: string = "";

  constructor(packageName: string) {
    this.name = packageName;
    this.key = `pip-${os.type()}-${packageName}-cache-info`;
    const root = PackageCacheInfoCacheInfo.root();
    this.path = path.join(root, `${packageName}.json`);
  }

  static root(): string {
    return path.join(os.homedir(), ".pip_cache_info");
  }

  static createRoot() {
    const root = PackageCacheInfoCacheInfo.root();
    if (!fs.existsSync(root)) fs.mkdirSync(root);
  }
}

export class PackageCacheInfo {
  name: string = "";
  key: string = "";
  paths: string[] = [];
}

interface CacheInfo {
  paths: string[];
  key: string;
}

export async function getPackageCacheInfo(
  packageName: string
): Promise<PackageCacheInfo> {
  const cacheInfo = new PackageCacheInfo();
  cacheInfo.name = packageName;
  cacheInfo.key = `pip-${os.type()}-${packageName}`;
  cacheInfo.paths = await getPackageCachePaths(packageName);
  return cacheInfo;
}

async function getPackageCachePaths(packageName: string): Promise<string[]> {
  const packageInfo = await showPackageInfo(packageName);
  if (packageInfo === null) {
    throw new Error(
      `Could not get cache paths of unknown package: ${packageName}`
    );
  }
  const executables = await packageInfo.executables();
  let paths = executables.concat(packageInfo.directories());
  for (const dep of packageInfo.dependencies) {
    const depPaths = await getPackageCachePaths(dep);
    paths = paths.concat(depPaths);
  }
  return paths;
}

export async function savePackageCacheInfoCache(
  cacheInfo: PackageCacheInfoCacheInfo
) {
  const data = await getPackageCacheInfo(cacheInfo.name);
  PackageCacheInfoCacheInfo.createRoot();
  io.writeJson(cacheInfo.path, data);
  await cache.saveCache([cacheInfo.path], cacheInfo.key);
}

async function getCacheInfo(packageName: string): Promise<CacheInfo> {
  const context = await initContext();
  return {
    paths: [
      path.join(context.userSitePackage, `${packageName.toLowerCase()}*`),
      path.join(context.userSitePackage, `${packageName}*`),
    ],
    key: `pip-${os.type()}-${packageName}`,
  };
}

export async function cachePackage(packageName: string): Promise<void> {
  const info = await getCacheInfo(packageName);
  await cache.saveCache(info.paths, info.key);
}

export async function restorePackage(packageName: string): Promise<boolean> {
  const info = await getCacheInfo(packageName);
  const key = await cache.restoreCache(info.paths, info.key);
  return key !== undefined;
}
