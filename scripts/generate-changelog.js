#!/usr/bin/node
const version =  process.argv[2]
if (!version) {
  throw new Error("Version is required")
}

fetch("https://registry.npmjs.org/@datastax/ragstack-ai/" +version)
  .then(res => res.json())
    .then(data => {
      let depsStr = ""
      for (const [name, version] of Object.entries(data.dependencies)) {
        depsStr += `\n| ${name}\n| ${version}\n`
      }

      console.log(`
== ${version}

[caption=]
.Dependencies
[%autowidth]
[cols="2*",options="header"]
|===
| Package | Version

${depsStr}

|===
      `)
    })
