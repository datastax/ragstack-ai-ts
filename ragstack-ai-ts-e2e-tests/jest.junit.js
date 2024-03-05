const {readFileSync, existsSync} = require("fs");

const FILENAME = "junit-test-properties.json";
module.exports = (testResult) => {
    if (!existsSync(FILENAME)) {
        return {}
    }
    const all = JSON.parse(readFileSync(FILENAME))
    return all[testResult.fullName] || {}
};