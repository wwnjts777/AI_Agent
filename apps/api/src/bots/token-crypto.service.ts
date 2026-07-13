import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

@Injectable()
export class TokenCryptoService {
  private key() {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(32, 1);
    if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    return key;
  }

  encrypt(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return {
      tokenCiphertext: ciphertext.toString("base64"),
      tokenIv: iv.toString("base64"),
      tokenAuthTag: cipher.getAuthTag().toString("base64"),
      tokenLast4: token.slice(-4)
    };
  }

  decrypt(input: { tokenCiphertext: string; tokenIv: string; tokenAuthTag: string }) {
    const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(input.tokenIv, "base64"));
    decipher.setAuthTag(Buffer.from(input.tokenAuthTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(input.tokenCiphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  mask(last4?: string | null) {
    return last4 ? `••••••••${last4}` : null;
  }
}
