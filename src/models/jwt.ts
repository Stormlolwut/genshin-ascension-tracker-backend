import base64url from "base64url";
import {Header} from "./header";
import {User} from "./user";
export class Jwt {
    private  static readonly secret: string = "iamstormiamthebest"
    private static header: Header = {
        alg: "HS256",
        typ: "JWT"
    }

    static async sign(user: User): Promise<string> {
        const header = base64url.encode(JSON.stringify(this.header))
        const payload = base64url.encode(JSON.stringify(user))

        const encoder =  new TextEncoder().encode(header + "." + payload + this.secret)
        const signature = await crypto.subtle.digest("SHA-256", encoder);

        const encodedSignature = base64url(Buffer.from(signature));

        return `${header}.${payload}.${encodedSignature}`;
    }

  static async verify(token: string): Promise<User | null> {
      const [encodedHeader, encodedPayload, encodedSignature] = token.split(".")

      const encoding = new TextEncoder().encode(encodedHeader + "." + encodedPayload + this.secret)
      const signature = await crypto.subtle.digest("SHA-256", encoding)

      const calculatedSignature = base64url(Buffer.from(signature))

      if (encodedSignature !== calculatedSignature) {
          return null
      }

      return JSON.parse(base64url.decode(encodedPayload))
  }
}
