import {AstraDBVectorStoreHandler, LocalCassandraVectorStoreHandler, VectorStoreHandler} from "./vectorStore";
import {afterEach} from "@jest/globals";
import * as fs from "fs";
export class RequiredEnvNotSet extends Error {
    env: string;

    constructor(envName: string) {
        super(`Env ${envName} is required`)
        this.env = envName
    }
}

export function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new RequiredEnvNotSet(name)
    }
    return value

}

const vectorDatabaseType = process.env["VECTOR_DATABASE_TYPE"] || "astradb"
if (!["astradb", "local-cassandra"].includes(vectorDatabaseType)) {
    throw new Error(`Invalid VECTOR_DATABASE_TYPE: ${vectorDatabaseType}`)

}
let vectorStoreHandler: VectorStoreHandler
if (vectorDatabaseType === "local-cassandra") {
    vectorStoreHandler = new LocalCassandraVectorStoreHandler()
} else {
    vectorStoreHandler = new AstraDBVectorStoreHandler()
}

export function getVectorStoreHandler(): VectorStoreHandler {
    return vectorStoreHandler
}
export class SkipTest extends Error {
}

export function testIf(evalCondition: () => boolean): jest.It {
    let runTest: boolean
    try {
        runTest = evalCondition();
    } catch (e: unknown) {
        if (e instanceof SkipTest) {
            runTest = false
        } else {
            throw e
        }
    }
    if (!runTest) {
        return test.skip
    } else {
        return test
    }
}


let currentTestProperties: Record<string, string> = {}
beforeEach(() => {
    currentTestProperties = {}
})
const TEST_PROPERTIES_FILENAME = "junit-test-properties.json";
afterEach(() => {
    if (!Object.keys(currentTestProperties).length) {
        return
    }
    const name = expect.getState().currentTestName as string
    let root: Record<string, Record<string, string>> = {}
    if (fs.existsSync(TEST_PROPERTIES_FILENAME)) {
        root = JSON.parse(fs.readFileSync(TEST_PROPERTIES_FILENAME, "utf-8"))
    }
    root[name] = currentTestProperties
    fs.writeFileSync(TEST_PROPERTIES_FILENAME, JSON.stringify(root), "utf-8")
})

export function appendTestCaseProperty(key: string, value: string) {
    currentTestProperties[key] = value
}
