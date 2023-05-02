import {Options} from "./options";

export class CustomResponse {
    private readonly headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json;charset=UTF-8"
    }
    constructor(private options: Options, headers?: object) {
        this.headers = { ...this.headers, ...headers }
    }
    send() {
        return new Response(JSON.stringify(this.options), { status: this.options.status, headers: this.headers})
    }
}
