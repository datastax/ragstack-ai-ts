#!/usr/bin/env node
import {cyan, green} from 'picocolors'
import Commander from 'commander'
import path from 'path'
import {
    addDependencies, addOverrides,
    getPackageManager,
    getRemotePackageJson,
    removeDependencies
} from './package-manager'
import fs from 'fs'
import {LIB_VERSION} from "./version";


export async function main(mainOptions: { args?: string[], handleSigTerm: () => void, onError: () => void }) {


    process.on('SIGINT', mainOptions.handleSigTerm)
    process.on('SIGTERM', mainOptions.handleSigTerm)

    const command = new Commander.Command()
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
            '--use-pnpm',
            `

  Explicitly tell the CLI to bootstrap the application using pnpm
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


async function executeInstall(version: string, options: {
    path: string,
    useNpm: boolean,
    usePnpm: boolean,
    useYarn: boolean
}) {

    const projectPath = options.path || process.cwd()
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`\nPlease initialize the project at ${cyan(projectPath)} with your favourite package manager.`)
    }
    const packageManager = options.useNpm ? 'npm' : options.useYarn ? 'yarn' : await getPackageManager(projectPath)
    console.log(`Using ${cyan(packageManager)} as the package manager.`)
    let versionForNPM = version || ""
    if (versionForNPM) {
        versionForNPM = "@" + versionForNPM
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const appName = packageJson.name
    console.log(`Setting up RAGStack dependencies for ${cyan(appName)}.`)

    const remotePackageJson = await getRemotePackageJson(`@datastax/ragstack-ai-ts${versionForNPM}`);
    console.log("aa")
    const ragstackJson = JSON.parse(remotePackageJson as string)
    version = version || ragstackJson.version
    console.log(`Installing @datastax/ragstack-ai-ts@${green(version)}`)

    await addDependencies(projectPath, packageManager, {"@datastax/ragstack-ai-ts": version}, false)

    const currentDeps = packageJson.dependencies || {}
    const rmDeps: Record<string, string> = {}
    Object.keys(ragstackJson.dependencies)
        .filter((k: string) => currentDeps[k])
        .forEach((k: string) => {
            rmDeps[k] = currentDeps[k]
        })

    if (rmDeps.length) {
        console.log(`Removing dependencies ${formatDeps(rmDeps)}`)
        await removeDependencies(projectPath, packageManager, rmDeps)
    }

    if (Object.keys(ragstackJson.dependencies).length) {
        console.log(`Adding dev dependencies:\n${formatDeps(ragstackJson.dependencies)}`)
        await addDependencies(projectPath, packageManager, ragstackJson.dependencies, true)
        await addOverrides(projectPath, packageManager, ragstackJson.dependencies)
    }

    console.log()
    console.log(`${green('Done!')}`)

}


function formatDeps(deps: Record<string, string>) {
    const depsStr = Object.keys(deps).map((key) => key + "@" + deps[key])
    return `${cyan(depsStr.map(d => "- " + d).join('\n'))}`
}
