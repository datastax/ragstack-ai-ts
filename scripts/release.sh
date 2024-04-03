#!/bin/bash
# NOTE: this script is compatible with Yarn 4.x
set -e
version=$11
if [ -z "$version" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Working directory not clean"
    exit 1
fi
tag="ragstack-ai-ts-$version"

git checkout main
git pull
echo ":: Bumping version to $version"
cd ragstack-ai-ts
yarn set version $version
cd ..
git commit -am "Release $version"
git tag $tag
git push origin main
git push origin $tag
echo "done."