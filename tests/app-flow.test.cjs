// Headless controller checks with a minimal DOM adapter. Browser rendering,
// native fullscreen permissions and native focus delivery need manual QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../core.js');
const bank=require('../products.js');
const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');

function fixture(initial) {
  const records=new Map();if(initial)records.set('latihan-kode-produk:v1',JSON.stringify(initial));
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
  const window={QuizCore:core,PRODUCT_BANK:bank,innerWidth:1000,scrollTo(){},addEventListener:(type,fn)=>{winEvents[type]=fn;}};
  const sandbox={window,document,navigator:{},localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},crypto:{randomUUID:()=> 'test-attempt'},setTimeout,clearTimeout,setInterval:fn=>intervals.push(fn),console,Blob,URL,Date};
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
