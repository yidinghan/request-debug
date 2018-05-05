const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const passport = require('passport');
const DigestStrategy = require('passport-http').DigestStrategy;
const path = require('path');
const util = require('util');
const debug = require('../..');

let app;

const c = {
  requests: [],
  urls: {},
  debugId: 0,
  ports: {
    http: 8480,
    https: 8443,
  },
};

Object.keys(c.ports).forEach((port) => {
  c.urls[port] = util.format('%s://localhost:%d', port, c.ports[port]);
});

const enableDebugging = function (request) {
  // enable debugging
  debug(request, (type, data, r) => {
    const obj = {};
    obj[type] = data;
    c.requests.push(obj);
    if (typeof r._initBeforeDebug !== 'function') {
      throw new Error('Expected a Request instance here.');
    }
  });
};

c.clearRequests = function () {
  c.requests = [];
  c.debugId++;
};

const fixHeader = {
  date() {
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
  referer() {
    return null;
  },
  'content-type': function (val) {
    return val.replace(
      /^application\/x-www-form-urlencoded(; charset=utf-8)?$/,
      '<application/x-www-form-urlencoded>',
    );
  },
  'content-length': function (val) {
    return val;
  },
};
fixHeader['www-authenticate'] = fixHeader.authorization;

c.fixVariableHeaders = function () {
  c.requests.forEach((req) => {
    Object.keys(req).forEach((type) => {
      Object.keys(req[type].headers).forEach((header) => {
        if (fixHeader[header]) {
          const fixed = fixHeader[header](req[type].headers[header], req[type]);
          if (fixed === null) {
            delete req[type].headers[header];
          } else {
            req[type].headers[header] = fixed;
          }
        }
      });
    });
  });
};

c.startServers = function () {
  passport.use(new DigestStrategy({ qop: 'auth' }, (user, done) =>
    done(null, 'admin', 'mypass')));

  app = express();

  app.use(passport.initialize());

  function handleRequest(req, res) {
    if (req.params.level === 'bottom') {
      if (req.header('accept') === 'application/json') {
        res.json({ key: 'value' });
      } else {
        res.send('Request OK');
      }
      return;
    }
    const level = req.params.level === 'top' ? 'middle' : 'bottom';
    if (req.params.proto && req.params.proto !== req.protocol) {
      res.redirect(`${c.urls[req.params.proto]}/${level}`);
    } else {
      res.redirect(`/${level}`);
    }
  }

  const auth = passport.authenticate('digest', { session: false });
  app.get('/auth/:level/:proto?', auth, handleRequest);

  app.get('/:level/:proto?', handleRequest);

  http.createServer(app).listen(c.ports.http);

  https
    .createServer(
      {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      },
      app,
    )
    .listen(c.ports.https);
};

c.enableDebugging = enableDebugging;

module.exports = c;
