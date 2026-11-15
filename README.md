# Zen Refined

Modular interface improvements for [Zen Browser](https://zen-browser.app/).

Zen Refined aims to reduce visual clutter while preserving Zen's native navigation, keyboard shortcuts and compact mode. Each module can be used independently.

> **Development preview:** no stable release is available yet. The CSS is experimental and has not been validated in a running Zen instance. Use a disposable profile for testing.

## Modules

| Module | Purpose | Status |
| --- | --- | --- |
| [OnePlane](mods/oneplane/) | A single horizontal toolbar with icon-first tabs, hover expansion and an expandable address bar. | Experimental layout |
| [General Improvements](mods/general-improvements/) | Small, independent visual refinements, starting with a configurable loading-animation backdrop. | Experimental CSS; native spacing setting confirmed |

## Getting started

- [Native Zen settings](docs/native-settings.md) — remove the content gap without installing a mod.
- [Manual installation and rollback](docs/installation.md) — opt-in CSS previews.
- [Design and test plan](docs/oneplane-design.md) — requirements and open issues.

## Development

The current source baseline is Zen 1.24.2b. Compatibility with other versions, themes, operating systems and split view is not yet established. Changes to browser internals may require updated selectors.

This is an independent community project, not an official Zen Browser product.

## License

[MIT](LICENSE). External projects are referenced for compatibility research; their code is not redistributed here.
