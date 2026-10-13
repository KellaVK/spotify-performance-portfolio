const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(responses) {
  const calls = [];
  const nodes = { songTitle: { value: 'Example Song, Example Artist', addEventListener() {} }, result: { innerHTML: '' } };
  const redirects = [];
  const context = vm.createContext({
    document: { getElementById: id => nodes[id] },
    window: { PERFORMANCE_CONFIG: { spotifyClientSecret: 'test-secret' }, location: { replace: url => redirects.push(url) } },
    btoa: value => Buffer.from(value).toString('base64'),
    console: { log() {}, error() {} },
    fetch: async (url, options) => { calls.push({url, options}); return responses.shift(); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../tricks/spotify.js'), 'utf8'), context);
  return { context, calls, nodes, redirects };
}

test('search authenticates and sends encoded title/artist to Spotify', async () => {
  const a = app([{json: async () => ({access_token:'test-token'})}, {json: async () => ({tracks:{items:[]}})}]);
  await vm.runInContext('searchSong()', a.context);
  assert.equal(a.calls[0].options.body, 'grant_type=client_credentials');
  assert.match(a.calls[1].url, /q=Example%20Song%20Example%20Artist/);
  assert.equal(a.calls[1].options.headers.Authorization, 'Bearer test-token');
  assert.equal(a.nodes.result.innerHTML, 'No songs found with that title.');
  assert.equal(a.redirects.length, 0);
});

test('selected track is stored before reveal navigation', async () => {
  const a = app([{ok:true}]);
  a.context.fixture = {tracks:{items:[{name:'Example',artists:[{name:'Artist'}],popularity:50,external_urls:{spotify:'https://open.spotify.com/track/example'}}]}};
  await vm.runInContext('displayResult(fixture)', a.context);
  assert.equal(a.calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(a.calls[0].options.body), {link:'https://open.spotify.com/track/example'});
  assert.equal(a.redirects.length, 1);
});
