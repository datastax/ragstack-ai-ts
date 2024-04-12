#!/usr/bin/env node

import {Command} from 'commander'
import path from 'path'
import {
    addDependencies, addOverrides,
    getPackageManager,
    getRemotePackageJson,
    removeDependencies
} from './package-manager.js'
import fs from 'fs'
import {LIB_VERSION} from "./version.js";
import chalk from "chalk";


export async function main(mainOptions: { args?: string[], handleSigTerm: () => void, onError: () => void }) {


    process.on('SIGINT', mainOptions.handleSigTerm)
    process.on('SIGTERM', mainOptions.handleSigTerm)

    const command = new Command()
    command.name("ragstack-ai")
        .description("Manage RAGStack dependencies in your project")
        .version(LIB_VERSION)
    command.command("install")
        .alias("i")
        .argument("[<version>]", "Ragstack version to install. If not provided, the latest version will be installed.")
        .option(
            '--path [path]',
            `

  Project path. Default is the current directory.
`
        )
        .option(
            '--use-npm',
            `

  Explicitly tell the CLI to bootstrap the application using npm
`
        )
        .option(
            '--use-yarn',
            `

  Explicitly tell the CLI to bootstrap the application using Yarn
`
        )
        .action(async (version: string, options: {
            path: string,
            useNpm: boolean,
            usePnpm: boolean,
            useYarn: boolean
        }) => {
            try {
                await executeInstall(version, options)
            } catch (e: unknown) {
                console.error(e)
                mainOptions.onError()
            }

        });

    if (mainOptions.args) {
        return command.parseAsync(mainOptions.args, {from: "user"})
    } else {
        return command.parseAsync()
    }
}

function log(msg: string) {
    console.log(chalk.magenta("➤ ragstack-ai: ") + msg)
}
async function executeInstall(version: string, options: {
    path: string,
    useNpm: boolean,
    usePnpm: boolean,
    useYarn: boolean
}) {

    const projectPath = options.path || process.cwd()
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`\nPlease initialize the project at ${chalk.cyan(projectPath)} with your favourite package manager.`)
    }
    const packageManager = options.useNpm ? 'npm' : options.useYarn ? 'yarn' : await getPackageManager(projectPath)
    log(`using ${chalk.cyan(packageManager)} as the package manager.`)
    let versionForNPM = version || ""
    if (versionForNPM) {
        versionForNPM = "@" + versionForNPM
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const appName = packageJson.name
    log(`setting up ragstack dependencies for project ${chalk.cyan(appName)}.`)

    const remotePackageJson = await getRemotePackageJson(`@datastax/ragstack-ai${versionForNPM}`);
    const ragstackJson = JSON.parse(remotePackageJson as string)
    version = version || ragstackJson.version
    log(`installing ${chalk.cyan("@datastax/ragstack-ai")} (${chalk.green(version)})`)

    await addDependencies(projectPath, packageManager, {"@datastax/ragstack-ai": version}, false)

    const currentDeps = packageJson.dependencies || {}
    const rmDeps: Record<string, string> = {}
    Object.keys(ragstackJson.dependencies)
        .filter((k: string) => currentDeps[k])
        .forEach((k: string) => {
            rmDeps[k] = currentDeps[k]
        })

    if (rmDeps.length) {
        log(`removing out of date dependencies:\n${formatDeps(rmDeps)}`)
        await removeDependencies(projectPath, packageManager, rmDeps)
    }

    if (Object.keys(ragstackJson.dependencies).length) {
        log(`adding dev dependencies:\n${formatDeps(ragstackJson.dependencies)}`)
        await addDependencies(projectPath, packageManager, ragstackJson.dependencies, true)
        log(`setting overrides:\n${formatDeps(ragstackJson.dependencies)}`)
        await addOverrides(projectPath, packageManager, ragstackJson.dependencies)
    }
    log(`${chalk.cyan('all done!')} 🎉`)
}


function formatDeps(deps: Record<string, string>) {
    const depsStr = Object.keys(deps).map((key) => `${chalk.cyan(key)} (${chalk.green(deps[key])})`)
    return depsStr.map(d => "- " + d).join('\n')
}
