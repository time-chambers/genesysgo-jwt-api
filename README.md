# GenesysGo JWT auth API

Generate and store a JWT to share with your consumers apps.

## Configuration

* All configuration should be handled via environment variables.
  So far the following variables exist:

```
REDISCLOUD_URL: redis connection url
REDIS_MAX_CONN: maximum number of concurrent connections used by the redis pool
RPC_ENDPOINT_URL: your genesysgo node rpc url
REFRESH_INTERVAL: time in seconds to wait between event JWT refresh
```

## Questions / Suggestions?

👋 Reach us on our [discord](https://discord.gg/)
