/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import {User} from "./models/user";
import {Jwt} from "./models/jwt"
import * as crypto from "crypto-js";
import {CustomResponse} from "./models/responses/custom-response";
import {RequestLike, Router, RouteHandler} from "itty-router"

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace
	GAT_ACCOUNTS:  KVNamespace
	GAT_INVENTORY: KVNamespace
	GAT_FAVORITES: KVNamespace
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
}

type Middleware = (handler: RouteHandler) => RouteHandler;
const auth: Middleware = (handler: RouteHandler) => async (request, args) => {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) return new CustomResponse({ message: 'Bad request',  status: 400 }).send()

	const verified = await Jwt.verify(authHeader)

	if (!verified) return new CustomResponse({ message: 'Unauthorized', status: 401 }).send();

	args.jwt = {
		token: authHeader,
		...verified
	}
	return handler(request, args);
}

export default {
	headers() {
		return  {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS, POST",
			"Access-Control-Allow-Headers": "*",
		}
	},
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// TODO: change post to put, since we are using the put operation for the KV storage and that would reflect it better from the API perspective

		const router = Router()
		router
			.options("*",() => new Response("OK", { headers: this.headers() }))
			.get("/inventory", auth((request, args) => this.getInventory(request, args)))
			.post("/inventory", auth((request, args) => this.updateInventory(request, args)))
			.get("/favorites", auth((request, args) => this.getFavorites(request, args)))
			.post("/favorites", auth((request, args) => this.updateFavorites(request, args)))
			.post("/login", (request, args) => this.login(request, args))
			.post("/register", (request, args) => this.register(request, args))

		return await router.handle(request, {env, ctx, jwt: {}})

	},
	async updateFavorites(request: RequestLike, args: any) {
		// TODO: request json as right object
		const body = await request.json()

		if (!body) return new CustomResponse({ message: "Invalid body", status: 400 })

		await args.env.GAT_FAVORITES.put(args.jwt.token, JSON.stringify(body), { metadata: args.jwt.username })

		return new CustomResponse({ message: "Favorites updated!", status: 200 }).send()
	},
	async getFavorites(request: RequestLike, args: any){
		const result = await args.env.GAT_FAVORITES.get(args.jwt.token)

		if (!result) return new CustomResponse({ message: "Not found", status: 404, body: []}).send()

		return new CustomResponse({ message: "OK", status: 200, body: JSON.parse(result)}).send()
	},
	async getInventory(request: RequestLike, args: any) {
		const result = await args.env.GAT_INVENTORY.get(args.jwt.token)

		if (!result) return new CustomResponse({ message: "Not found", status: 404, body: []}).send()

		return new CustomResponse({ message: "OK", status: 200, body: JSON.parse(result)}).send()
	},
	async updateInventory(request: RequestLike, args: any) {
		// TODO: request json as right object
		const body = await request.json()

		if (!body) return new CustomResponse({ message: "Invalid body", status: 400 })

		await args.env.GAT_INVENTORY.put(args.jwt.token, JSON.stringify(body), { metadata: args.jwt.username })

		return new CustomResponse({ message: "OK", status: 200 }).send()
	},
	async login (request: RequestLike, args: any) {
		const user = await request.json() as User
		if (!user) return new CustomResponse({ message: "Invalid body", status: 400 }).send()

		const jwt = await this.getUserFromKv(user, args.env.GAT_ACCOUNTS)
		if(!jwt) return new CustomResponse({ message: "Could not retrieve user", status: 404 }).send()

		return new CustomResponse({ message: "OK", status: 200, body: jwt}).send()
	},
	async register(request: RequestLike, args: any){
		const user = await request.json() as User
		if (!user) return new CustomResponse({ message: "Invalid body", status: 404 }).send()

		let jwt = await this.getUserFromKv(user, args.env.GAT_ACCOUNTS)
		if(jwt) return new CustomResponse({ message: "Logged in!", status: 200, body: jwt}).send()

		jwt = await this.putUserIntoKv(user, args.env.GAT_ACCOUNTS)
		await args.env.GAT_INVENTORY.put(jwt, JSON.stringify([]), { metadata: args.jwt.username })
		await args.env.GAT_FAVORITES.put(jwt, JSON.stringify([]), { metadata: args.jwt.username })

		return new CustomResponse({ message: "Logged in!", status: 200, body: jwt}).send()
	},

	async getUserFromKv (user: User, kv: KVNamespace): Promise<string | null> {
		const key = crypto.SHA256(JSON.stringify(user)).toString();
		return await kv.get(key)
	},

	async putUserIntoKv (user: User, kv: KVNamespace): Promise<string> {
		const key = crypto.SHA256(JSON.stringify(user)).toString();
		const token = await Jwt.sign(user)

		await kv.put(key, token)
		return token
	}
};
