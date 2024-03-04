import { getVectorStoreHandler} from "../config";
import {EmbeddingsInterface} from "@langchain/core/embeddings";
import {BaseLanguageModel} from "@langchain/core/language_models/base";
import {VectorDatabaseTypeNotSupported} from "../vectorStore";
import {VectorStore} from "@langchain/core/vectorstores";
import {AstraDBVectorStore, AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {BaseListChatMessageHistory} from "@langchain/core/chat_history";
import {AstraDB} from "@datastax/astra-db-ts";
import {AstraDBChatMessageHistory} from "@langchain/community/stores/message/astradb";
import {randomUUID} from "node:crypto";
import {CassandraLibArgs, CassandraStore} from "@langchain/community/vectorstores/cassandra";
import {CassandraChatMessageHistory} from "@langchain/community/stores/message/cassandra";


export interface Skippable {
    skip(): boolean;
}

export interface Nameable {
    name(): string;
}

export interface EmbeddingsInfoSupplier extends Skippable, Nameable {
    getEmbeddings(): EmbeddingsInterface;

    getDimensions(): number;
}

export interface LLMSupplier extends Skippable, Nameable {
    getLLM(): BaseLanguageModel;
}


export interface VectorStoreSupplier extends Skippable, Nameable {

    initialize(embeddingsInfo: EmbeddingsInfoSupplier): Promise<VectorStore>;

    newChatHistory(): Promise<BaseListChatMessageHistory>;

    close(): Promise<void>;

}


export abstract class EnvDependantSkippable implements Skippable {
    readonly keys: string | string[];


    constructor(keys: string | string[]) {
        this.keys = keys;
    }

    skip(): boolean {
        let kk: string[]
        if (!Array.isArray(this.keys)) {
            kk = [this.keys]
        } else {
            kk = this.keys
        }
        for (const key of kk) {
            if (!process.env[key]) {
                return true
            }
        }
        return false
    }
}

export class EnvDependantEmbeddings extends EnvDependantSkippable implements EmbeddingsInfoSupplier {
    private readonly embeddingsName: string;
    private readonly dimensions: number;
    private readonly supplier: () => EmbeddingsInterface;

    constructor(env: string | string[], name: string, dimensions: number, supplier: () => EmbeddingsInterface) {
        super(env)
        this.embeddingsName = name
        this.dimensions = dimensions
        this.supplier = supplier
    }

    getDimensions(): number {
        return this.dimensions;
    }

    getEmbeddings(): EmbeddingsInterface {
        return this.supplier();
    }

    name(): string {
        return this.embeddingsName;
    }
}

export class EnvDependantLLM extends EnvDependantSkippable implements LLMSupplier {
    private readonly llmName: string;
    private readonly supplier: () => BaseLanguageModel;

    constructor(env: string | string[], name: string, supplier: () => BaseLanguageModel) {
        super(env)
        this.llmName = name
        this.supplier = supplier
    }

    name(): string {
        return this.llmName;
    }

    getLLM(): BaseLanguageModel {
        return this.supplier();
    }
}


export class AstraDBVectorStoreSupplier implements VectorStoreSupplier {
    name(): string {
        return "astradb";
    }

    skip(): boolean {
        try {
            getVectorStoreHandler().getBaseAstraLibArgs();
        } catch (e: unknown) {
            if (e instanceof VectorDatabaseTypeNotSupported) {
                return true
            }
            throw e
        }
        return false
    }


    async close(): Promise<void> {
        await getVectorStoreHandler().afterTest()
    }

    async initialize(embeddingsInfo: EmbeddingsInfoSupplier): Promise<VectorStore> {
        return getVectorStoreHandler().beforeTest()
            .then(async () => {

                const config: AstraLibArgs = {
                    ...getVectorStoreHandler().getBaseAstraLibArgs(),
                    collectionOptions: {
                        vector: {
                            dimension: embeddingsInfo.getDimensions(),
                            metric: "cosine",
                        },
                    },
                }
                const store = new AstraDBVectorStore(embeddingsInfo.getEmbeddings(), config);
                return store.initialize()
                    .then(() => store)
            })
    }

    async newChatHistory(): Promise<BaseListChatMessageHistory> {
        const baseAstraLibArgs = getVectorStoreHandler().getBaseAstraLibArgs();
        const client = new AstraDB(
            baseAstraLibArgs.token,
            baseAstraLibArgs.endpoint
        );
        const collectionName = baseAstraLibArgs.collection + "_chat_history";
        await client.createCollection(collectionName)
        const collection = await client.collection(collectionName)
        const history = new AstraDBChatMessageHistory(
            {
                collection,
                sessionId: randomUUID()
            }
        );
        return Promise.resolve(history)
    }

}

export class CassandraVectorStoreSupplier implements VectorStoreSupplier {

    store?: CassandraStore

    name(): string {
        return "cassandra";
    }

    skip(): boolean {

        try {
            getVectorStoreHandler().getBaseCassandraLibArgs(1);
            return false
        } catch (e: unknown) {
            if (e instanceof VectorDatabaseTypeNotSupported) {
                return true
            }
            throw e
        }
    }

    async close(): Promise<void> {
        await getVectorStoreHandler().afterTest()
        if (this.store) {
            const client = await this.store.getCassandraTable().getClient();
            await client.shutdown()
            this.store = undefined
        }
    }

    async initialize(embeddingsInfo: EmbeddingsInfoSupplier): Promise<VectorStore> {
        await getVectorStoreHandler().beforeTest()
        const config: CassandraLibArgs = {
            ...getVectorStoreHandler().getBaseCassandraLibArgs(embeddingsInfo.getDimensions()),
            primaryKey: [{name: "id", type: "uuid", partition: true}],
            // with metadata won't work, see https://github.com/langchain-ai/langchainjs/pull/4516
            metadataColumns: [{name: "metadata", type: "text"}]
        }
        this.store = new CassandraStore(embeddingsInfo.getEmbeddings(), config);
        return this.store
    }

    newChatHistory(): Promise<BaseListChatMessageHistory> {
        const baseCassandraLibArgs = getVectorStoreHandler().getBaseCassandraLibArgs(0);
        return Promise.resolve(new CassandraChatMessageHistory({
            serviceProviderArgs: baseCassandraLibArgs.serviceProviderArgs,
            contactPoints: baseCassandraLibArgs.contactPoints,
            localDataCenter: baseCassandraLibArgs.localDataCenter,
            credentials: baseCassandraLibArgs.credentials,
            keyspace: baseCassandraLibArgs.keyspace,
            table: baseCassandraLibArgs.table + "_chat_history",
            sessionId: randomUUID()
        }));
    }
}