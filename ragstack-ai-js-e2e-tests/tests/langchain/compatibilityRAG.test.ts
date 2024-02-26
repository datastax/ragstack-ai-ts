import {expect, test} from '@jest/globals';
import {getRequiredEnv, getVectorStoreHandler} from '../config';
import {AstraDBVectorStore, AstraLibArgs} from "@langchain/community/vectorstores/astradb";
import {FakeEmbeddings} from "@langchain/core/utils/testing";
import {Document} from "@langchain/core/documents";
import {CreateCollectionOptions} from "@datastax/astra-db-ts/dist/collections/options";
import {PromptTemplate} from "@langchain/core/prompts";
import {RunnablePassthrough, RunnableSequence} from "@langchain/core/runnables";
import {StringOutputParser} from "@langchain/core/output_parsers";
import {VectorStore} from "@langchain/core/vectorstores";
import {LLM} from "@langchain/core/dist/language_models/llms";
import {EmbeddingsInterface} from "@langchain/core/embeddings";
import {cosineSimilarity} from "@langchain/core/dist/utils/math";
import {ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {BaseLanguageModel} from "@langchain/core/dist/language_models/base";


describe("RAG pipeline compatibility", () => {
    // beforeEach(async () => {
    //     await getVectorStoreHandler().beforeTest()
    // })
    // afterEach(async () => {
    //     await getVectorStoreHandler().afterTest()
    // })

    class EmbeddingsInfo {
        constructor(readonly embeddings: EmbeddingsInterface, readonly dimensions: number) {
        }
    }


    type EmbeddingsInfoSupplier = () => EmbeddingsInfo;

    type VectorStoreSupplier = (embeddingsInfo: EmbeddingsInfo) => Promise<VectorStore>;

    type LLMSupplier = () => BaseLanguageModel;

    class RAGCombination {
        constructor(readonly vectorStore: VectorStoreSupplier, readonly embeddings: EmbeddingsInfoSupplier, readonly llm: Function) {
        }
    }


    function astraDB(): VectorStoreSupplier {
        return async (embeddings: EmbeddingsInfo) => {
            await getVectorStoreHandler().beforeTest()
            const config: AstraLibArgs = {
                ...getVectorStoreHandler().getBaseAstraLibArgs(),
                collectionOptions: {
                    vector: {
                        dimension: embeddings.dimensions,
                        metric: "cosine",
                    },
                },
            }
            let store = new AstraDBVectorStore(embeddings.embeddings, config);
            await store.initialize()
            return store
        }
    }

    function openAIEmbeddings(): EmbeddingsInfoSupplier {
        return () => new EmbeddingsInfo(new OpenAIEmbeddings({openAIApiKey: getRequiredEnv("OPEN_AI_KEY")}), 1536)

    }

    function openAILLM(): LLMSupplier {
        return () => new ChatOpenAI({openAIApiKey: getRequiredEnv("OPEN_AI_KEY")})
    }


    class EmbeddingsLLMPair {
        constructor(readonly embeddings: EmbeddingsInfoSupplier, readonly llm: LLMSupplier) {
        }
    }

    let vectorStores: Array<VectorStoreSupplier> = [astraDB()]
    let embeddingsLLM: Array<EmbeddingsLLMPair> = [
        new EmbeddingsLLMPair(openAIEmbeddings(), openAILLM())
    ]
    const ragCombinations: Array<RAGCombination> = []
    for (let vectorStore of vectorStores) {
        for (let embeddings of embeddingsLLM) {
            ragCombinations.push(new RAGCombination(vectorStore, embeddings.embeddings, embeddings.llm))
        }
    }

    test.each<RAGCombination>(ragCombinations)('rag', async (combination: RAGCombination) => {
        console.log(combination)
        const embeddings: EmbeddingsInfo = combination.embeddings()
        const llm: LLM = combination.llm() as LLM
        const vectorStore: VectorStore = await combination.vectorStore(embeddings)

        const retriever = vectorStore.asRetriever();

        const sampleData = [
            "MyFakeProductForTesting is a versatile testing tool designed to streamline the testing process for software developers, quality assurance professionals, and product testers. It provides a comprehensive solution for testing various aspects of applications and systems, ensuring robust performance and functionality.",
            "MyFakeProductForTesting comes equipped with an advanced dynamic test scenario generator. This feature allows users to create realistic test scenarios by simulating various user interactions, system inputs, and environmental conditions. The dynamic nature of the generator ensures that tests are not only diverse but also adaptive to changes in the application under test.",
            "The product includes an intelligent bug detection and analysis module. It not only identifies bugs and issues but also provides in-depth analysis and insights into the root causes. The system utilizes machine learning algorithms to categorize and prioritize bugs, making it easier for developers and testers to address critical issues first.",
            "MyFakeProductForTesting first release happened in June 2020.",
        ]

        await vectorStore.addDocuments(sampleData.map((content, idx) => new Document({
            pageContent: content,
            metadata: {}
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
<<context>
    {context} 
<context/>

REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm 
not sure." Don't try to make up an answer. Anything between the preceding 'context' 
html blocks is retrieved from a knowledge bank, not part of the conversation with the 
user.`);

        const docParser = (docs: Document[]) => {
            return docs.map((doc, i) => {
                return `<doc id='${i}'>${doc.pageContent}</doc>`
            }).join("\n")
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

        console.log(result);


    });


});
