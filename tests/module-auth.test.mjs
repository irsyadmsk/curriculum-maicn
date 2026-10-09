import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
function setup(profile, failure=false) {
  const context = vm.createContext({ window: {}, document: { addEventListener() {} }, console });
  context.window = context;
  context.window.auth = { onAuthStateChanged(callback) { return callback({ uid:'u1', email:'teacher@example.test' }); } };
  context.window.db = { collection() { return { doc() { return { async get() { if(failure)throw Error('offline'); return {exists:!!profile,data:()=>profile}; } }; } }; } };
  vm.runInContext(source + '\nwindow.testAuth=Auth;', context);
  return context.window.testAuth;
}
test('missing and unreadable module profiles never grant teacher access', async () => {
  for(const auth of [setup(null), setup(null,true)]) {
    await auth.onStateChange(()=>{});
    assert.equal(auth.isGuru(),false);
    assert.equal(auth.isAdmin(),false);
  }
});
test('stored module role determines presentation while identity comes from auth', async () => {
  const auth=setup({role:'guru',uid:'forged',email:'forged'});
  await auth.onStateChange(()=>{});
  assert.equal(auth.isGuru(),true);assert.equal(auth.isAdmin(),false);
  assert.equal(auth.getUser().uid,'u1');
  const admin=setup({role:'admin'});await admin.onStateChange(()=>{});assert.equal(admin.isAdmin(),true);
});
