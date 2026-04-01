/**
 * Extract COSE credential public key from stored registration attestation object
 * (passkey_credentials.public_key holds base64(attestationObject) from the client).
 */
import {
  decodeAttestationObject,
  isoBase64URL,
  parseAuthenticatorData,
} from "npm:@simplewebauthn/server@13.2.2/helpers";

export function stdBase64ToUint8Array(b64: string): StrictBytes {
  const s = b64.replace(/\s/g, "");
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  const buf = new ArrayBuffer(out.length);
  new Uint8Array(buf).set(out);
  return new Uint8Array(buf) as StrictBytes;
}

/** WebCrypto / DOM typings use ArrayBufferLike; SimpleWebAuthn expects ArrayBuffer-backed views. */
export type StrictBytes = Uint8Array<ArrayBuffer>;

/** Copy into a fresh ArrayBuffer-backed Uint8Array (strict typing for SimpleWebAuthn). */
export function copyU8(a: Uint8Array): StrictBytes {
  const buf = new ArrayBuffer(a.byteLength);
  new Uint8Array(buf).set(a);
  return new Uint8Array(buf) as StrictBytes;
}

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** Decode stored attestation object → COSE public key bytes for assertion verification. */
export function extractCredentialPublicKeyFromAttestationBase64(
  attestationObjectStdBase64: string,
): StrictBytes | null {
  let bytes: Uint8Array;
  try {
    bytes = stdBase64ToUint8Array(attestationObjectStdBase64);
  } catch {
    return null;
  }
  try {
    const att = decodeAttestationObject(copyU8(bytes));
    const authData = att.get("authData");
    if (!authData?.length) return null;
    const parsed = parseAuthenticatorData(authData);
    if (!parsed.credentialPublicKey?.length) return null;
    return copyU8(new Uint8Array(parsed.credentialPublicKey));
  } catch {
    return null;
  }
}

/** Normalize client JSON (std base64 fields) → SimpleWebAuthn AuthenticationResponseJSON. */
export function toAuthenticationResponseJSON(credential: {
  id: string;
  rawId: string;
  type?: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
}): {
  id: string;
  rawId: string;
  type: "public-key";
  clientExtensionResults: Record<string, unknown>;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
} {
  const rawBytes = stdBase64ToUint8Array(credential.rawId);
  const idB64u = isoBase64URL.fromBuffer(copyU8(rawBytes));
  return {
    id: idB64u,
    rawId: idB64u,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: isoBase64URL.fromBuffer(
        copyU8(stdBase64ToUint8Array(credential.response.clientDataJSON)),
      ),
      authenticatorData: isoBase64URL.fromBuffer(
        copyU8(stdBase64ToUint8Array(credential.response.authenticatorData)),
      ),
      signature: isoBase64URL.fromBuffer(
        copyU8(stdBase64ToUint8Array(credential.response.signature)),
      ),
      ...(credential.response.userHandle
        ? {
          userHandle: isoBase64URL.fromBuffer(
            copyU8(stdBase64ToUint8Array(credential.response.userHandle)),
          ),
        }
        : {}),
    },
  };
}

/** Match DB credential_id (base64url or legacy std base64) to assertion rawId bytes. */
export function credentialIdMatchesStored(
  storedCredentialId: string,
  assertionRawIdBytes: Uint8Array,
): boolean {
  let storedBytes: Uint8Array;
  try {
    storedBytes = isoBase64URL.toBuffer(storedCredentialId);
  } catch {
    try {
      storedBytes = stdBase64ToUint8Array(storedCredentialId);
    } catch {
      return false;
    }
  }
  return uint8ArraysEqual(storedBytes, assertionRawIdBytes);
}
