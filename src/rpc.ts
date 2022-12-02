import nacl from "tweetnacl";
import bs58 from "bs58";
import { TextEncoder } from "util";
import { Keypair } from "@solana/web3.js";
import axios from "axios";
import { RedisClientType, RedisFunctions, RedisScripts } from "@redis/client";
import { RedisDefaultModules } from "redis";

type RedisStore = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>

/**
 * Update gengo token every hour
 */
export async function updateGenGoToken(store: RedisStore) {
  if (!await shouldUpdateToken(store)) {
    return;
  }

  const { message, wallet } = await signMessage();
  // Send auth request with wallet pubkey and signed message payload
  console.log("Sending auth request", process.env.API_URL_BASE);
  let body = {
    message,
    signer: wallet.publicKey.toString(),
  };
  console.log({ body });
  const authRequest = await axios(`${process.env.API_URL_BASE}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(body),
  });
  console.log("Validating auth request");
  // Validate that the request is ok
  if (authRequest.status !== 200) {
    console.error("Error occurred:", authRequest.status);
    return;
  }
  // Convert response into json
  const authResponse = authRequest.data;
  // Validate that a token is in the response body
  if (typeof authResponse?.token !== "string") {
    console.log("No valid auth token returned.");
    return;
  }
  console.log(authResponse);
  // Get JWT Auth Token
  // const token = authResponse.token;
  const tokenRequest = await axios(
    `${process.env.API_URL_BASE}/premium/token/${process.env.RPC_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authResponse.token}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (tokenRequest.status !== 200) {
    console.error("Error occurred:", tokenRequest.status);
    return;
  }
  // Convert response to json
  const tokenResponse = tokenRequest.data;
  if (typeof tokenResponse?.token !== "string") {
    console.log("No valid jwt token returned");
    return;
  }
  // Send token to Redis
  await store.set("RPC_TOKEN", tokenResponse.token);
  await store.set("RPC_TOKEN_TS", Date.now().toString())
  console.log("Set RPC_TOKEN to", tokenResponse.token);
  console.log("Set RPC_TOKEN_TS to", Date.now().toString());
}

export async function getRPCToken(store: RedisStore) {
  return await store.get('RPC_TOKEN');
}

async function shouldUpdateToken(store: RedisStore) {
  let lastUpdateTs = Number(await store.get("RPC_TOKEN_TS")) || 0
  let isOneHourAgo = lastUpdateTs + (1 * 60 * 60 * 1000) < Date.now()

  if (isOneHourAgo) {
    return true
  }
  return false
}

async function signMessage() {
  // Get wallet from local keypair file a keypair variable passed in
  const key = JSON.parse(process.env.WALLET_KEY!);
  // const key = JSON.parse(process.env.WALLET_KEY as string);
  const wallet = Keypair.fromSecretKey(new Uint8Array(key));
  console.log("Read wallet ", wallet.publicKey.toString());
  // Build and sign message
  const msg = new TextEncoder().encode(`Sign in to GenesysGo Shadow Platform.`);
  const message = bs58.encode(nacl.sign.detached(msg, wallet.secretKey));
  return { message, wallet }
}