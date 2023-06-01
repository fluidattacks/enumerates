#!/bin/bash

set -eou pipefail

echo "steps:"

while read -r changed_file;
do
  if [[ "${changed_file}" == src/enumerator.ts ]];
  then
    buildkite-agent pipeline upload .buildkite/upload_script.yml
  fi
done < <(git diff HEAD~1 --name-only)
