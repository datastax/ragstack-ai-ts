const fs = require("fs");
const path = require("path")

const parentJson = path.resolve("package.json")

function getDeps() {
  const packageJson = path.resolve("packages", "ragstack-ai-ts", "package.json")
  const parsed = JSON.parse(fs.readFileSync(packageJson))
  return parsed.dependencies
}

const deps = getDeps();
const parsed = JSON.parse(fs.readFileSync(parentJson))

parsed.resolutions = {
  ...(parsed.resolutions || {}),
  ...deps
}
fs.writeFileSync(parentJson, JSON.stringify(parsed, null,2))
console.log("Fixed resolutions in package.json")


