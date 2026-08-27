{
  description = "Vintage AI listing assistant development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            gh
            git
            jdk
            nodejs_24
            playwright-driver.browsers
          ];

          shellHook = ''
            # Keep Firebase emulator and Playwright browser artifacts stable
            # across separate Nix shell invocations and CI runs.
            export XDG_CACHE_HOME="$PWD/.cache"
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
          '';
        };
      });
}
