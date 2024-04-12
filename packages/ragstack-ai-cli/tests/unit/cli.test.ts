import {expect, test} from "@jest/globals";
import {main} from "../../dist/cli";
import * as os from "os";
// @ts-ignore
import path from "path";
// @ts-ignore
import fs from "fs";

describe("Test", () => {

    test('test add deps', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test"))

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
        expect(Object.keys(parsed.dependencies).length).toBe(1)
        expect(parsed.dependencies["@datastax/ragstack-ai"]).toBeTruthy()
        expect(Object.keys(parsed.devDependencies).length).toBe(8)


    });
});
