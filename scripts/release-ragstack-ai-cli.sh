#!/bin/bash
set -e
version=$1
if [ -z "$version" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Working directory not clean"
    exit 1
fi
tag="ragstack-ai-cli-$version"

git checkout main
git pull
echo ":: Bumping version to $version"
cd packages/ragstack-ai-cli
export NEW_VERSION=$version
yarn run release:set-version
cd ../..
git commit -am "Release CLI $version"
git tag $tag
git push origin main
git push origin $tag
echo "done."
