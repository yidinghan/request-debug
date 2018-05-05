const engine = require('detect-engine');
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const mocha = require('mocha');
const passport = require('passport');
const DigestStrategy = require('passport-http').DigestStrategy;
const path = require('path');
const should = require('should');
const util = require('util');

let app;
const ports = {
  http: 8480,
  https: 8443,
};

let requests = [];
for (const proto in ports) {
  exports.urls[proto] = util.format('%s://localhost:%d', proto, ports[proto]);
}

const enableDebugging = function (request) {
  // enable debugging
  require('../..')(request, (type, data, r) => {
    const obj = {};
    obj[type] = data;
    requests.push(obj);
    if (typeof r._initBeforeDebug !== 'function') {
      throw new Error('Expected a Request instance here.');
    }
  });
};

exports.clearRequests = function () {
  requests = [];
  exports.debugId++;
};

const fixHeader = {
  date(val) {
    return '<date>';
  },
  etag(val) {
    return `${val.split('"')[0]}"<etag>"`;
  },
  connection(val) {
    return val.replace(/^(close|keep-alive)$/, '<close or keep-alive>');
  },
  authorization(val) {
    const arr = val.split(', ');
    if (arr.length > 1) {
      val = util.format(
        '%s <+%s>',
        arr[0],
        arr
          .slice(1)
          .map(v => v.split('=')[0])
          .join(','),
      );
    }
    return val;
  },
  referer(val) {
    return null;
  },
  'content-type': function (val) {
    return val.replace(
      /^application\/x-www-form-urlencoded(; charset=utf-8)?$/,
      '<application/x-www-form-urlencoded>',
    );
  },
  'content-length': function (val, obj) {
    if (engine == 'iojs' && obj.statusCode == 401) {
      // io.js sends content-length here, Node does not
      return null;
    }
    return val;
  },
};
fixHeader['www-authenticate'] = fixHeader.authorization;

exports.fixVariableHeaders = function () {
  requests.forEach((req) => {
    for (const type in req) {
      for (const header in req[type].headers) {
        if (fixHeader[header]) {
          const fixed = fixHeader[header](req[type].headers[header], req[type]);
          if (fixed === null) {
            delete req[type].headers[header];
          } else {
            req[type].headers[header] = fixed;
          }
        }
      }
    }
  });
};

exports.startServers = function () {
  passport.use(new DigestStrategy({ qop: 'auth' }, (user, done) =>
    done(null, 'admin', 'mypass')));

  app = express();

  app.use(passport.initialize());

  function handleRequest(req, res) {
    if (req.params.level == 'bottom') {
      if (req.header('accept') == 'application/json') {
        res.json({ key: 'value' });
      } else {
        res.send('Request OK');
      }
      return;
    }
    const level = req.params.level == 'top' ? 'middle' : 'bottom';
    if (req.params.proto && req.params.proto != req.protocol) {
      res.redirect(`${exports.urls[req.params.proto]}/${level}`);
    } else {
      res.redirect(`/${level}`);
    }
  }

  const auth = passport.authenticate('digest', { session: false });
  app.get('/auth/:level/:proto?', auth, handleRequest);

  app.get('/:level/:proto?', handleRequest);

  http.createServer(app).listen(ports.http);

  https
    .createServer(
      {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      },
      app,
    )
    .listen(ports.https);
};

exports.ports = ports;
exports.requests = requests;
exports.urls = {};
exports.debugId = 0;
exports.enableDebugging = enableDebugging;
