const clone = (obj) => JSON.parse(JSON.stringify(obj));

let debugId = 0;

const debug = (request, log) => {
  log = log || console.log;

  let proto;
  if (request.Request) {
    proto = request.Request.prototype;
  } else if (request.get && request.post) {
    // The object returned by request.defaults() doesn't include the
    // Request property, so do this horrible thing to get at it.  Per
    // Wikipedia, port 4 is unassigned.
    const req = request('http://localhost:4').on('error', () => {});
    proto = req.constructor.prototype;
  } else {
    throw new Error(
      "Pass the object returned by require('request') to this function."
    );
  }

  if (!proto._initBeforeDebug) {
    proto._initBeforeDebug = proto.init;

    proto.init = function() {
      if (!this.debugId) {
        this.on('request', function(req) {
          const data = {
            debugId: this.debugId,
            uri: this.uri.href,
            method: this.method,
            headers: clone(this.headers),
          };
          if (this.body) {
            data.body = this.body.toString('utf8');
          }
          log('request', data, this);
        })
          .on('response', function(res) {
            if (this.callback) {
              // callback specified, request will buffer the body for
              // us, so wait until the complete event to do anything
            } else {
              // cannot get body since no callback specified
              log(
                'response',
                {
                  debugId: this.debugId,
                  headers: clone(res.headers),
                  statusCode: res.statusCode,
                },
                this
              );
            }
          })
          .on('complete', function(res, body) {
            if (this.callback) {
              log(
                'response',
                {
                  debugId: this.debugId,
                  headers: clone(res.headers),
                  statusCode: res.statusCode,
                  body: res.body,
                  times: res.times,
                  timingPhases: res.timingPhases,
                },
                this
              );
            }
          })
          .on('redirect', function() {
            const type = this.response.statusCode == 401 ? 'auth' : 'redirect';
            log(
              type,
              {
                debugId: this.debugId,
                statusCode: this.response.statusCode,
                headers: clone(this.response.headers),
                uri: this.uri.href,
              },
              this
            );
          });

        this.debugId = ++debugId;
      }

      return proto._initBeforeDebug.apply(this, arguments);
    };
  }

  if (!request.stopDebugging) {
    request.stopDebugging = function() {
      proto.init = proto._initBeforeDebug;
      delete proto._initBeforeDebug;
    };
  }
};

module.exports = debug;
