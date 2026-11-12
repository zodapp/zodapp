## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- Initial public release preparation
- zod-dynamodb: add `subscribeOnServer`, which lets server code subscribe to a `live` query. Server-only queries (without `authorize`) can now be `live`; the Realtime Gateway does not expose them
- taskmanager: distribute member changes as revocations, so every instance rebuilds the auth context of the affected Realtime connections even with multiple Realtime Gateways
- zod-transform: fix intersection so that the right side's pass-through values no longer overwrite the left side's transformed values. A key removed by `$remove` on one side is now kept removed when the other side only passes it through
