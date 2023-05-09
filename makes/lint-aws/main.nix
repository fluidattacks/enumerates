{
  makeNodeJsEnvironment,
  makeScript,
  projectPath,
  ...
}:
let
  lintNodeEnv = makeNodeJsEnvironment {
    name = "lint-node-environment";
    nodeJsVersion = "16";
    packageJson = projectPath "/infra/aws/package.json";
    packageLockJson = projectPath "/infra/aws/package-lock.json";
  };
in
makeScript {
  entrypoint = ''
    eslint --fix infra/aws/**
  '';
  name = "lint-aws";
  searchPaths = {
    source = [ lintNodeEnv ];
  };
}