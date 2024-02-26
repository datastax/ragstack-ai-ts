import {AstraLibArgs} from "@langchain/community/dist/vectorstores/astradb";
import {getRequiredEnv} from "./config";
import {AstraDB} from "@datastax/astra-db-ts";
import {HTTPClient} from "@datastax/astra-db-ts/dist/client";


export interface VectorStoreHandler {

    beforeTest: () => Promise<any>;
    afterTest: () => Promise<any>;
    getBaseAstraLibArgs: () => AstraLibArgs;

}


export class AstraDBVectorStoreHandler implements VectorStoreHandler {

    token: string;
    endpoint: string;
    collectionName: string | undefined;
    constructor() {
        this.token = getRequiredEnv("ASTRA_DB_TOKEN")
        this.endpoint = getRequiredEnv("ASTRA_DB_ENDPOINT")
    }

    async afterTest(): Promise<any> {
        await this.deleteAllCollections();
    }

    async beforeTest(): Promise<any> {
        await this.deleteAllCollections();
        this.collectionName = "documents_" + Math.random().toString(36).substring(7)
    }


    private async deleteAllCollections() {
        const astraDbClient = new AstraDB(this.token, this.endpoint)
        const httpClient: HTTPClient = (Reflect.get(astraDbClient, "httpClient") as HTTPClient)
        let apiResponse = await httpClient.executeCommand({"findCollections": {}}, null);
        const collections = apiResponse.status.collections
        console.log("Found collections: ", collections)
        for (let collection of collections) {
            console.log("Deleting collection: ", collection)
            await astraDbClient.dropCollection(collection)
        }
    }

    getBaseAstraLibArgs() {
        const astraConfig: AstraLibArgs = {
            token: this.token,
            endpoint: this.endpoint,
            collection: this.collectionName as string,
            maxRetries: 0
        };
        return astraConfig
    }





}