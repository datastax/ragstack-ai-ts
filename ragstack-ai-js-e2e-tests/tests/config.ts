
export function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Env ${name} is required`)
    }
    return value

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


