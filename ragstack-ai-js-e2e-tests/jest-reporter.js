const path = require('path');
const fs = require('fs');
const tests = []

class CustomReporter {

    constructor(globalConfig, reporterOptions, reporterContext) {
        this._globalConfig = globalConfig;
        this._options = reporterOptions;
        this._context = reporterContext;
        this.tests = []
    }

    onTestCaseResult(test, testCaseResult) {
        const parsedPath = path.parse(test.path);
        const parts = parsedPath.dir.split("/").filter(part => part !== "tests");
        const name = parsedPath.name
            .replace(".test", "")
            .replace(".ts", "");
        const fullName = `${parts[parts.length - 1]}::${name}::${testCaseResult.title}`
        let failure = ""
        if (testCaseResult.failureMessages.length > 0) {
            failure = testCaseResult.failureMessages[0].split("\n")[0]
        }
        this.tests.push({name: fullName, status: testCaseResult.status, failure: failure})
    }

    onRunComplete(testContexts, results) {
        console.log("Done!", this.tests)
        const all = this.tests.map(test => this.formatTestLine(test)).join("\n")
        console.log(all)
        const failed = this.tests.filter(test => test.status === "failed").map(this.formatTestLine).join("\n")
        fs.writeFileSync("all-tests-report.txt", all)
        fs.writeFileSync("failed-tests-report.txt", failed)
    }

    formatTestLine(test) {
        let status = test.status

        switch (test.status) {
            case "passed":
                status = "✅"
                break
            case "failed":
                status = "❌"
                break
            case "skipped":
                status = "⚠️"
                break
        }


        const failure = test.failure ? " " + test.failure : ""
        return `${test.name} -> ${status}${failure}`
    }
}

module.exports = CustomReporter;