import {VectorStore} from "@langchain/core/vectorstores";
import {LLM} from "@langchain/core/language_models/llms";
import {Document} from "@langchain/core/documents";
import {randomUUID} from "node:crypto";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {RunnablePassthrough, RunnableSequence} from "@langchain/core/runnables";
import {StringOutputParser} from "@langchain/core/output_parsers";
import {ConversationalRetrievalQAChain} from "langchain/chains";
import {BaseListChatMessageHistory} from "@langchain/core/chat_history";
import {BufferMemory} from "langchain/memory";

const sampleData = [
    "MyFakeProductForTesting is a versatile testing tool designed to streamline the testing process for software developers, quality assurance professionals, and product testers. It provides a comprehensive solution for testing various aspects of applications and systems, ensuring robust performance and functionality.",
    "MyFakeProductForTesting comes equipped with an advanced dynamic test scenario generator. This feature allows users to create realistic test scenarios by simulating various user interactions, system inputs, and environmental conditions. The dynamic nature of the generator ensures that tests are not only diverse but also adaptive to changes in the application under test.",
    "The product includes an intelligent bug detection and analysis module. It not only identifies bugs and issues but also provides in-depth analysis and insights into the root causes. The system utilizes machine learning algorithms to categorize and prioritize bugs, making it easier for developers and testers to address critical issues first.",
    "MyFakeProductForTesting first release happened in June 2020.",
]
export async function runCustomRagChain(vectorStore: VectorStore, llm: LLM) {
    const retriever = vectorStore.asRetriever();

    await vectorStore.addDocuments(sampleData.map((content) => new Document({
        pageContent: content,
        metadata: {"id": randomUUID()}
    })), {})

    const sysPrompt = `
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
user.`

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", sysPrompt],
        ["human", "{question}"],

    ])

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


export async function runConversationalRag(vectorStore: VectorStore, llm: LLM, history: BaseListChatMessageHistory) {

    await vectorStore.addDocuments(sampleData.map((content) => new Document({
        pageContent: content,
        metadata: {"id": randomUUID()}
    })), {})

    const chain = ConversationalRetrievalQAChain.fromLLM(
        llm,
        vectorStore.asRetriever(),
        {
            returnSourceDocuments: true,
            memory: new BufferMemory({
                chatHistory: history,
                memoryKey: "chat_history",
                inputKey: "question",
                outputKey: "text",
            })
        }
    );
    let result = await chain.invoke({"question": "what is MyFakeProductForTesting?"})
    console.log(result["text"]);

    result = await chain.invoke({"question": "and when was it released?"})
    console.log(result);
    const text = result['text'];
    expect(text, `Expected to contain 2020 but got: ${text}`).toContain("2020")




}