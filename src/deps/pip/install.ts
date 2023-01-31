import * as core from "@actions/core";
import * as exec from "../../exec";
import log from "../../log";
import { PackageInfo, showPackageInfo } from "./info";
import { cachePackage, restorePackage } from "./cache";

function validatePackageName(packageName: string): string {
  switch (packageName.toLowerCase()) {
    case "jinja2":
      return "Jinja2";
    case "pygments":
      return "Pygments";
  }
  return packageName;
}

async function installPackageDependencies(packageInfo: PackageInfo) {
  for (const dependency of packageInfo.dependencies) {
    await installPackage(dependency);
  }
}

export async function installPackage(packageName: string) {
  let pkgInfo = await showPackageInfo(packageName);
  if (pkgInfo === null) {
    packageName = validatePackageName(packageName);
    pkgInfo = await log.group(
      `Installing ${packageName} package...`,
      async (): Promise<PackageInfo> => {
        core.info(`Restoring ${packageName} package from cache...`);
        if (await restorePackage(packageName)) {
          core.info(`Done restoring ${packageName} package from cache`);
          core.info(`Validating ${packageName} package...`);
          const pkgInfo = await showPackageInfo(packageName);
          if (pkgInfo !== null) {
            core.info(`Package ${packageName} is valid`);
            return pkgInfo;
          }
          log.warning(
            `Invalid ${packageName} package. Cache probably is corrupted!`
          );
        }
        core.info(`Installing ${packageName} package using pip...`);
        await exec.exec("python3", [
          "-m",
          "pip",
          "install",
          "--user",
          "--no-deps",
          packageName,
        ]);
        core.info(`Saving ${packageName} package to cache...`);
        await cachePackage(packageName);
        core.info(`Validating ${packageName} package...`);
        const pkgInfo = await showPackageInfo(packageName);
        if (pkgInfo === null) {
          throw new Error(
            `Invalid ${packageName} package. Installation probably is corrupted!`
          );
        }
        core.info(`Package ${packageName} is valid`);
        return pkgInfo;
      }
    );
  }
  await installPackageDependencies(pkgInfo);
}
