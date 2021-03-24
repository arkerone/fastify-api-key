import {expectAssignable} from 'tsd'
import fastify, {
    FastifyRequest
} from 'fastify'
import fastifyApiKey from '.'

const app = fastify()

app.register(fastifyApiKey, {
    getSecret: async function validatePromise(request, clientId) {
        expectAssignable<FastifyRequest>(request)
        expectAssignable<string>(clientId)
    },
    requestLifetime: 300
})

app.register(fastifyApiKey, {
    getSecret: function validateCallback(request, clientId, cb) {
        expectAssignable<FastifyRequest>(request)
        expectAssignable<string>(clientId)
        expectAssignable<(e: Error | null | undefined, secret: string | undefined) => void>(cb)
    },
    requestLifetime: 300
})


app.addHook("preHandler", async (request, reply) => {
    expectAssignable<Function>(request.apiKeyVerify)
    expectAssignable<string>(request.clientId)

    try {
        await request.apiKeyVerify();
    } catch (err) {
        reply.send(err);
    }
});
