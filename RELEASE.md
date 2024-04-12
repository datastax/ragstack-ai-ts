# RAGStack releases

## Release @datastax/ragstack-ai
Ensure you have yarn installed and available in your path.

```bash
scripts/release-ragstack-ai.sh 0.3.0
```
### Release notes
Generate the dependency table for the release notes:
```bash
node scripts/generate-changelog.js 0.3.0
```
and copy the output to the changelog page in the documentation.

## Release @datastax/ragstack-ai-cli
Ensure you have yarn installed and available in your path.

```bash
scripts/release-ragstack-ai-cli.sh 0.3.0
```
