import {expect, test} from '@jest/globals';
import {ChatOpenAI} from "@langchain/openai";
import {getRequiredEnv} from "./config";



describe("Compatibility matrix", () => {

    test('test llm', async () => {
        const chatModel = new ChatOpenAI({
            openAIApiKey: getRequiredEnv("OPEN_AI_KEY"),
        });
        const response = await chatModel.invoke("what is LangSmith?");
        expect(response.content).toBe("LOL")
    });
});
