import {expect, test} from "@jest/globals";
import {AstraDBVectorStore} from "@langchain/community/vectorstores/astradb";
import {AstraDB} from "@datastax/astra-db-ts";
import {OpenAI} from "@langchain/openai";


describe("Package tests", () => {

    test('test import', async () => {
        expect(AstraDBVectorStore.lc_name()).toBe("AstraDBVectorStore")
        expect(AstraDB.name).toBe("AstraDB")
        expect(OpenAI.lc_name()).toBe("OpenAI")
    });
});