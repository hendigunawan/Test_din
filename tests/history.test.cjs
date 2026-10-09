const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js'), bank=require('../products.js');
let H;
try{H=require('../history.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;H={};}
function history(){assert.equal(typeof H.summarize,'function','session history is implemented');return H;}
function completed(id='session',duration=600000,reason='submitted'){
  const a=C.createAttempt(bank,{now:1000,minutes:10,id});
  a.questions.forEach((q,i)=>{if(i<40)C.setAnswer(a,i,q.kind==='code'?q.code:q.name);else if(i<50)C.setAnswer(a,i,'wrong');});
  C.finishAttempt(a,reason,1000+duration);return a;
}
test('history derives elapsed time and score from a finished attempt without copying answers',()=>{
  const h=history(),a=completed(),s=h.summarize(a);
  assert.equal(s.durationMs,600000);assert.equal(s.score,40);assert.equal(s.answered,50);
  assert.equal(s.reason,'submitted');assert.equal(s.minutes,10);
  assert(!('questions' in s));assert(!('answers' in s));
  const late=completed('late',1200000,'timeout');assert.equal(h.summarize(late).durationMs,600000);
});
test('averages include completed and stopped sessions, with no divide-by-zero result',()=>{
  const h=history();
  const a=h.summarize(completed('a',600000));
  const b=completed('b',300000,'violations');b.answers.fill('');
  const stats=h.stats([a,h.summarize(b)]);
  assert.equal(stats.count,2);assert.equal(stats.averageDurationMs,450000);assert.equal(stats.averageScore,20);
  assert.deepEqual(h.stats([]),{count:0,averageDurationMs:null,averageScore:null});
});
test('reloading a result records it once and the newest 100 sessions are retained chronologically',()=>{
  const h=history(),base=h.summarize(completed());let entries=[];
  for(let i=104;i>=0;i--)entries=h.add(entries,{...base,id:String(i),startedAt:1000+i,finishedAt:601000+i});
  assert.equal(entries.length,100);assert.equal(entries[0].id,'5');assert.equal(entries.at(-1).id,'104');
  assert.strictEqual(h.add(entries,entries[50]),entries);
  const decoded=h.parse(JSON.stringify({version:1,sessions:entries}));assert.deepEqual(decoded,entries);
});
test('active attempts and invalid history cannot become completed sessions',()=>{
  const h=history();assert.equal(h.summarize(C.createAttempt(bank,{now:1000})),null);
  const a=completed();a.finishedAt=null;assert.equal(h.summarize(a),null);
  assert.deepEqual(h.parse(null),[]);
  assert.throws(()=>h.parse('{broken'));assert.throws(()=>h.parse('{"version":2,"sessions":[]}'));
  const bad={...h.summarize(completed()),durationMs:-1};
  assert.throws(()=>h.parse(JSON.stringify({version:1,sessions:[bad]})));
});
