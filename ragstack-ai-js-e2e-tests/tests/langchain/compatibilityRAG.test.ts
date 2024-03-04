import {getRequiredEnv} from '../config';
import {VectorStore} from "@langchain/core/vectorstores";
import {LLM} from "@langchain/core/language_models/llms";
import {AzureChatOpenAI, ChatOpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {runConversationalRag, runCustomRagChain} from "./RAGApplications";
import {
    AstraDBVectorStoreSupplier, CassandraVectorStoreSupplier,
    EmbeddingsInfoSupplier,
    EnvDependantEmbeddings,
    EnvDependantLLM,
    LLMSupplier,
    VectorStoreSupplier
} from "./providers";
import {AzureOpenAIEmbeddings} from "@langchain/azure-openai";
import * as fs from "fs";
import {GoogleVertexAIEmbeddings} from "@langchain/community/embeddings/googlevertexai";
import {ChatGoogleVertexAI} from "@langchain/community/chat_models/googlevertexai";
import {BedrockChat} from "@langchain/community/chat_models/bedrock";
import {BedrockEmbeddings} from "@langchain/community/embeddings/bedrock";

describe("RAG pipeline compatibility", () => {
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


    const openAIEmbeddings = new EnvDependantEmbeddings(
        "OPEN_AI_KEY",
        "openai",
        1536,
        () => new OpenAIEmbeddings({
            openAIApiKey: getRequiredEnv("OPEN_AI_KEY")
        }))

    const openAILLM = new EnvDependantLLM(
        "OPEN_AI_KEY",
        "openai",
        () => new ChatOpenAI({openAIApiKey: getRequiredEnv("OPEN_AI_KEY"), temperature: 0.7})
    )

    const azureOpenAIEmbeddings = new EnvDependantEmbeddings(
        ["AZURE_OPEN_AI_KEY", "AZURE_OPEN_AI_ENDPOINT"],
        "azure openai",
        1536,
        () => new AzureOpenAIEmbeddings({
        azureOpenAIApiKey: getRequiredEnv("AZURE_OPEN_AI_KEY"),
        azureOpenAIApiVersion: "2023-05-15",
        azureOpenAIEndpoint: getRequiredEnv("AZURE_OPEN_AI_ENDPOINT"),
        azureOpenAIApiDeploymentName: "text-embedding-ada-002",
        modelName: "text-embedding-ada-002"
    }))

    const azureOpenAILLM = new EnvDependantLLM(
        ["AZURE_OPEN_AI_KEY", "AZURE_OPEN_AI_ENDPOINT"],
        "azure openai",
        () => new AzureChatOpenAI({
            azureOpenAIApiKey: getRequiredEnv("AZURE_OPEN_AI_KEY"),
            azureOpenAIApiVersion: "2023-05-15",
            azureOpenAIBasePath: getRequiredEnv("AZURE_OPEN_AI_ENDPOINT"),
            azureOpenAIApiDeploymentName: "gpt-35-turbo",
        }))


    function vertexSetup() {
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/gcloud-account-key.json"
            fs.writeFileSync("/tmp/gcloud-account-key.json", process.env["GCLOUD_ACCOUNT_KEY_JSON"] as string)
        }
    }

    const vertexLLM = new EnvDependantLLM(
        ["GCLOUD_ACCOUNT_KEY_JSON"],
        "vertex",
        () => {
            vertexSetup();
            return new ChatGoogleVertexAI()
        }
    )

    const vertexEmbeddings = new EnvDependantEmbeddings(
        ["GCLOUD_ACCOUNT_KEY_JSON"],
        "vertex",
        768,
        () => {
            vertexSetup();
            return new GoogleVertexAIEmbeddings()
        }
    )

    const bedrockAnthropicLLM = new EnvDependantLLM(
        ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BEDROCK_AWS_REGION"],
        "bedrock anthropic",
        () => {
            return new BedrockChat({
                model: "anthropic.claude-v2",
                region: getRequiredEnv("BEDROCK_AWS_REGION"),
            })
        }
    )

    const bedrockMetaLLM = new EnvDependantLLM(
        ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BEDROCK_AWS_REGION"],
        "bedrock anthropic",
        () => {
            return new BedrockChat({
                model: "meta.llama2-13b-chat-v1",
                region: getRequiredEnv("BEDROCK_AWS_REGION"),
            })
        }
    )

    const bedrockTitanEmbeddings = new EnvDependantEmbeddings(
        ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BEDROCK_AWS_REGION"],
        "bedrock titan",
        1536,
        () => {
            return new BedrockEmbeddings({
                model: "amazon.titan-embed-text-v1",
                region: getRequiredEnv("BEDROCK_AWS_REGION"),
            })
        })

    // const bedrockCohereEmbeddings = new EnvDependantEmbeddings(
    //     ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "BEDROCK_AWS_REGION"],
    //     "bedrock cohere",
    //     1024,
    //     () => {
    //         return new BedrockEmbeddings({
    //             model: "cohere.embed-english-v3",
    //             region: getRequiredEnv("BEDROCK_AWS_REGION"),
    //         })
    //     })



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
        new AstraDBVectorStoreSupplier(),
        new CassandraVectorStoreSupplier()
    ]
    const embeddingsLLM: Array<EmbeddingsLLMPair> = [
        {embeddings: openAIEmbeddings, llm: openAILLM},
        {embeddings: azureOpenAIEmbeddings, llm: azureOpenAILLM},
        {embeddings: vertexEmbeddings, llm: vertexLLM},
        {embeddings: bedrockTitanEmbeddings, llm: bedrockAnthropicLLM},
        // cohere is broken
        // {embeddings: bedrockCohereEmbeddings, llm: bedrockMetaLLM}
        {embeddings: bedrockTitanEmbeddings, llm: bedrockMetaLLM}
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
