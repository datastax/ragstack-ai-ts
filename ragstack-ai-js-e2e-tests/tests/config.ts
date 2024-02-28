import {AstraDBVectorStoreHandler, LocalCassandraVectorStoreHandler, VectorStoreHandler} from "./vectorStore";

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
export function getVectorDatabaseType(): string {
    return vectorDatabaseType

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
        console.log("skipping test")
        return test.skip
    } else {
        console.log("exec test")
        return test
    }
}

function onBeforeEach() {
}


function onAfterEach() {
}


function onBeforeAll() {
}

function onAfterAll() {
}

export function setupBeforeAndAfter() {
    beforeAll(onBeforeAll);
    afterAll(onAfterAll);
    beforeEach(onBeforeEach);
    afterEach(onAfterEach);
}


