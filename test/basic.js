const lib = require('./lib');
require('mocha');
let request = require('request');
const Request = require('request');
const should = require('should');

describe('request-debug', () => {
  // @ts-ignore
  const proto = request.Request.prototype;

  before(() => {
    lib.enableDebugging(request);
    lib.startServers();

    request = request.defaults({
      headers: {
        host: 'localhost',
      },
      rejectUnauthorized: false,
    });
  });

  beforeEach(() => {
    lib.clearRequests();
  });

  function maybeTransferEncodingChunked(obj) {
    obj['transfer-encoding'] = 'chunked';
    return obj;
  }

  it('should capture a normal request', (done) => {
    request(`${lib.urls.http}/bottom`, (err) => {
      should.not.exist(err);
      lib.fixVariableHeaders();
      lib.requests.should.eql([
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/bottom`,
            method: 'GET',
            headers: {
              host: 'localhost',
            },
          },
        },
        {
          response: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '10',
              'content-type': 'text/html; charset=utf-8',
              date: '<date>',
              etag: 'W/"<etag>"',
              'x-powered-by': 'Express',
            },
            statusCode: 200,
            body: 'Request OK',
            times: undefined,
            timingPhases: undefined,
          },
        },
      ]);
      done();
    });
  });

  it('should capture a request with no callback', (done) => {
    const r = request(`${lib.urls.http}/bottom`);
    r.on('complete', () => {
      lib.fixVariableHeaders();
      lib.requests.should.eql([
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/bottom`,
            method: 'GET',
            headers: {
              host: 'localhost',
            },
          },
        },
        {
          response: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '10',
              'content-type': 'text/html; charset=utf-8',
              date: '<date>',
              etag: 'W/"<etag>"',
              'x-powered-by': 'Express',
            },
            statusCode: 200,
          },
        },
      ]);
      done();
    });
  });

  it('should capture a redirect', (done) => {
    request(`${lib.urls.http}/middle`, (err) => {
      should.not.exist(err);
      lib.fixVariableHeaders();
      lib.requests.should.eql([
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/middle`,
            method: 'GET',
            headers: {
              host: 'localhost',
            },
          },
        },
        {
          redirect: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '29',
              'content-type': 'text/plain; charset=utf-8',
              date: '<date>',
              location: '/bottom',
              vary: 'Accept',
              'x-powered-by': 'Express',
            },
            statusCode: 302,
            uri: `${lib.urls.http}/bottom`,
          },
        },
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/bottom`,
            method: 'GET',
            headers: {
              host: `localhost:${lib.ports.http}`,
            },
          },
        },
        {
          response: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '10',
              'content-type': 'text/html; charset=utf-8',
              date: '<date>',
              etag: 'W/"<etag>"',
              'x-powered-by': 'Express',
            },
            statusCode: 200,
            body: 'Request OK',
            times: undefined,
            timingPhases: undefined,
          },
        },
      ]);
      done();
    });
  });

  it('should capture a cross-protocol redirect', (done) => {
    request(`${lib.urls.https}/middle/http`, (err) => {
      should.not.exist(err);
      lib.fixVariableHeaders();
      lib.requests.should.eql([
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.https}/middle/http`,
            method: 'GET',
            headers: {
              host: 'localhost',
            },
          },
        },
        {
          redirect: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '50',
              'content-type': 'text/plain; charset=utf-8',
              date: '<date>',
              location: `${lib.urls.http}/bottom`,
              vary: 'Accept',
              'x-powered-by': 'Express',
            },
            statusCode: 302,
            uri: `${lib.urls.http}/bottom`,
          },
        },
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/bottom`,
            method: 'GET',
            headers: {
              host: `localhost:${lib.ports.http}`,
            },
          },
        },
        {
          response: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '10',
              'content-type': 'text/html; charset=utf-8',
              date: '<date>',
              etag: 'W/"<etag>"',
              'x-powered-by': 'Express',
            },
            statusCode: 200,
            body: 'Request OK',
            times: undefined,
            timingPhases: undefined,
          },
        },
      ]);
      done();
    });
  });

  it('should capture an auth challenge', (done) => {
    request(
      `${lib.urls.http}/auth/bottom`,
      {
        auth: {
          user: 'admin',
          pass: 'mypass',
          sendImmediately: false,
        },
      },
      (err) => {
        should.not.exist(err);
        lib.fixVariableHeaders();
        lib.requests.should.eql([
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/auth/bottom`,
              method: 'GET',
              headers: {
                host: 'localhost',
              },
            },
          },
          {
            auth: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                date: '<date>',
                'www-authenticate': 'Digest realm="Users" <+nonce,qop>',
                'x-powered-by': 'Express',
                'content-length': '12',
              },
              statusCode: 401,
              uri: `${lib.urls.http}/auth/bottom`,
            },
          },
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/auth/bottom`,
              method: 'GET',
              headers: {
                authorization:
                  'Digest username="admin" <+realm,nonce,uri,qop,response,nc,cnonce>',
                host: 'localhost',
              },
            },
          },
          {
            response: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '10',
                'content-type': 'text/html; charset=utf-8',
                date: '<date>',
                etag: 'W/"<etag>"',
                'x-powered-by': 'Express',
              },
              statusCode: 200,
              body: 'Request OK',
              times: undefined,
              timingPhases: undefined,
            },
          },
        ]);
        done();
      },
    );
  });

  it('should capture a complicated redirect', (done) => {
    request(
      `${lib.urls.https}/auth/top/http`,
      {
        auth: {
          user: 'admin',
          pass: 'mypass',
          sendImmediately: false,
        },
      },
      (err) => {
        should.not.exist(err);
        lib.fixVariableHeaders();
        lib.requests.should.eql([
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.https}/auth/top/http`,
              method: 'GET',
              headers: {
                host: 'localhost',
              },
            },
          },
          {
            auth: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                date: '<date>',
                'content-length': '12',
                'www-authenticate': 'Digest realm="Users" <+nonce,qop>',
                'x-powered-by': 'Express',
              },
              statusCode: 401,
              uri: `${lib.urls.https}/auth/top/http`,
            },
          },
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.https}/auth/top/http`,
              method: 'GET',
              headers: {
                authorization:
                  'Digest username="admin" <+realm,nonce,uri,qop,response,nc,cnonce>',
                host: 'localhost',
              },
            },
          },
          {
            redirect: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '50',
                'content-type': 'text/plain; charset=utf-8',
                date: '<date>',
                location: `${lib.urls.http}/middle`,
                vary: 'Accept',
                'x-powered-by': 'Express',
              },
              statusCode: 302,
              uri: `${lib.urls.http}/middle`,
            },
          },
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/middle`,
              method: 'GET',
              headers: {
                authorization:
                  'Digest username="admin" <+realm,nonce,uri,qop,response,nc,cnonce>',
                host: `localhost:${lib.ports.http}`,
              },
            },
          },
          {
            redirect: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '29',
                'content-type': 'text/plain; charset=utf-8',
                date: '<date>',
                location: '/bottom',
                vary: 'Accept',
                'x-powered-by': 'Express',
              },
              statusCode: 302,
              uri: `${lib.urls.http}/bottom`,
            },
          },
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/bottom`,
              method: 'GET',
              headers: {
                authorization:
                  'Digest username="admin" <+realm,nonce,uri,qop,response,nc,cnonce>',
                host: `localhost:${lib.ports.http}`,
              },
            },
          },
          {
            response: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '10',
                'content-type': 'text/html; charset=utf-8',
                date: '<date>',
                etag: 'W/"<etag>"',
                'x-powered-by': 'Express',
              },
              statusCode: 200,
              body: 'Request OK',
              times: undefined,
              timingPhases: undefined,
            },
          },
        ]);
        done();
      },
    );
  });

  it('should capture POST data and 404 responses', (done) => {
    request(
      {
        uri: `${lib.urls.http}/bottom`,
        method: 'POST',
        form: {
          formKey: 'formData',
        },
      },
      (err) => {
        should.not.exist(err);
        lib.fixVariableHeaders();
        lib.requests.should.eql([
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/bottom`,
              method: 'POST',
              headers: {
                host: 'localhost',
                'content-length': 16,
                'content-type': '<application/x-www-form-urlencoded>',
              },
              body: 'formKey=formData',
            },
          },
          {
            response: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '146',
                'content-type': 'text/html; charset=utf-8',
                date: '<date>',
                'x-powered-by': 'Express',
                'content-security-policy': "default-src 'self'",
                'x-content-type-options': 'nosniff',
              },
              statusCode: 404,
              body:
                '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /bottom</pre>\n</body>\n</html>\n',
              times: undefined,
              timingPhases: undefined,
            },
          },
        ]);
        done();
      },
    );
  });

  it('should capture JSON responses', (done) => {
    request(
      {
        uri: `${lib.urls.http}/bottom`,
        json: true,
      },
      (err) => {
        should.not.exist(err);
        lib.fixVariableHeaders();
        lib.requests.should.eql([
          {
            request: {
              debugId: lib.debugId,
              uri: `${lib.urls.http}/bottom`,
              method: 'GET',
              headers: {
                accept: 'application/json',
                host: 'localhost',
              },
            },
          },
          {
            response: {
              debugId: lib.debugId,
              headers: {
                connection: '<close or keep-alive>',
                'content-length': '15',
                'content-type': 'application/json; charset=utf-8',
                date: '<date>',
                etag: 'W/"<etag>"',
                'x-powered-by': 'Express',
              },
              statusCode: 200,
              body: {
                key: 'value',
              },
              times: undefined,
              timingPhases: undefined,
            },
          },
        ]);
        done();
      },
    );
  });

  it('should work with the result of request.defaults()', (done) => {
    proto.should.have.property('_initBeforeDebug');
    proto.init = proto._initBeforeDebug;
    delete proto._initBeforeDebug;

    request = Request.defaults({
      headers: {
        host: 'localhost',
      },
    });

    lib.enableDebugging(request);

    request(`${lib.urls.http}/bottom`, (err) => {
      should.not.exist(err);
      lib.fixVariableHeaders();
      lib.requests.should.eql([
        {
          request: {
            debugId: lib.debugId,
            uri: `${lib.urls.http}/bottom`,
            method: 'GET',
            headers: {
              host: 'localhost',
            },
          },
        },
        {
          response: {
            debugId: lib.debugId,
            headers: {
              connection: '<close or keep-alive>',
              'content-length': '10',
              'content-type': 'text/html; charset=utf-8',
              date: '<date>',
              etag: 'W/"<etag>"',
              'x-powered-by': 'Express',
            },
            statusCode: 200,
            body: 'Request OK',
            times: undefined,
            timingPhases: undefined,
          },
        },
      ]);
      done();
    });
  });

  it('should not capture anything after stopDebugging()', (done) => {
    // @ts-ignore
    request.stopDebugging();
    request(`${lib.urls.http}/bottom`, (err) => {
      should.not.exist(err);
      lib.requests.should.eql([]);
      done();
    });
  });
});
