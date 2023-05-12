{
  description = "Script embedded in a web application that informs of the application's inputs to a serverless backend";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs";

  outputs = {
    self,
    nixpkgs,
  }: let
    pkgs = import nixpkgs {system = "aarch64-darwin";};
  in {
    packages.x86_64-linux.hello = nixpkgs.legacyPackages.x86_64-linux.hello;

    packages.x86_64-linux.default = self.packages.x86_64-linux.hello;

    devShell."aarch64-darwin" = with pkgs; (callPackage ./default.nix {inherit pkgs;}).shell;
  };
}
