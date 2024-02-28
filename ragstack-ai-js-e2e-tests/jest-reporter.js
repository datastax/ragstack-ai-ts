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
        console.log(testCaseResult)
        const parsedPath = path.parse(test.path);
        const parts = parsedPath.dir.split("/").filter(part => part !== "tests");
        const name = parsedPath.name
            .replace(".test", "")
            .replace(".ts", "");
        const fullName = `${parts[parts.length - 1]}::${name}::${testCaseResult.title}`
        console.log(fullName)
        let failure = ""
        if (testCaseResult.failureMessages.length > 0) {
            failure = testCaseResult.failureMessages[0]
        }
        this.tests.push({name: fullName, status: testCaseResult.status, failure: failure})
    }

    _parseStatus(status) {
        switch (status) {
            case "passed":
                return "✅"
            case "failed":
                return "❌"
            case "skipped":
                return "⚠️"
            default:
                return "UNKNOWN"
        }
    }

    onRunComplete(testContexts, results) {
        console.log("Done!", this.tests)
        const all = this.tests.map(test => {
            const failure = test.failure ? ` ${test.failure}` : ""
            return `${test.name} -> ${this._parseStatus(test.status)}`
        }).join("\n")
        console.log(all)
        fs.writeFileSync("all-tests-report.txt", all)
    }
}

module.exports = CustomReporter;