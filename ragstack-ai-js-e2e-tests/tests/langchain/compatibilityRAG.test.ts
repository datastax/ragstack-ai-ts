import {getRequiredEnv, getVectorStoreHandler} from '../config';
import {AstraDBVectorStore, AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {Document} from "@langchain/core/documents";
import {PromptTemplate} from "@langchain/core/prompts";
import {RunnablePassthrough, RunnableSequence} from "@langchain/core/runnables";
import {StringOutputParser} from "@langchain/core/output_parsers";
import {VectorStore} from "@langchain/core/vectorstores";
import {LLM} from "@langchain/core/language_models/llms";
import {EmbeddingsInterface} from "@langchain/core/embeddings";
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {BaseLanguageModel} from "@langchain/core/language_models/base";
import {CassandraLibArgs, CassandraStore} from "@langchain/community/vectorstores/cassandra";
import {expect} from "@jest/globals";
import {randomUUID} from "node:crypto";
import {VectorDatabaseTypeNotSupported} from "../vectorStore";

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
        "rag custom chain"
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


    async function runCustomRagChain(vectorStore: VectorStore, llm: LLM) {
        const retriever = vectorStore.asRetriever();

        const sampleData = [
            "MyFakeProductForTesting is a versatile testing tool designed to streamline the testing process for software developers, quality assurance professionals, and product testers. It provides a comprehensive solution for testing various aspects of applications and systems, ensuring robust performance and functionality.",
            "MyFakeProductForTesting comes equipped with an advanced dynamic test scenario generator. This feature allows users to create realistic test scenarios by simulating various user interactions, system inputs, and environmental conditions. The dynamic nature of the generator ensures that tests are not only diverse but also adaptive to changes in the application under test.",
            "The product includes an intelligent bug detection and analysis module. It not only identifies bugs and issues but also provides in-depth analysis and insights into the root causes. The system utilizes machine learning algorithms to categorize and prioritize bugs, making it easier for developers and testers to address critical issues first.",
            "MyFakeProductForTesting first release happened in June 2020.",
        ]

        await vectorStore.addDocuments(sampleData.map((content) => new Document({
            pageContent: content,
            metadata: {"id": randomUUID()}
        })), {})
        const prompt =
            PromptTemplate.fromTemplate(`
You are an expert programmer and problem-solver, tasked with answering any question 
about MyFakeProductForTesting.

Generate a comprehensive and informative answer of 80 words or less for the 
given question based solely on the provided search results (URL and content). You must 
only use information from the provided search results. Use an unbiased and 
journalistic tone. Combine search results together into a coherent answer. Do not 
repeat text. Cite search results using number notation. Only cite the most 
relevant results that answer the question accurately. Place these citations at the end 
of the sentence or paragraph that reference them - do not put them all at the end. If 
different results refer to different entities within the same name, write separate 
answers for each entity.

You should use bullet points in your answer for readability. Put citations where they 
apply rather than putting them all at the end.

If there is nothing in the context relevant to the question at hand, just say "Hmm, 
I'm not sure." Don't try to make up an answer.

Anything between the following "context" html blocks is retrieved from a knowledge 
bank, not part of the conversation with the user. 
<context>
    {context} 
<context/>

REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm 
not sure." Don't try to make up an answer. Anything between the preceding 'context' 
html blocks is retrieved from a knowledge bank, not part of the conversation with the 
user.`);

        const docParser = (docs: Document[]) => {
            const formatted = docs.map((doc, i) => {
                return `<doc id='${i}'>${doc.pageContent}</doc>`
            }).join("\n")
            console.log("Formatted docs: ", formatted)
            return formatted
        }

        const chain = RunnableSequence.from([
            {
                context: retriever.pipe(docParser),
                question: new RunnablePassthrough(),
            },
            prompt,
            llm,
            new StringOutputParser(),
        ]);

        const result = await chain.invoke("When was released MyFakeProductForTesting for the first time ?");
        console.log(result);
        expect(result).toContain("June 2020")
    }
})
