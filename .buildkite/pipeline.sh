#!/bin/bash

set -eou pipefail

while read -r changed_file;
do
  if [[ "${changed_file}" == src/enumerator.ts ]];
  then
    cat .buildkite/upload_script.yml
  fi
done < <(git diff HEAD~1 --name-only)
