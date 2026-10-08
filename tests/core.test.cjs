const test = require('node:test');
const assert = require('node:assert/strict');
let core;
try { core = require('../core.js'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; core = {}; }
const bank = require('../products.js');
const rng = () => 0.37;

test('creates exactly 100 different products with 50 code and 50 name prompts', () => {
  assert.equal(typeof core.createAttempt, 'function', 'quiz creation is implemented');
  const a = core.createAttempt(bank, {now:1000,minutes:45,id:'a',random:rng});
  assert.equal(a.questions.length,100);
  assert.equal(new Set(a.questions.map(q=>q.code)).size,100);
  assert.equal(a.questions.filter(q=>q.kind==='code').length,50);
  assert(a.questions.filter(q=>q.kind==='code').every(q=>!q.ambiguousName));
  assert.equal(a.deadline,2701000);
});

test('grading preserves leading zeroes and ignores only case, whitespace and punctuation in names', () => {
  assert.equal(typeof core.isCorrect, 'function');
  assert(core.isCorrect({kind:'code',code:'01001'},'01001'));
  assert(!core.isCorrect({kind:'code',code:'01001'},'1001'));
  assert(core.isCorrect({kind:'name',name:'AREM-AREM (LONTONG)'},' arem arem lontong '));
  assert(!core.isCorrect({kind:'name',name:'ROTI COKELAT KEJU'},'roti cokelat'));
  assert(!core.isCorrect({kind:'name',name:'KUE KU'},''));
});

test('one exit episode counts once across hidden, blur, fullscreen and reload events', () => {
  assert.equal(typeof core.violate, 'function');
  const a=core.createAttempt(bank,{now:0,minutes:45,id:'a',random:rng});
  core.violate(a,'tab',1000);
  core.violate(a,'fullscreen',1010);
  core.violate(a,'blur',1020);
  assert.equal(a.violations.length,1);
  const restored=core.restoreAttempt(JSON.parse(JSON.stringify(a)),1100);
  assert.equal(restored.violations.length,1);
  assert.equal(restored.status,'active');
  assert(restored.pendingViolation);
});

test('third separate exit ends the attempt and prevents later answer changes', () => {
  assert.equal(typeof core.resumeAttempt, 'function');
  const a=core.createAttempt(bank,{now:0,minutes:45,id:'a',random:rng});
  core.setAnswer(a,0,'first');
  for(let i=0;i<3;i++){
    core.violate(a,'tab',100+i*2000);
    if(i<2) core.resumeAttempt(a);
  }
  assert.equal(a.status,'finished');
  assert.equal(a.finishReason,'violations');
  assert.equal(a.violations.length,3);
  core.setAnswer(a,0,'changed');
  assert.equal(a.answers[0],'first');
});

test('reload records one violation without changing answers, order or deadline', () => {
  assert.equal(typeof core.restoreAttempt,'function');
  const a=core.createAttempt(bank,{now:0,minutes:30,id:'a',random:rng});
  core.setAnswer(a,3,'01001');
  const r=core.restoreAttempt(JSON.parse(JSON.stringify(a)),10000);
  assert.equal(r.violations.length,1);
  assert.equal(r.answers[3],'01001');
  assert.equal(r.deadline,a.deadline);
  assert.deepEqual(r.questions,a.questions);
});

test('expired hidden attempt completes at its original deadline after restoration', () => {
  assert.equal(typeof core.tick,'function');
  const a=core.createAttempt(bank,{now:0,minutes:30,id:'a',random:rng});
  core.violate(a,'tab',10);
  const r=core.restoreAttempt(JSON.parse(JSON.stringify(a)),2000000);
  assert.equal(r.status,'finished');
  assert.equal(r.finishReason,'timeout');
  assert.equal(r.finishedAt,1800000);
  assert.equal(core.remaining(r,2000000),0);
});

test('result counts right, wrong and blank responses separately', () => {
  assert.equal(typeof core.result,'function');
  const a=core.createAttempt(bank,{now:0,minutes:30,id:'a',random:rng});
  a.questions.forEach((q,i)=>{if(i<40)core.setAnswer(a,i,q.kind==='code'?q.code:q.name);else if(i<70)core.setAnswer(a,i,'WRONG');});
  core.finishAttempt(a,'submitted',60000);
  assert.deepEqual(core.result(a),{correct:40,wrong:30,blank:30,total:100,score:40});
});

test('invalid saved state cannot masquerade as a valid recoverable attempt', () => {
  assert.equal(typeof core.validAttempt,'function');
  assert(!core.validAttempt({status:'active'}));
  const a=core.createAttempt(bank,{now:0,minutes:30,id:'a',random:rng});
  assert(core.validAttempt(a));
  a.questions.pop();
  assert(!core.validAttempt(a));
});
