import * as fastify from 'fastify'


export type GetSecretCallback =
    ((request: fastify.FastifyRequest, keyId: string, cb: (e: Error | null | undefined, secret: string | undefined) => void) => void)
    | ((request: fastify.FastifyRequest, keyId: string | undefined) => Promise<string>)

export interface FastifyApiKeyOptions {
    getSecret: GetSecretCallback;
    requestProperty?: string,
    requestLifetime?: number | null
}


export const fastifyApiKey: fastify.FastifyPluginCallback<FastifyApiKeyOptions>

export default fastifyApiKey

declare module 'fastify' {
    interface FastifyRequest {
        apiKeyVerify(): Promise<void>

        apiKeyVerify(cb: (e: Error | null | undefined) => void): void
    }
}
