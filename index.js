'use strict'

const crypto = require('crypto')
const util = require('util')
const steed = require('steed')
const fp = require('fastify-plugin')
const { BadRequest, Unauthorized } = require('http-errors')

const requiredParameters = ['keyid', 'algorithm', 'signature']
const availableAlgorithm = ['hmac-sha256', 'hmac-sha1', 'hmac-sha512']

const messages = {
  missingRequiredHeadersErrorMessage: (headers) => {
    return `Missing required HTTP headers : ${headers.join(', ')}`
  },
  missingRequiredSignatureParamsErrorMessage: (parameters) => {
    return `Missing required signature parameters : ${parameters.join(', ')}`
  },
  badHeaderFormatError: (header, expectedFormat) => {
    return `Bad value format for the HTTP header ${header}. Expected format : ${expectedFormat}`
  },
  unsupportedAlgorithmErrorMessage: 'Unsupported algorithm',
  expiredRequestErrorMessage: 'Request has expired',
  invalidSignatureErrorMessage: 'Authorization signature is invalid'
}

function fastifyApiKey (fastify, options, next) {
  if (!options.getSecret) {
    return next(new Error('missing getSecret'))
  }

  const {
    getSecret: secretCallback,
    requestLifetime = 300
  } = options

  fastify.decorateRequest('apiKeyVerify', requestVerify)

  next()

  function requestVerify (next) {
    const request = this

    if (next === undefined) {
      return new Promise((resolve, reject) => {
        request.apiKeyVerify((err, value) => {
          err ? reject(err) : resolve(value)
        })
      })
    }

    if (!request.headers || !request.headers.authorization) {
      return next(new Unauthorized(messages.missingRequiredHeadersErrorMessage(['authorization'])))
    }

    let { authorization } = request.headers
    const scheme = 'signature'
    const prefix = authorization.substring(0, scheme.length).toLowerCase()
    if (prefix !== scheme) {
      return next(new BadRequest(messages.badHeaderFormatError('Authorization', 'Signature [params]')))
    }

    authorization = authorization.substring(scheme.length).trim()
    const parts = authorization.split(',')
    const signatureParams = {}
    for (const part of parts) {
      const index = part.indexOf('="')
      const key = part.substring(0, index).toLowerCase()
      signatureParams[key] = part.substring(index + 2, part.length - 1)
    }

    const missingSignatureParams = []
    for (const param of requiredParameters) {
      if (!signatureParams[param]) {
        missingSignatureParams.push(param)
      }
    }

    if (missingSignatureParams.length > 0) {
      return next(new BadRequest(messages.missingRequiredSignatureParamsErrorMessage(missingSignatureParams)))
    }

    signatureParams.headers = signatureParams.headers ? signatureParams.headers.toLowerCase().split(' ') : ['date']

    if (!availableAlgorithm.includes(signatureParams.algorithm)) {
      return next(new BadRequest(messages.unsupportedAlgorithmErrorMessage))
    }

    const missingRequiredHeaders = []
    signatureParams.signingString = ''
    signatureParams.headers.forEach((header, index, arr) => {
      if (header === '(request-target)') {
        signatureParams.signingString += `(request-target): ${request.method.toLowerCase()} ${request.url}`
      } else if (request.headers[header]) {
        signatureParams.signingString += `${header}: ${request.headers[header]}`
      } else {
        missingRequiredHeaders.push(header)
      }
      if (index < arr.length - 1) {
        signatureParams.signingString += '\n'
      }
    })

    if (missingRequiredHeaders.length > 0) {
      return next(new BadRequest(messages.missingRequiredHeadersErrorMessage(missingRequiredHeaders)))
    }

    if (signatureParams.headers.includes('date') &&
      request.headers.date &&
      requestLifetime) {
      const currentDate = new Date().getTime()
      const requestDate = Date.parse(request.headers.date)
      if (Number.isNaN(requestDate)) {
        return next(new BadRequest(
          messages.badHeaderFormatError('date', '<day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT')))
      }

      if (Math.abs(currentDate - requestDate) >= requestLifetime * 1000) {
        return next(new BadRequest(messages.expiredRequestErrorMessage))
      }
    }

    steed.waterfall([
      function getSecret (cb) {
        const maybePromise = secretCallback(request, signatureParams.keyid, cb)
        if (util.types.isPromise(maybePromise)) {
          maybePromise.then(user => cb(null, user), cb)
        }
      },
      function verify (secret, cb) {
        const algorithm = signatureParams.algorithm.split('-')[1]
        const hmac = crypto.createHmac(algorithm, secret)
        hmac.update(signatureParams.signingString)

        /* Use double hmac to protect against timing attacks */
        let h1 = crypto.createHmac(algorithm, secret)
        h1 = h1.update(hmac.digest()).digest()
        let h2 = crypto.createHmac(algorithm, secret)
        h2 = h2.update(Buffer.from(signatureParams.signature, 'base64')).digest()

        if (!h1.equals(h2)) {
          return cb(new Unauthorized(messages.invalidSignatureErrorMessage))
        }
        cb()
      }], next)
  }
}

module.exports = fp(fastifyApiKey, {
  fastify: '>=3.x',
  name: 'fastify-api-key'
})
