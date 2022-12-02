import cors from 'cors'
import express from 'express'
import axios from 'axios'
import { createClient } from 'redis'
import { URL } from 'url'

import { getRPCToken } from './rpc';
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')

const app = express()

// If you are running behind a proxy, you need this to get the right IP
// in the rate limiter.
app.set('trust proxy', 1);

app.use(express.json());

// Apply origin whitelist from env config.
// By default you get an all open CORS config.
if (process.env.ORIGIN_WHITELIST) {
  const allowedOrigins = process.env.ORIGIN_WHITELIST.split(',')

  // CORS config
  const corsOptions: cors.CorsOptions = {
    origin: allowedOrigins
  }
  app.use(cors(corsOptions))

  // Origin header validation
  app.all('*', (req, res, next) => {
    const origin = req.get('origin') || ''
    if (allowedOrigins.indexOf(origin) < 0) {
      return res.sendStatus(401)
    }
    return next()
  })
} else {
  app.use(cors())
}

(async () => {
  const redisNativeClient = createClient({
    url: redisUrl.toString()
  });

  await redisNativeClient.connect();

  const rateLimiterStore = new RedisStore({
    prefix: "rl",
    sendCommand: async (...args: string[]) => redisNativeClient.sendCommand(args),
  });

  const limiter = rateLimit({
    windowMs: 10000, // 10 seconds
    max: 50, // Limit each IP to 50 requests per `window` (here, per 10 sec)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many accounts created from this IP, please try again after an hour',
    store: rateLimiterStore
  })

  app.use(limiter);

  app.get('/login', async (_req, res) => {
    const access_token = await getRPCToken(redisNativeClient);

    return res.send(JSON.stringify({ access_token }));
  });
})()

// Start api server
const httpPort = parseInt(process.env.PORT || '5000')
app.listen(httpPort, () => {
  console.log(`listening on *:${httpPort}`);
});

process.on('unhandledRejection', (err: any, p: any) => {
  console.error(`Unhandled rejection: ${err} promise: ${p})`)
})