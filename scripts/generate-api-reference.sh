#!/bin/bash

set -e

here=$(pwd)
ragstack_version=$1
if [ -z "$ragstack_version" ]; then
  echo "Usage: $0 <ragstack_version>"
  exit 1
fi

langchain_version=$(curl -Ls "https://registry.npmjs.org/@datastax/ragstack-ai-ts/${ragstack_version}" | jq -r '.dependencies.langchain')
echo "langchain_version: $langchain_version"

clone_lc() {
  rm -rf /tmp/lc
  git clone https://github.com/langchain-ai/langchainjs.git --branch ${langchain_version} --depth 1 /tmp/lc
}
clone_lc
cd /tmp/lc/docs/api_refs
yarn install
yarn build

ls -la public

mkdir -p $here/dist
mkdir -p $here/dist/api_reference
mkdir -p $here/dist/api_reference/$ragstack_version
mkdir -p $here/dist/api_reference/$ragstack_version/langchain
cp -r public/* $here/dist/api_reference/$ragstack_version/langchain