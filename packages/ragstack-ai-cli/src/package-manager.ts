/* eslint-disable import/no-extraneous-dependencies */
import spawn from 'cross-spawn'
import path from 'path'
import fs from "fs";

const {detect} = require("detect-package-manager");

export type PackageManager = 'npm' | 'yarn'

export async function getPackageManager(applicationPath: string): Promise<PackageManager> {
    const detected = await detect({cwd: applicationPath})
    if (detected !== 'yarn' && detected !== 'npm') {
        throw new Error('Unsupported package manager:' + detected + '. Supported package managers are npm and yarn.')
    }
    return detected
}

export async function getRemotePackageJson(
    packageName: string
): Promise<string> {
    return runCommand("npm", ['show', packageName, '--json'], true)
}

/**
 * Spawn a package manager installation based on user preference.
 *
 * @returns A Promise that resolves once the installation is finished.
 */
export async function install(
    applicationPath: string,
    packageManager: PackageManager
): Promise<string> {
    return runCommand(packageManager, ['install'], false, applicationPath)
}


export async function removeDependencies(
    applicationPath: string,
    packageManager: PackageManager,
    dependencies: Record<string, string>
): Promise<string> {
    const args = []
    const depsStr = Object.keys(dependencies).map((key) => key + "@" + dependencies[key])

    if (packageManager === 'yarn') {
        args.push('remove', ...depsStr)
    } else {
        args.push('uninstall', ...depsStr)
    }
    return runCommand(packageManager, args, false, applicationPath)
}


export async function addDependencies(
    applicationPath: string,
    packageManager: PackageManager,
    dependencies: Record<string, string>,
    dev: boolean,
): Promise<string> {
    const depsStr = Object.keys(dependencies).map((key) => key + "@" + dependencies[key])
    const args: string[] = []
    if (packageManager === 'yarn') {
        if (dev) {
            args.push('add', '-D', ...depsStr)
        } else {
            args.push('add', ...depsStr)
        }

    } else {
        if (dev) {
            args.push('install', '--save-dev', ...depsStr)
        } else {
            args.push('install', ...depsStr)
        }
    }

    return runCommand(packageManager, args, false, applicationPath)
}


export async function addOverrides(
    applicationPath: string,
    packageManager: PackageManager,
    dependencies: Record<string, string>
): Promise<string> {

    if (packageManager === 'yarn') {
        // not berry, proceed manually
        const packageJsonPath = path.resolve(applicationPath, "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        packageJson.resolutions = packageJson.resolutions || {}
        for (let dependenciesKey in dependencies) {
            // yarn berry
            packageJson.resolutions[dependenciesKey] = dependencies[dependenciesKey]
            // yarn classic
            packageJson.resolutions["**/" + dependenciesKey] = dependencies[dependenciesKey]
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")
        return install(applicationPath, packageManager)
    } else {
        const packageJsonPath = path.resolve(applicationPath, "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        packageJson.overrides = packageJson.overrides || {}
        packageJson.overrides = {
            ...packageJson.overrides,
            dependencies
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")
        return install(applicationPath, packageManager)
    }
}


function runCommand(packageManager: string, args: string[], catchOutput: boolean, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {

        const stdio = catchOutput ? 'pipe' : 'inherit'
        cwd = cwd || process.cwd()

        let data = ""
        let errData = ""

        const child = spawn(packageManager, args, {
            stdio,
            cwd,
            env: {
                ...process.env,
                ADBLOCK: '1',
                // we set NODE_ENV to development as pnpm skips dev
                // dependencies when production
                NODE_ENV: 'development',
                DISABLE_OPENCOLLECTIVE: '1',
            },
        })
        if (child.stdout) {
            child.stdout.on('data', function (newdata: string) {
                data += newdata
            });
        }
        if (child.stderr) {
            child.stderr.on('data', function (newdata: string) {
                errData += newdata
            });
        }
        child.on('close', (code) => {
            if (code !== 0) {
                console.error(errData)
                reject({command: `${packageManager} ${args.join(' ')}`})
                return
            }
            resolve(data.trim())
        })
    })
}
