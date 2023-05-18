{
  description = "Script embedded in a web application that informs of the application's inputs to a serverless backend";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    pulumi_3_67_0 = {
      flake = false;
      url = "https://github.com/pulumi/pulumi/releases/download/v3.67.0/pulumi-v3.67.0-darwin-arm64.tar.gz";
    };
  };

  outputs = {
    self,
    nixpkgs,
    pulumi_3_67_0,
  }: let
    pkgs = nixpkgs.legacyPackages.aarch64-darwin;
  in {
    packages.x86_64-linux.hello = pkgs.hello;

    packages.x86_64-linux.default = self.packages.x86_64-linux.hello;

    devShell."aarch64-darwin" = let
      nodeEnv = pkgs.callPackage ./default.nix {inherit pkgs;};
    in
      pkgs.mkShell {
        buildInputs = [
          nodeEnv.shell.nodeDependencies
        ];
        shellHook = ''
          export NODE_PATH="${nodeEnv.shell.nodeDependencies}/lib/node_modules"
          export PATH="${pulumi_3_67_0}:$PATH"

          ln -fs $NODE_PATH node_modules
          ln -fs $NODE_PATH infra/aws/node_modules
        '';
      };
  };
}
