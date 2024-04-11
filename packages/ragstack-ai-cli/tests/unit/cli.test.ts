import {expect, test} from "@jest/globals";
import fs from "fs";
import path from "path";
import {main} from "../../src/cli";
import {tmpdir} from "node:os";

describe("Test", () => {

    test('test add deps', async () => {
        const tempDir = fs.mkdtempSync(path.join(tmpdir(), "test"))

        const packageJson = path.join(tempDir, 'package.json');
        fs.writeFileSync(packageJson, JSON.stringify({
            "name": "test"
        }))

        await main({
            args: ["install", "--path", tempDir, "--use-yarn"],
            handleSigTerm: (() => {
                throw new Error("SIGTERM?")
            }),
            onError: (() => {
                throw new Error("Error in the app, check logs")
            }),
        })

        const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf-8'))
        console.log("after json", parsed)
        expect(Object.keys(parsed.dependencies).length).toBe(1)
        expect(parsed.dependencies["@datastax/ragstack-ai-ts"]).toBeTruthy()
        expect(Object.keys(parsed.devDependencies).length).toBe(8)


    });
});
