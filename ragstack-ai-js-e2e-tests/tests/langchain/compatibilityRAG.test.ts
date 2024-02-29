import {getRequiredEnv, getVectorStoreHandler} from '../config';
import {AstraDBVectorStore, AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {VectorStore} from "@langchain/core/vectorstores";
import {LLM} from "@langchain/core/language_models/llms";
import {EmbeddingsInterface} from "@langchain/core/embeddings";
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {BaseLanguageModel} from "@langchain/core/language_models/base";
import {CassandraLibArgs, CassandraStore} from "@langchain/community/vectorstores/cassandra";
import {randomUUID} from "node:crypto";
import {VectorDatabaseTypeNotSupported} from "../vectorStore";
import {runConversationalRag, runCustomRagChain} from "./RAGApplications";
import {BaseListChatMessageHistory} from "@langchain/core/chat_history";
import {AstraDBChatMessageHistory} from "@langchain/community/stores/message/astradb";
import {CassandraChatMessageHistory} from "@langchain/community/stores/message/cassandra";
import {AstraDB} from "@datastax/astra-db-ts";

describe("RAG pipeline compatibility", () => {

    interface Skippable {
        skip(): boolean;
    }

    interface Nameable {
        name(): string;
    }

    interface EmbeddingsInfoSupplier extends Skippable, Nameable {
        getEmbeddings(): EmbeddingsInterface;

        getDimensions(): number;
    }

    interface LLMSupplier extends Skippable, Nameable {
        getLLM(): BaseLanguageModel;
    }


    interface VectorStoreSupplier extends Skippable, Nameable {

        initialize(embeddingsInfo: EmbeddingsInfoSupplier): Promise<VectorStore>;

        newChatHistory(): Promise<BaseListChatMessageHistory>;

        close(): Promise<void>;

    }

    class RAGCombination {
        vectorStore: VectorStoreSupplier;
        embeddings: EmbeddingsInfoSupplier;
        llm: LLMSupplier;
        testCase: string;

        constructor(vectorStore: VectorStoreSupplier, embeddings: EmbeddingsInfoSupplier, llm: LLMSupplier, testCase: string) {
            this.vectorStore = vectorStore
            this.embeddings = embeddings
            this.llm = llm
            this.testCase = testCase
        }

        toString(): string {
            return `${this.embeddings.name()} embedding | ${this.llm.name()} llm | ${this.vectorStore.name()} | ${this.testCase}`
        }
    }


    function astraDB(): VectorStoreSupplier {
        return new class implements VectorStoreSupplier {
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
    }

    function cassandra(): VectorStoreSupplier {
        return new class implements VectorStoreSupplier {
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
    }

    class EnvDependantSkippable implements Skippable {
        readonly keys: string | string[];


        constructor(keys: string | string[]) {
            this.keys = keys;
        }

        protected getKey(key: string): string {
            return getRequiredEnv(key)
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

    function openAIEmbeddings(): EmbeddingsInfoSupplier {
        return new class extends EnvDependantSkippable implements EmbeddingsInfoSupplier {

            constructor() {
                super("OPEN_AI_KEY");
            }

            name(): string {
                return "openai";
            }

            getDimensions(): number {
                return 1536;
            }

            getEmbeddings(): EmbeddingsInterface {
                return new OpenAIEmbeddings({openAIApiKey: this.getKey("OPEN_AI_KEY")});
            }
        }
    }

    function openAILLM(): LLMSupplier {
        return new class extends EnvDependantSkippable implements LLMSupplier {
            constructor() {
                super("OPEN_AI_KEY");
            }

            name(): string {
                return "openai";
            }
            getLLM(): BaseLanguageModel {
                return new ChatOpenAI({openAIApiKey: this.getKey("OPEN_AI_KEY"), temperature: 0.7})
            }
        }
    }


    class EmbeddingsLLMPair {
        embeddings: EmbeddingsInfoSupplier;
        llm: LLMSupplier;

        constructor(embeddings: EmbeddingsInfoSupplier, llm: LLMSupplier) {
            this.embeddings = embeddings
            this.llm = llm
        }
    }

    const testCases: string[] = [
        "rag custom chain",
        "conversational rag"
    ]
    const vectorStores: Array<VectorStoreSupplier> = [
        astraDB(),
        cassandra()
    ]
    const embeddingsLLM: Array<EmbeddingsLLMPair> = [
        new EmbeddingsLLMPair(openAIEmbeddings(), openAILLM())
    ]
    const ragCombinations: Array<RAGCombination> = []
    const ragCombinationsToSkip: Array<RAGCombination> = []
    for (const testCase of testCases) {
        for (const vectorStore of vectorStores) {
            for (const embeddings of embeddingsLLM) {
                if (vectorStore.skip() || embeddings.embeddings.skip() || embeddings.llm.skip()) {
                    ragCombinationsToSkip.push(new RAGCombination(vectorStore, embeddings.embeddings, embeddings.llm, testCase))
                    continue
                }
                ragCombinations.push(new RAGCombination(vectorStore, embeddings.embeddings, embeddings.llm, testCase))
            }
        }
    }
    if (ragCombinationsToSkip.length) {
        // eslint-disable-next-line
        test.skip.each<RAGCombination>(ragCombinationsToSkip)('Test %s', (combination: RAGCombination) => {
        });
    }

    if (ragCombinations.length) {

        test.each<RAGCombination>(ragCombinations)('Test %s', async (combination: RAGCombination) => {
            const llm: LLM = combination.llm.getLLM() as LLM
            try {
                const vectorStore: VectorStore = await combination.vectorStore.initialize(combination.embeddings)
                switch (combination.testCase) {
                    case "rag custom chain":
                        await runCustomRagChain(vectorStore, llm);
                        break;
                    case "conversational rag":
                        await runConversationalRag(vectorStore, llm, await combination.vectorStore.newChatHistory());
                        break;
                    default:
                        throw new Error(`Unknown test case: ${combination.testCase}`)
                }
            } finally {
                try {
                    await combination.vectorStore.close()
                } catch (e: unknown) {
                    // swallow to not hide chain error
                    console.error("Error closing vector store", e)
                }
            }
        });
    }
})
