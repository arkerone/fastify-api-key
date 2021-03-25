# fastify-api-key

![CI](https://github.com/arkerone/fastify-api-key/workflows/CI/badge.svg)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

Fastify plugin to authenticate HTTP requests based on api key and signature.

## Installation

```  
$ npm install --save fastify-api-key  
```  

## Usage

This middleware authenticates callers using an api key and the signature of the request.

### Example

This plugin decorates the fastify request with a  `apiKeyVerify` function. You can use a global `onRequest` hook to
define the verification process :

```javascript  
const fastify = require('fastify')()  
const { Unauthorized } = require('http-errors')  
  
const apiKeys = new Map()  
apiKeys.set('123456789', 'secret1')  
apiKeys.set('987654321', 'secret2')  
  
fastify.register(require('fastify-api-key'), {  
  getSecret: (request, keyId, callback) => {  
    const secret = apiKeys.get(keyId)  
    if (!secret) {  
      return callback(Unauthorized('Unknown client'))  
    }  
    callback(null, secret)  
  },  
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

It is possible (and recommanded) to wrap your authentication logic into a plugin :

```javascript  
const fp = require('fastify-plugin')  
  
module.exports = fp(async function (fastify, opts) {  
  fastify.register(require('fastify-api-key'), {  
    getSecret: (request, keyId, callback) => {  
      callback(null, 'secret')  
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

Then use the  `preValidation` of a route to protect it :

```javascript  
module.exports = async function (fastify, opts) {  
  fastify.get(  
    '/', {  
      preValidation: [fastify.authenticate],  
    }, async function (request, reply) {  
      reply.send({ hello: 'world' })  
    })  
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

A function with signature `function(request, keyId, callback)` to be invoked to retrieve the secret from the `keyId`
component of the signature.

- `request` (`FastifyRequest`) - The current fastify request.
- `keyId` (`String`) - The api key used to retrieve the secret.
- `callback` (`Function`) - A function with signature `function(err, secret)` to be invoked when the secret is
  retrieved.
    - `err` (`Error`) - The error that occurred.
    - `secret` (`String`) - The secret to use to verify the signature.

```javascript  
const fastify = require('fastify')()  
const { Unauthorized } = require('http-errors')  
  
const apiKeys = new Map()  
apiKeys.set('123456789', 'secret1')  
apiKeys.set('987654321', 'secret2')  
  
fastify.register(require('fastify-api-key'), {  
  getSecret: (request, keyId, callback) => {  
    const secret = apiKeys.get(keyId)  
    if (!secret) {  
      return callback(Unauthorized('Unknown client'))  
    }  
    callback(null, secret)  
  },  
})
  ```  

The `callback` parameter is optional. In the case `getSecret` must return a promise with the secret value:

```javascript  
const fastify = require('fastify')()  
const { Unauthorized } = require('http-errors')  
  
const apiKeys = new Map()  
apiKeys.set('123456789', 'secret1')  
apiKeys.set('987654321', 'secret2')  
  
fastify.register(require('fastify-api-key'), {  
  getSecret: async (request, keyId) => {  
    const secret = apiKeys.get(keyId)  
    if (!secret) {  
      return callback(Unauthorized('Unknown client'))  
    }  
    return secret  
  },  
})
 ```  

#### options.requestLifetime (OPTIONAL)

The lifetime of a request in second, by default is set to 300 seconds, set it to `null` to disable it. This options is
used if HTTP header "date" is used to create the signature.

### request.apiKeyVerify(callback)

- `callback` (`Function`) - A function with signature `function(err)` to be invoked when the secret is retrieved.
    - `err` (`Error`) - The error that occurred.

```javascript  
fastify.get('/verify', function (request, reply) {  
  request.apiKeyVerify(function (err) {  
    return reply.send(err || { hello: 'world' })  
  })  
})
```  

The `callback` parameter is optional. In the case `apiKeyVerify` return a promise.

```javascript  
fastify.get('/verify', async function (request, reply) {  
  try {  
    await request.apiKeyVerify()  
    reply.send({ hello: 'world' })  
  } catch (err) {  
    reply.send(err)  
  }  
})
```  

## HTTP signature scheme

The signature is based on this
draft ["Signing HTTP Messages"](https://tools.ietf.org/html/draft-cavage-http-signatures-09). Your application must
provide to the client application both unique identifier :

* **key** : A key used to identify the client application;
* **shared secret**: A secret key shared between your application and the client application used to sign the requests
  and authenticate the client application.

### HTTP header

The signature must be sent in the HTTP header "Authorization" with the authentication scheme "Signature" :

```  
Authorization: Signature keyId="API_KEY",algorithm="hmac-sha256",headers="(request-target) host date digest content-length",signature="Base64(HMAC-SHA256(signing string))"  
```  

Let's see the different components of the signature :

* **keyId (REQUIRED)** : The client application's key;
* **algorithm (REQUIRED)** : The algorithm used to create the signature;
* **header (OPTIONAL)** : The list of HTTP headers used to create the signature of the request. If specified, it should
  be a lowercased, quoted list of HTTP header fields, separated by a single space character. If not specified,
  the `Date` header is used by default therefore the client must send this `Date` header. Note : The list order is
  important, and must be specified in the order the HTTP header field-value pairs are concatenated together during
  signing.
* **signature (REQUIRED)** : A base 64 encoded digital signature. The client uses the `algorithm` and `headers`
  signature parameters to form a canonicalized `signing string`.

### Signature string construction

To generate the string that is signed with the shared secret and the `algorithm`, the client must use the values of each
HTTP header field in the `headers` Signature parameter in the order they appear.

To include the HTTP request target in the signature calculation, use the special `(request-target)` header field name.

1. If the header field name is `(request-target)` then generate the header field value by concatenating the lowercased
   HTTP method, an ASCII space, and the path pseudo-headers (example : get /protected);
2. Create the header field string by concatenating the lowercased header field name followed with an ASCII colon `:`, an
   ASCII space `` and the header field value. If there are multiple instances of the same header field, all header field
   values associated with the header field must be concatenated, separated by a ASCII comma and an ASCII space `,`, and
   used in the order in which they will appear in the HTTP request;
3. If value is not the last value then append an ASCII newline `\n`.

To illustrate the rules specified above, assume a `headers` parameter list with the value
of `(request-target) host date cache-control x-test` with the following HTTP request headers:

```  
GET /protected HTTP/1.1  
Host: example.org  
Date: Tue, 10 Apr 2018 10:30:32 GMT  
x-test: Hello world  
Cache-Control: max-age=60  
Cache-Control: must-revalidate  
```  

For the HTTP request headers above, the corresponding signature string is:

```  
(request-target): get /protected  
host: example.org  
date: Tue, 10 Apr 2018 10:30:32 GMT  
cache-control: max-age=60, must-revalidate  
x-test: Hello world  
```  

### Signature creation

In order to create a signature, a client must :

1. Create the signature string as described in [signature string construction](#signature-string-construction);

2. The `algorithm` and shared secret associated with `keyId` must then be used to generate a digital signature on the
   signature string;

3. The `signature` is then generated by base 64 encoding the output of the digital signature algorithm.

### Supported algorithms

Currently supported algorithm names are:

* hmac-sha1
* hmac-sha256
* hmac-sha512

## License

Licensed under [MIT](./LICENSE).
