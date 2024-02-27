class CustomReporter {
    constructor(globalConfig, reporterOptions, reporterContext) {
        this._globalConfig = globalConfig;
        this._options = reporterOptions;
        this._context = reporterContext;
    }

    onTestResult(
        test,
        testResult,
        aggregatedResultst
    ) {
        // console.log(test)
        // console.log(`onTestResult test: ${JSON.stringify(test, null, 2)}`)
        //
        // console.log(
        //     `onTestResult testResult: ${JSON.stringify(testResult, null, 2)}`
        // )
        //
        // console.log(
        //     `onTestResult aggregatedResults: ${JSON.stringify(
        //         aggregatedResults,
        //         null,
        //         2
        //     )}`
        // )
    }
}

module.exports = CustomReporter;