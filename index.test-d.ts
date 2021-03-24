import {expectAssignable} from 'tsd'
import fastify, {
    FastifyRequest
} from 'fastify'
import fastifyApiKey from '.'

const app = fastify()

app.register(fastifyApiKey, {
    getSecret: async function validatePromise(request, keyId) {
        expectAssignable<FastifyRequest>(request)
        expectAssignable<string>(keyId)
    },
    requestLifetime: 300
})

app.register(fastifyApiKey, {
    getSecret: function validateCallback(request, keyId, cb) {
        expectAssignable<FastifyRequest>(request)
        expectAssignable<string>(keyId)
        expectAssignable<(e: Error | null | undefined, secret: string | undefined) => void>(cb)
    },
    requestLifetime: 300
})


app.addHook("preHandler", async (request, reply) => {
    expectAssignable<Function>(request.apiKeyVerify)
    
    try {
        await request.apiKeyVerify();
    } catch (err) {
        reply.send(err);
    }
});
