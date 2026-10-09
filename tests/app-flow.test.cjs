// Headless controller checks with a minimal DOM adapter. Browser rendering,
// native fullscreen permissions and native focus delivery need manual QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../core.js');
let history;
try{history=require('../history.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;history={};}
const bank=require('../products.js');
const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const HISTORY_STORE='latihan-kode-produk:history:v1';

function fixture(initial,options={}) {
  const records=options.records||new Map();if(initial)records.set('latihan-kode-produk:v1',JSON.stringify(initial));
  if(options.historyRaw!==undefined)records.set(HISTORY_STORE,options.historyRaw);
  const nodes=new Map(),winEvents={},docEvents={},intervals=[];
  function element(id){
    if(nodes.has(id))return nodes.get(id);
    const e={id,events:{},style:{},classList:{add(){},remove(){},toggle(){}},value:id==='duration'?'45':'',checked:id==='only-wrong',disabled:false,open:false,textContent:'',innerHTML:'',
      addEventListener(type,fn){this.events[type]=fn;},setAttribute(){},querySelector(){return element('cell');},focus(){},showModal(){this.open=true;},close(){this.open=false;},click(){return this.events.click?.();}};
    nodes.set(id,e);return e;
  }
  const document={visibilityState:'visible',fullscreenEnabled:true,fullscreenElement:null,getElementById:element,hasFocus:()=>true,
    addEventListener:(type,fn)=>{docEvents[type]=fn;},documentElement:{async requestFullscreen(){document.fullscreenElement={};}},
    async exitFullscreen(){document.fullscreenElement=null;},createElement:()=>element('download')};
  const window={QuizCore:core,QuizHistory:history,PRODUCT_BANK:bank,innerWidth:1000,scrollTo(){},addEventListener:(type,fn)=>{winEvents[type]=fn;}};
  const sandbox={window,document,navigator:{},localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>{if(options.failHistoryWrite&&k===HISTORY_STORE)throw new Error('quota');records.set(k,v);},removeItem:k=>records.delete(k)},crypto:{randomUUID:()=> 'test-attempt'},setTimeout,clearTimeout,setInterval:fn=>intervals.push(fn),console,Blob,URL,Date};
  vm.runInNewContext(code,sandbox);
  return {element,document,window,winEvents,docEvents,intervals,records,getAttempt:()=>JSON.parse(records.get('latihan-kode-produk:v1')),async settle(){await new Promise(r=>setImmediate(r));}};
}

test('UI controller starts, saves answers, navigates, submits, and renders a scored review',async()=>{
  const f=fixture();await f.settle();
  assert.match(f.element('app').innerHTML,/Siap latihan/);
  f.element('agreement').checked=true;
  await f.element('start-button').click();
  let a=f.getAttempt();
  assert.equal(a.status,'active');assert.equal(a.questions.length,100);
  const expected=a.questions[0].kind==='code'?a.questions[0].code:a.questions[0].name;
  f.element('answer').value=expected;f.element('answer').events.input();
  assert.equal(f.getAttempt().answers[0],expected);
  f.element('next').click();assert.equal(f.getAttempt().current,1);
  f.element('previous').click();assert.equal(f.getAttempt().current,0);
  f.element('finish').click();assert(f.element('submit-dialog').open);
  f.element('confirm-submit').click();
  assert.equal(f.getAttempt().status,'finished');
  assert.match(f.element('app').innerHTML,/Nilai 1 dari 100/);
  assert.match(f.element('review').innerHTML,/Belum dijawab/);
});

test('visibility plus fullscreen are one episode; third episode shows terminal result',async()=>{
  const f=fixture();await f.settle();f.element('agreement').checked=true;await f.element('start-button').click();
  for(let i=1;i<=3;i++){
    f.document.visibilityState='hidden';f.docEvents.visibilitychange();
    f.document.fullscreenElement=null;f.docEvents.fullscreenchange();
    assert.equal(f.getAttempt().violations.length,i);
    f.document.visibilityState='visible';f.docEvents.visibilitychange();
    if(i<3){assert(f.element('warning-dialog').open);await f.element('resume-button').click();assert(!f.element('warning-dialog').open);}
  }
  assert.equal(f.getAttempt().finishReason,'violations');
  assert.match(f.element('app').innerHTML,/Latihan dihentikan/);
});

test('saved running UI restores answers and warns once after reload',async()=>{
  const initial=core.createAttempt(bank,{now:Date.now(),id:'restore',minutes:45});initial.answers[5]='01001';initial.current=5;
  const f=fixture(initial);await f.settle();
  assert.equal(f.getAttempt().answers[5],'01001');
  assert.equal(f.getAttempt().deadline,initial.deadline);
  assert.equal(f.getAttempt().violations.length,1);
  assert(f.element('warning-dialog').open);
});

test('old product names require a new attempt and keep saved answers until the user starts',async()=>{
  for(const status of ['active','finished']){
    const initial=core.createAttempt(bank,{now:Date.now(),id:'old-bank',minutes:10});
    initial.questions.find(q=>q.code==='01174').name='NAMA PRODUK VERSI SEBELUMNYA';
    initial.answers[0]='jawaban sebelumnya';
    if(status==='finished')core.finishAttempt(initial,'submitted');
    const f=fixture(initial);await f.settle();
    assert.match(f.element('app').innerHTML,/Data produk sudah diperbarui/);
    assert.deepEqual(f.getAttempt(),initial);
    assert(!f.element('warning-dialog').open);
    f.element('duration').value='10';f.element('agreement').checked=true;
    await f.element('start-button').click();
    const current=f.getAttempt();
    assert.equal(current.status,'active');
    assert.equal(current.deadline-current.startedAt,600000);
    assert(current.answers.every(answer=>answer===''));
    assert.equal(current.questions.find(q=>q.code==='01174').name,bank.find(p=>p.code==='01174').name);
  }
});

test('finished sessions survive new attempts and refresh without duplicate history',async()=>{
  const initial=core.createAttempt(bank,{now:Date.now()-600000,id:'previous',minutes:10});
  initial.answers[0]=initial.questions[0].kind==='code'?initial.questions[0].code:initial.questions[0].name;
  core.finishAttempt(initial,'submitted',initial.startedAt+600000);
  const f=fixture(initial);await f.settle();
  assert(f.records.has(HISTORY_STORE),'a finished session is archived');
  assert.equal(JSON.parse(f.records.get(HISTORY_STORE)).sessions.length,1);
  const reloaded=fixture(null,{records:f.records});await reloaded.settle();
  assert.equal(JSON.parse(f.records.get(HISTORY_STORE)).sessions.length,1);
  reloaded.element('new-attempt').click();reloaded.element('agreement').checked=true;
  await reloaded.element('start-button').click();reloaded.element('confirm-submit').click();
  const saved=JSON.parse(f.records.get(HISTORY_STORE)).sessions;
  assert.equal(saved.length,2);assert.equal(saved[0].id,'previous');assert.equal(saved[0].score,1);
  const html=reloaded.element('session-history').innerHTML;
  assert.match(html,/Rata-rata durasi/);assert.match(html,/Nilai per sesi/);assert.match(html,/Durasi per sesi/);
  assert.match(html,/Belum ada jawaban/);assert.doesNotMatch(html,/NaN|Infinity/);
});

test('timeout and violation completion are archived with their actual stopping reason',async()=>{
  const expired=core.createAttempt(bank,{now:Date.now()-1200000,id:'expired',minutes:10});
  const f=fixture(expired);await f.settle();
  assert(f.records.has(HISTORY_STORE),'timed-out sessions are archived');
  const saved=JSON.parse(f.records.get(HISTORY_STORE)).sessions[0];
  assert.equal(saved.reason,'timeout');assert.equal(saved.durationMs,600000);
  const g=fixture();await g.settle();g.element('agreement').checked=true;await g.element('start-button').click();
  for(let i=0;i<3;i++){g.document.visibilityState='hidden';g.docEvents.visibilitychange();g.document.visibilityState='visible';if(i<2)await g.element('resume-button').click();}
  assert.equal(JSON.parse(g.records.get(HISTORY_STORE)).sessions[0].reason,'violations');
});

test('a finished result from an older product bank is archived before starting the current bank',async()=>{
  const initial=core.createAttempt(bank,{now:Date.now()-60000,id:'old-finished',minutes:10});
  initial.questions[0].name='AN EARLIER PRODUCT NAME';core.finishAttempt(initial,'submitted');
  const f=fixture(initial);await f.settle();
  assert(f.records.has(HISTORY_STORE),'previous-bank results are preserved');
  assert.equal(JSON.parse(f.records.get(HISTORY_STORE)).sessions[0].id,'old-finished');
  assert.match(f.element('app').innerHTML,/Data produk sudah diperbarui/);
});

test('damaged or full history storage leaves results readable and never overwrites damaged data',async()=>{
  const initial=core.createAttempt(bank,{now:Date.now()-60000,id:'storage-test',minutes:10});core.finishAttempt(initial,'submitted');
  for(const options of [{historyRaw:'{broken'},{failHistoryWrite:true}]){
    const f=fixture(initial,options);await f.settle();
    assert.match(f.element('app').innerHTML,/Latihan selesai/);
    assert.match(f.element('session-history').innerHTML,/Riwayat.*belum.*disimpan/);
    assert.equal(f.records.get(HISTORY_STORE),options.historyRaw);
    assert.match(f.element('review').innerHTML,/Belum dijawab/);
  }
});
