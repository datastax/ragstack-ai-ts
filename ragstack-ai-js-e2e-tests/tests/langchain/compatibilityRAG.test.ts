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

describe("RAG pipeline compatibility", () => {
    class EmbeddingsInfo {
        public embeddings: EmbeddingsInterface;
        public dimensions: number;

        constructor(embeddings: EmbeddingsInterface, dimensions: number) {
            this.embeddings = embeddings
            this.dimensions = dimensions
        }
    }

    type EmbeddingsInfoSupplier = () => EmbeddingsInfo;

    interface VectorStoreSupplier {
        initialize(embeddingsInfo: EmbeddingsInfo): Promise<VectorStore>;

        close(): Promise<void>;

    }

    type LLMSupplier = () => BaseLanguageModel;

    class RAGCombination {
        vectorStore: VectorStoreSupplier;
        embeddings: EmbeddingsInfoSupplier;
        llm: LLMSupplier;

        constructor(vectorStore: VectorStoreSupplier, embeddings: EmbeddingsInfoSupplier, llm: LLMSupplier) {
            this.vectorStore = vectorStore
            this.embeddings = embeddings
            this.llm = llm
        }
    }


    function astraDB(): VectorStoreSupplier {
        return new class implements VectorStoreSupplier {
            async close(): Promise<void> {
                await getVectorStoreHandler().afterTest()
            }

            async initialize(embeddingsInfo: EmbeddingsInfo): Promise<VectorStore> {
                return getVectorStoreHandler().beforeTest()
                    .then(async () => {

                        const config: AstraLibArgs = {
                            ...getVectorStoreHandler().getBaseAstraLibArgs(),
                            collectionOptions: {
                                vector: {
                                    dimension: embeddingsInfo.dimensions,
                                    metric: "cosine",
                                },
                            },
                        }
                        const store = new AstraDBVectorStore(embeddingsInfo.embeddings, config);
                        return store.initialize()
                            .then(() => store)
                    })
            }
        }
    }

    function cassandra(): VectorStoreSupplier {
        return new class implements VectorStoreSupplier {
            async close(): Promise<void> {
                await getVectorStoreHandler().afterTest()
            }

            async initialize(embeddingsInfo: EmbeddingsInfo): Promise<VectorStore> {
                await getVectorStoreHandler().beforeTest()
                const config: CassandraLibArgs = {
                    ...getVectorStoreHandler().getBaseCassandraLibArgs(embeddingsInfo.dimensions),
                    primaryKey: [{name: "id", type: "uuid", partition: true}],
                    // with metadata won't work, see https://github.com/langchain-ai/langchainjs/pull/4516
                    metadataColumns: [{name: "metadata", type: "text"}]
                }
                return new CassandraStore(embeddingsInfo.embeddings, config);
            }
        }
    }

    function openAIEmbeddings(): EmbeddingsInfoSupplier {
        return () => new EmbeddingsInfo(new OpenAIEmbeddings({openAIApiKey: getRequiredEnv("OPEN_AI_KEY")}), 1536)

    }

    function openAILLM(): LLMSupplier {
        return () => new ChatOpenAI({openAIApiKey: getRequiredEnv("OPEN_AI_KEY")})
    }


    class EmbeddingsLLMPair {
        embeddings: EmbeddingsInfoSupplier;
        llm: LLMSupplier;

        constructor(embeddings: EmbeddingsInfoSupplier, llm: LLMSupplier) {
            this.embeddings = embeddings
            this.llm = llm
        }
    }

    const vectorStores: Array<VectorStoreSupplier> = [astraDB(), cassandra()]
    const embeddingsLLM: Array<EmbeddingsLLMPair> = [
        new EmbeddingsLLMPair(openAIEmbeddings(), openAILLM())
    ]
    const ragCombinations: Array<RAGCombination> = []
    for (const vectorStore of vectorStores) {
        for (const embeddings of embeddingsLLM) {
            ragCombinations.push(new RAGCombination(vectorStore, embeddings.embeddings, embeddings.llm))
        }
    }


    test.each<RAGCombination>(ragCombinations)('rag', async (combination: RAGCombination) => {
        const embeddings: EmbeddingsInfo = combination.embeddings()
        const llm: LLM = combination.llm() as LLM
        const vectorStore: VectorStore = await combination.vectorStore.initialize(embeddings)
        try {
            await runCustomRagChain(vectorStore, llm);
        } finally {
            try {
                await combination.vectorStore.close()
            } catch (e: unknown) {
                // swallow to not hide chain error
                console.error("Error closing vector store", e)
            }
        }
    });


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


});
