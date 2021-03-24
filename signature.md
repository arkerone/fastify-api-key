# HTTP signature scheme

The signature is based on this
draft ["Signing HTTP Messages"](https://tools.ietf.org/html/draft-cavage-http-signatures-09). Your application must
provide to the client application both unique identifier :

* **key** : A key used to identify the client application;
* **shared secret**: A secret key shared between your application and the client application used to sign the requests
  and authenticate the client application.

## HTTP header

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

## Signature String Construction [](signature-string-construction)

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

## Signature creation

In order to create a signature, a client must :

1. Create the signature string as described in [Signature String Construction](#signature-string-construction);

2. The `algorithm` and shared secret associated with `keyId` must then be used to generate a digital signature on the
   signature string;

3. The `signature` is then generated by base 64 encoding the output of the digital signature algorithm.

## Supported algorithms

Currently supported algorithm names are:

* hmac-sha1
* hmac-sha256
* hmac-sha512