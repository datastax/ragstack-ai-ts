import {AstraDBVectorStoreHandler, VectorStoreHandler} from "./vectorStore";
import 'dotenv/config'
require('dotenv').config()

export function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Env ${name} is required`)
    }
    return value

}

const vectorStoreHandler = new AstraDBVectorStoreHandler()

export function getVectorStoreHandler(): VectorStoreHandler {
    return vectorStoreHandler
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


