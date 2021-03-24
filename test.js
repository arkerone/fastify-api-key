const { test } = require('tap')
const Fastify = require('fastify')
const crypto = require('crypto')
const apiKey = require('./index')

test('register', (t) => {
  t.plan(2)

  t.test('Should expose api key methods', (t) => {
    t.plan(1)
    const fastify = Fastify()
    fastify.register(apiKey, {
      getSecret: async () => {
        return 'test'
      }
    })
    fastify.get('/methods', (request) => {
      t.ok(request.apiKeyVerify)
    })

    fastify.inject({
      method: 'get',
      url: '/methods'
    })
  })

  t.test('should failed if "getSecret" is missing', (t) => {
    t.plan(1)
    const fastify = Fastify()
    fastify.register(apiKey).ready((error) => {
      t.is(error.message, 'missing getSecret')
    })
  })
})

test('requestVerify', (t) => {
  t.plan(6)

  const keyId = '123456789'
  const secret = 'secret'
  const date = (new Date()).toString()
  const host = 'http://localhost'
  const signingString = `(request-target): get /verify\nhost: ${host}\ndate: ${date}`
  const signature = crypto.createHmac('sha1', secret).update(signingString).digest('base64')

  const authorization = `Signature keyId="${keyId}",algorithm="hmac-sha1",headers="(request-target) host date",signature="${signature}"`

  t.test('getSecret', (t) => {
    t.plan(3)

    async function runWithGetSecret (t, getSecret) {
      const fastify = Fastify()
      fastify.register(apiKey, { getSecret })

      fastify.get('/verify', async (request) => {
        await request.apiKeyVerify()
        return 'test'
      })

      await fastify.ready()

      const verifyResponse = await fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization,
          date,
          host
        }
      })

      t.is(verifyResponse.payload, 'test')
    }

    t.test('getSecret as a function with callback', (t) => {
      return runWithGetSecret(t, (request, keyId, callback) => {
        callback(null, secret)
      })
    })

    t.test('getSecret as a function returning a promise', (t) => {
      return runWithGetSecret(t, () => {
        return Promise.resolve(secret)
      })
    })

    t.test('getSecret as an async function', (t) => {
      return runWithGetSecret(t, async () => {
        return secret
      })
    })
  })

  t.test('disable the checking of request expiration', (t) => {
    t.plan(1)
    const fastify = Fastify()

    fastify.register(apiKey, {
      requestLifetime: null,
      getSecret: (request, keyId, cb) => {
        cb(null, secret)
      }
    })

    fastify.get('/verify', async (request) => {
      await request.apiKeyVerify()
      return 'test'
    })

    const date = new Date('1970-01-01').toString()
    const signingString = `date: ${date}`
    const signature = crypto.createHmac('sha1', secret).update(signingString).digest('base64')

    const authorizationWithoutHeader = `Signature keyId="${keyId}",algorithm="hmac-sha1",signature="${signature}"`

    fastify.inject({
      method: 'get',
      url: '/verify',
      headers: {
        authorization: authorizationWithoutHeader,
        date
      }
    }).then((response) => {
      t.is(response.payload, 'test')
    })
  })

  t.test('Authorization signature without headers value', (t) => {
    t.plan(1)
    const fastify = Fastify()

    fastify.register(apiKey, {
      getSecret: (request, keyId, cb) => {
        cb(null, secret)
      }
    })

    fastify.get('/verify', async (request) => {
      await request.apiKeyVerify()
      return 'test'
    })

    const signingString = `date: ${date}`
    const signature = crypto.createHmac('sha1', secret).update(signingString).digest('base64')

    const authorizationWithoutHeader = `Signature keyId="${keyId}",algorithm="hmac-sha1",signature="${signature}"`

    fastify.inject({
      method: 'get',
      url: '/verify',
      headers: {
        authorization: authorizationWithoutHeader,
        date
      }
    }).then((response) => {
      t.is(response.payload, 'test')
    })
  })

  t.test('synchronous requestVerify', (t) => {
    t.plan(1)
    const fastify = Fastify()

    fastify.register(apiKey, {
      getSecret: (request, keyId, cb) => {
        cb(null, secret)
      }
    })

    fastify.get('/verify', async (request) => {
      await request.apiKeyVerify()
      return 'test'
    })

    fastify.inject({
      method: 'get',
      url: '/verify',
      headers: {
        authorization,
        date,
        host
      }
    }).then((response) => {
      t.is(response.payload, 'test')
    })
  })

  t.test('asynchronous requestVerify', (t) => {
    t.plan(1)
    const fastify = Fastify()

    fastify.register(apiKey, {
      getSecret: (request, keyId, cb) => {
        cb(null, secret)
      }
    })

    fastify.get('/verify', (request, reply) => {
      request.apiKeyVerify((error) => {
        return reply.send(error || 'test')
      })
    })

    fastify.inject({
      method: 'get',
      url: '/verify',
      headers: {
        authorization,
        date,
        host
      }
    }).then((response) => {
      t.is(response.payload, 'test')
    })
  })

  t.test('errors', (t) => {
    t.plan(8)

    const signature = 'Signature keyid="123456789",algorithm="hmac-sha1",headers="host date",signature="signature"'
    const fastify = Fastify()
    fastify.register(apiKey, {
      getSecret: (request, keyId, cb) => {
        cb(null, 'secret')
      }
    })

    fastify.get('/verify', (request, reply) => {
      request.apiKeyVerify().then(() => {
        return reply.send('test')
      }).catch((error) => {
        return reply.send(error)
      })
    })

    t.test('should failed if HTTP header "Authorization" is not present',
      (t) => {
        t.plan(2)

        fastify.inject({
          method: 'get',
          url: '/verify'
        }).then((response) => {
          const error = JSON.parse(response.payload)
          t.is(error.message, 'Missing required HTTP headers : authorization')
          t.is(response.statusCode, 401)
        })
      })

    t.test('should failed if the auth scheme of the HTTP header "Authorization" is not valid', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: 'Invalid Format'
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message,
          'Bad value format for the HTTP header Authorization. Expected format : Signature [params]')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should throw if the signature parameters are not valid', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: 'Signature bad_params'
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message,
          'Missing required signature parameters : keyid, algorithm, signature')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should failed if the algorithm is not supported', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: 'Signature keyid="123456789",algorithm="unknown_algorithm",headers="host date",signature="test"'
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message, 'Unsupported algorithm')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should failed if required headers for signature are missing', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: signature
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message, 'Missing required HTTP headers : date')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should failed if the HTTP header date is malformed', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: signature,
          date: 'malformed_date'
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message,
          'Bad value format for the HTTP header date. Expected format : <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should failed if the request is expired', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: signature,
          date: 'Wed, 24 Mar 2021 06:00:00 GMT'
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message, 'Request has expired')
        t.is(response.statusCode, 400)
      })
    })

    t.test('should failed if the signature is invalid', (t) => {
      t.plan(2)

      fastify.inject({
        method: 'get',
        url: '/verify',
        headers: {
          authorization: signature,
          date: (new Date()).toString()
        }
      }).then((response) => {
        const error = JSON.parse(response.payload)
        t.is(error.message, 'Authorization signature is invalid')
        t.is(response.statusCode, 401)
      })
    })
  })
})
