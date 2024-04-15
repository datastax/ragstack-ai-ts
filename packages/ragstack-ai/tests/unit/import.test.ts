import {expect, test} from "@jest/globals";
import {AstraDBVectorStore} from "@langchain/community/vectorstores/astradb";
import {DataAPIClient} from "@datastax/astra-db-ts";
import {OpenAI} from "@langchain/openai";
import {RAGSTACK_VERSION} from "../../src";


describe("Package tests", () => {

    test('version test', async () => {
        expect(RAGSTACK_VERSION).toBeTruthy()
    })

    test('test import', async () => {
        expect(AstraDBVectorStore.lc_name()).toBe("AstraDBVectorStore")
        expect(DataAPIClient.name).toBe("DataAPIClient")
        expect(OpenAI.lc_name()).toBe("OpenAI")
    });
});
