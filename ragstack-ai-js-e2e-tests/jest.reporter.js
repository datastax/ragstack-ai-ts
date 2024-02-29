const path = require('path');
const fs = require('fs');

class CustomReporter {

    constructor(globalConfig, reporterOptions, reporterContext) {
        this._globalConfig = globalConfig;
        this._options = reporterOptions;
        this._context = reporterContext;
        this.tests = []
    }

    onTestResult(test, testResult) {
        if (testResult.numPendingTests > 0) {
            testResult.testResults.forEach(result => {
                    if (result.status === 'pending') {
                        const fullName = this.generateTestNameForReport(test.path, result.title);
                        this.tests.push({name: fullName, status: "skipped", failure: ""})
                    }
                }
            )
        }
    }


    onTestCaseResult(test, testCaseResult) {
        const fullName = this.generateTestNameForReport(test.path, testCaseResult.title);
        let failure = ""
        if (testCaseResult.failureMessages.length > 0) {
            failure = testCaseResult.failureMessages[0].split("\n")[0]
        }
        this.tests.push({name: fullName, status: testCaseResult.status, failure: failure})
    }

    generateTestNameForReport(testPath, title) {
        const parsedPath = path.parse(testPath);
        const parts = parsedPath.dir.split("/").filter(part => part !== "tests");
        const name = parsedPath.name
            .replace(".test", "")
            .replace(".ts", "");
        return `${parts[parts.length - 1]}::${name}::${title}`
    }

    onRunComplete(testContexts, results) {
        const all = this.tests.map(test => this.formatTestLine(test)).join("\n")
        console.log("Test report:")
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