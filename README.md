# fastify-api-key

Fastify plugin to authenticate HTTP requests based on api key and signature.

## Installation

```
$ npm install --save fastify-api-key
```

## Usage

This middleware authenticates callers using an api key and the signature of the request. If the api key and the
signature are valid, `req.clientId` will be set with the calling application information.

### Example

This plugin decorates the fastify request with a  `apiKeyVerify`  function. You can use a global `onRequest` hook to
define the verification process like so:

```javascript
const fastify = require('fastify')()
const { Unauthorized } = require('http-errors')

const apiKeys = new Map()
apiKeys.set('123456789', 'secret1')
apiKeys.set('987654321', 'secret2')

fastify.register(require('fastify-api-key'), {
  getSecret: (request, clientId, cb) => {
    const secret = apiKeys.get(clientId)
    if (!secret) {
      return cb(Unauthorized('Unknown client'))
    }
    cb(null, secret)
  }
})

fastify.addHook('onRequest', async (request, reply) => {
  try {
    await request.apiKeyVerify()
  } catch (err) {
    reply.send(err)
  }
})

fastify.listen(3000, (err) => {
  if (err) throw err
})
```

Aftewards, you can use `request.clientId` to get the client id (api key) of the authenticated application :

```javascript
module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return request.clientId
  })
}
```

It is possible (and recommanded) to wrap your authentication logic into a plugin :

```javascript
const fp = require('fastify-plugin')

module.exports = fp(async function (fastify, opts) {
  fastify.register(require('fastify-api-key'), {
    getSecret: (request, clientId, cb) => {
      cb(null, 'secret')
    },
  })

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.apiKeyVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})
```

Then use the  `preValidation`  of a route to protect it & access the client id inside :

```javascript
module.exports = async function (fastify, opts) {
  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate]
    },
    async function (request, reply) {
      return request.clientId
    }
  )
}
```

## API

### fastifyApiKey(options)

Create an api key based authentication plugin using the given `options` :

|       Name        |      Type       |     Default     | Description                                     |
| :---------------: | :-------------: | :-------------: | :---------------------------------------------- |
|    `getSecret`    |   `Function`    |       `-`       | Invoked to retrieve the secret from the `keyId` component of the signature |
| `requestLifetime` | `Number | null` |      `300`      | The lifetime of a request in seconds            |

#### options.getSecret (REQUIRED)

A function with signature `function(request, clientId, done)` to be invoked to retrieve the secret from the `keyId`
component of the signature.

|       Name        |      Type       | Description                                     |
| :---------------: | :-------------: |:---------------------------------------------- |
| `request` | `FastifyRequest` |  The current fastify request instance
|    `clientId`    |   `string`    | The client id (api key) used to retrieve the secret component of the signature |
|    `done`    |   `Function`    | A function with signature `function(err, secret)`to be invoked when the secret is retrieved. |

A function with signature `function(request, clientId, done)`  to be invoked to retrieve the secret from the `keyId`
component of the signature.

- `request` (`FastifyRequest`) - The current fastify request.
- `clientId` (`String`) - The client id (`keyId`) used to retrieve the secret component of the signature.
- `done` (`Function`) - A function with signature `function(err, secret)` to be invoked when the secret is retrieved.

    - `err` (`Error`) - The error that occurred.
    - `secret` (`String`) - The secret to use to verify the signature.

#### options.requestLifetime (OPTIONAL)

The lifetime of a request in second, by default is set to 300 seconds, set it to null to disable it. This options is
used if HTTP header "date" is used to create the signature.

## HTTP signature scheme

Look ["HTTP signature scheme"](signature.md) to sign a HTTP request.

## License

Licensed under [MIT](./LICENSE).
